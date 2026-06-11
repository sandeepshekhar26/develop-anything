// ============================================================
// auk — AI Context Engineering Platform
// Import/Export dependency graph builder
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { ParsedFile, ImportEdge, GraphNode, DependencyGraph, ArchLayer, LayerBoundary } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

/** Context for resolving non-relative imports (Go modules, TS path aliases).
    Built once per project from go.mod / tsconfig.json. */
export interface ResolverContext {
  /** Go module prefix → repo-relative dir of its go.mod (e.g. "github.com/me/app" → "backend") */
  goModules: Array<{ prefix: string; root: string }>;
  /** TS/JS path aliases (e.g. "@/" → ["frontend/src"]) */
  tsAliases: Array<{ prefix: string; targets: string[] }>;
}

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.php'];
const INDEX_FILES = ['index.ts', 'index.js', 'index.tsx', 'index.jsx', '__init__.py', 'mod.rs'];

/** Resolve an import to a single file path (first match). Kept for the call-graph builder. */
export function resolveImport(
  source: string,
  fromFile: string,
  allFiles: Map<string, string>,
  ctx?: ResolverContext,
): string | null {
  return resolveImportTargets(source, fromFile, allFiles, ctx)[0] ?? null;
}

/** Resolve an import to all matching file paths. A Go package import maps to
    every source file in that package directory, so this can return several. */
export function resolveImportTargets(
  source: string,
  fromFile: string,
  allFiles: Map<string, string>,
  ctx?: ResolverContext,
): string[] {
  // 1. Relative / absolute imports
  if (source.startsWith('.') || source.startsWith('/')) {
    const fromDir = path.dirname(fromFile);
    const resolved = path.normalize(path.join(fromDir, source)).replace(/\\/g, '/');
    const hit = matchFile(resolved, allFiles);
    return hit ? [hit] : [];
  }

  if (!ctx) return [];

  // 2. TS/JS path aliases (e.g. "@/components/Button")
  for (const alias of ctx.tsAliases) {
    if (!source.startsWith(alias.prefix)) continue;
    const rest = source.slice(alias.prefix.length);
    for (const target of alias.targets) {
      const candidate = path.posix.join(target, rest);
      const hit = matchFile(candidate, allFiles);
      if (hit) return [hit];
    }
  }

  // 3. Go module package imports → all .go files in the package directory
  for (const mod of ctx.goModules) {
    if (source !== mod.prefix && !source.startsWith(mod.prefix + '/')) continue;
    const rest = source.slice(mod.prefix.length).replace(/^\//, '');
    const pkgDir = [mod.root, rest].filter(Boolean).join('/');
    const targets: string[] = [];
    for (const f of allFiles.keys()) {
      if (f.endsWith('.go') && posixDirname(f) === pkgDir) targets.push(f);
    }
    if (targets.length > 0) return targets.sort();
  }

  return [];
}

/** Try a base path against the file map: exact, .js→.ts swap, extensions, index files. */
function matchFile(resolved: string, allFiles: Map<string, string>): string | null {
  const bases = [resolved];
  const stripped = resolved.replace(/\.(js|jsx|mjs|cjs)$/, '');
  if (stripped !== resolved) bases.push(stripped);

  for (const base of bases) {
    for (const ext of EXTENSIONS) {
      if (allFiles.has(base + ext)) return base + ext;
    }
  }
  for (const base of bases) {
    for (const indexFile of INDEX_FILES) {
      if (allFiles.has(base + '/' + indexFile)) return base + '/' + indexFile;
    }
  }
  return null;
}

function posixDirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

/** Build the resolver context by reading go.mod and tsconfig.json files. */
export function buildResolverContext(projectRoot: string, filePaths: string[]): ResolverContext {
  const goModules: Array<{ prefix: string; root: string }> = [];
  const tsAliases: Array<{ prefix: string; targets: string[] }> = [];

  // Candidate config locations: repo root + each top-level directory.
  const dirs = new Set<string>(['']);
  for (const f of filePaths) {
    const top = f.split('/')[0];
    if (top && f.includes('/')) dirs.add(top);
    // also second level (e.g. apps/web)
    const parts = f.split('/');
    if (parts.length > 2) dirs.add(parts.slice(0, 2).join('/'));
  }

  for (const dir of dirs) {
    const base = dir ? path.join(projectRoot, dir) : projectRoot;

    // go.mod → module prefix rooted at this dir
    const goMod = readText(path.join(base, 'go.mod'));
    if (goMod) {
      const m = goMod.match(/^module\s+(\S+)/m);
      if (m) goModules.push({ prefix: m[1], root: dir });
    }

    // tsconfig.json / jsconfig.json → baseUrl + paths
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
      const cfg = readJsonLoose(path.join(base, name));
      const opts = cfg?.compilerOptions;
      if (!opts) continue;
      const baseUrl = typeof opts.baseUrl === 'string' ? opts.baseUrl : '.';
      const aliasBase = (rel: string) => normalizeRel(path.posix.join(dir, baseUrl, rel));
      const paths = opts.paths;
      if (paths && typeof paths === 'object') {
        for (const [key, vals] of Object.entries(paths)) {
          if (!Array.isArray(vals)) continue;
          const prefix = key.replace(/\*$/, '');
          const targets = (vals as string[])
            .filter(v => typeof v === 'string')
            .map(v => aliasBase(v.replace(/\*$/, '')));
          if (targets.length > 0) tsAliases.push({ prefix, targets });
        }
      }
    }
  }

  // Longest prefixes first so "@/foo" beats a shorter "@/" if both exist.
  tsAliases.sort((a, b) => b.prefix.length - a.prefix.length);
  goModules.sort((a, b) => b.prefix.length - a.prefix.length);
  return { goModules, tsAliases };
}

