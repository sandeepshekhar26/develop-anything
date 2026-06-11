// ============================================================
// auk — AI Context Engineering Platform
// Import/Export dependency graph builder
// ============================================================

import * as path from 'path';
import type { ParsedFile, ImportEdge, GraphNode, DependencyGraph, ArchLayer, LayerBoundary } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

/** Resolve an import source to a file path */
function resolveImport(source: string, fromFile: string, allFiles: Map<string, string>): string | null {
  // Skip external packages
  if (!source.startsWith('.') && !source.startsWith('/')) return null;

  const fromDir = path.dirname(fromFile);
  const resolved = path.normalize(path.join(fromDir, source)).replace(/\\/g, '/');

  // ESM TypeScript convention: `./foo.js` on disk is `./foo.ts`
  const bases = [resolved];
  const stripped = resolved.replace(/\.(js|jsx|mjs|cjs)$/, '');
  if (stripped !== resolved) bases.push(stripped);

  // Try exact match, then with extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.php'];
  for (const base of bases) {
    for (const ext of extensions) {
      const candidate = base + ext;
      if (allFiles.has(candidate)) return candidate;
    }
  }

  // Try index files
  for (const base of bases) {
    for (const indexFile of ['index.ts', 'index.js', 'index.tsx', '__init__.py', 'mod.rs']) {
      const candidate = base + '/' + indexFile;
      if (allFiles.has(candidate)) return candidate;
    }
  }

  return null;
}

/** Build the import dependency graph */
export function buildImportGraph(
  parsedFiles: ParsedFile[],
  layerMap: Map<string, ArchLayer>
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
  for (const pf of parsedFiles) {
    for (const imp of pf.imports) {
      const resolvedTarget = resolveImport(imp.source, pf.entry.path, fileMap);
      if (resolvedTarget) {
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