function normalizeRel(p: string): string {
  return p.replace(/^\.\//, '').replace(/\/$/, '').replace(/\\/g, '/');
}
function readText(p: string): string | undefined {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return undefined; }
}
function readJsonLoose(p: string): any {
  const raw = readText(p);
  if (!raw) return undefined;
  // tsconfig allows comments + trailing commas; strip them best-effort.
  const cleaned = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,(\s*[}\]])/g, '$1');
  try { return JSON.parse(cleaned); } catch { return undefined; }
}

/** Build the import dependency graph */
export function buildImportGraph(
  parsedFiles: ParsedFile[],
  layerMap: Map<string, ArchLayer>,
  ctx?: ResolverContext
): DependencyGraph {
  // Build file lookup
  const fileMap = new Map<string, string>();
  for (const pf of parsedFiles) {
    fileMap.set(pf.entry.path, pf.entry.path);
  }

  const edges: ImportEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  // Initialize nodes
  for (const pf of parsedFiles) {
    const exportedSymbols = pf.symbols.filter(s => s.exported).map(s => s.name);
    nodeMap.set(pf.entry.path, {
      id: pf.entry.path,
      type: 'file',
      layer: layerMap.get(pf.entry.path) || 'unknown',
      symbols: exportedSymbols,
      centrality: { degree: 0, betweenness: 0 },
    });
  }

  // Build edges
  const seenEdge = new Set<string>();
  for (const pf of parsedFiles) {
    for (const imp of pf.imports) {
      const targets = resolveImportTargets(imp.source, pf.entry.path, fileMap, ctx);
      for (const resolvedTarget of targets) {
        if (resolvedTarget === pf.entry.path) continue; // no self-edges
        const key = pf.entry.path + '\0' + resolvedTarget;
        if (seenEdge.has(key)) continue;
        seenEdge.add(key);
        edges.push({
          source: pf.entry.path,
          target: resolvedTarget,
          symbols: imp.symbols,
          type: 'import',
        });
      }
    }
  }

  // Calculate degree centrality
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const edge of edges) {
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  for (const [id, node] of nodeMap) {
    node.centrality.degree = (inDegree.get(id) || 0) + (outDegree.get(id) || 0);
    // Simple betweenness approximation based on connections
    node.centrality.betweenness = (inDegree.get(id) || 0) * (outDegree.get(id) || 0) / Math.max(edges.length, 1);
  }

  // Collect layers
  const layers: Record<string, string[]> = {};
  for (const [filePath, layer] of layerMap) {
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push(filePath);
  }

  // Detect boundary violations
  const boundaries = detectBoundaries(edges, layerMap);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    nodes: Array.from(nodeMap.values()),
    edges,
    layers: layers as Record<ArchLayer, string[]>,
    boundaries,
  };
}

/** Detect layer boundary rules and violations */
function detectBoundaries(edges: ImportEdge[], layerMap: Map<string, ArchLayer>): LayerBoundary[] {
  const boundaryCount = new Map<string, { allowed: number; total: number }>();

  // Standard allowed boundaries (higher can import lower, not vice versa)
  const layerOrder: Record<string, number> = {
    api: 0, controller: 0,
    service: 1,
    data: 2, model: 2,
    utility: 3, config: 3,
    ui: 0,
    test: -1,
    unknown: -1,
  };

  for (const edge of edges) {
    const sourceLayer = layerMap.get(edge.source) || 'unknown';
    const targetLayer = layerMap.get(edge.target) || 'unknown';

    if (sourceLayer === 'unknown' || targetLayer === 'unknown') continue;
    if (sourceLayer === targetLayer) continue;

    const key = `${sourceLayer}->${targetLayer}`;
    if (!boundaryCount.has(key)) {
      boundaryCount.set(key, { allowed: 0, total: 0 });
    }

    const entry = boundaryCount.get(key)!;
    entry.total++;

    const sourceOrder = layerOrder[sourceLayer] ?? -1;
    const targetOrder = layerOrder[targetLayer] ?? -1;

    // Higher layer (lower number) importing lower layer (higher number) is fine
    if (sourceOrder <= targetOrder) {
      entry.allowed++;
    }
  }

  const boundaries: LayerBoundary[] = [];
  for (const [key, counts] of boundaryCount) {
    const [from, to] = key.split('->') as [ArchLayer, ArchLayer];
    const violations = counts.total - counts.allowed;
    boundaries.push({
      from,
      to,
      allowed: violations === 0,
      violations,
    });
  }

  return boundaries;
}

/** Detect circular dependencies */
export function detectCircularDeps(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const adjacency = new Map<string, string[]>();

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of (adjacency.get(node) || [])) {
      dfs(neighbor);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of adjacency.keys()) {
    dfs(node);
  }

  return cycles;
}

/** Find hub files (high centrality) */
export function findHubFiles(graph: DependencyGraph, threshold: number = 8): GraphNode[] {
  return graph.nodes
    .filter(n => n.centrality.degree >= threshold)
    .sort((a, b) => b.centrality.degree - a.centrality.degree);
}
