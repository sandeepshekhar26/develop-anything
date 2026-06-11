// ============================================================
// auk — AI Context Engineering Platform
// Call graph builder — symbol-level nodes and call edges built
// from tree-sitter call sites. Resolution is purely structural
// (same-file symbols, then imported symbols); no type inference.
// Output is sorted for byte-stable serialization.
// ============================================================

import type { CallEdge, ParsedFile, SymbolNode } from '../types/analysis.js';
import { resolveImport, type ResolverContext } from './import-graph.js';

const CALL_KIND: Record<string, CallEdge['kind']> = {
  call: 'call',
  new: 'instantiation',
  extends: 'inherits',
  implements: 'implements',
};

const NODE_KINDS = new Set(['function', 'class', 'method', 'interface']);

export interface CallGraph {
  symbols: SymbolNode[];
  callEdges: CallEdge[];
}

export function buildCallGraph(parsedFiles: ParsedFile[], ctx?: ResolverContext): CallGraph {
  const fileMap = new Map<string, string>();
  for (const pf of parsedFiles) fileMap.set(pf.entry.path, pf.entry.path);

  // Symbol nodes + per-file name lookup
  const nodes = new Map<string, SymbolNode>();
  const byFileAndName = new Map<string, string>();   // "file|name" → symbol id
  for (const pf of parsedFiles) {
    for (const sym of pf.symbols) {
      if (!NODE_KINDS.has(sym.type)) continue;
      const qualified = sym.parentSymbol ? `${sym.parentSymbol}.${sym.name}` : sym.name;
      const id = `${pf.entry.path}#${qualified}`;
      if (nodes.has(id)) continue;
      const node: SymbolNode = {
        id,
        file: pf.entry.path,
        name: qualified,
        kind: sym.type as SymbolNode['kind'],
        exported: sym.exported,
        line: sym.line,
        metrics: { fanIn: 0, fanOut: 0 },
      };
      if (sym.endLine !== undefined) node.endLine = sym.endLine;
      if (sym.bodySize !== undefined) node.metrics.bodySize = sym.bodySize;
      if (sym.complexityHint !== undefined) node.metrics.complexity = sym.complexityHint;
      nodes.set(id, node);
      byFileAndName.set(`${pf.entry.path}|${qualified}`, id);
      // also allow bare-name lookup for methods called unqualified
      if (!byFileAndName.has(`${pf.entry.path}|${sym.name}`)) {
        byFileAndName.set(`${pf.entry.path}|${sym.name}`, id);
      }
    }
  }

  // Imported-name → target file resolution per file
  const importTargets = new Map<string, Map<string, { file: string; isNamespace: boolean }>>();
  for (const pf of parsedFiles) {
    const map = new Map<string, { file: string; isNamespace: boolean }>();
    for (const imp of pf.imports) {
      const target = resolveImport(imp.source, pf.entry.path, fileMap, ctx);
      if (!target) continue;
      for (const name of imp.symbols) map.set(name, { file: target, isNamespace: imp.isNamespace });
    }
    importTargets.set(pf.entry.path, map);
  }

  // Edges
  const edges: CallEdge[] = [];
  for (const pf of parsedFiles) {
    const imports = importTargets.get(pf.entry.path)!;
    for (const call of pf.calls ?? []) {
      const sourceId = `${pf.entry.path}#${call.caller || '<module>'}`;
      const root = call.calleeRoot ?? call.callee;
      const member = call.calleeRoot ? call.callee.slice(call.calleeRoot.length + 1) : call.callee;

      let targetId: string | null =
        byFileAndName.get(`${pf.entry.path}|${call.callee}`) ?? null;

      if (!targetId) {
        const imp = imports.get(root);
        if (imp) {
          targetId = imp.isNamespace || call.calleeRoot
            ? byFileAndName.get(`${imp.file}|${member}`) ?? null
            : byFileAndName.get(`${imp.file}|${call.callee}`) ?? null;
        }
      }

      edges.push({
        source: sourceId,
        target: targetId ?? `external:${call.callee}`,
        kind: CALL_KIND[call.kind],
        line: call.line,
        resolved: targetId !== null,
      });
    }
  }

  // Metrics: fan-in counts resolved inbound edges; fan-out counts all outbound
  for (const edge of edges) {
    const src = nodes.get(edge.source);
    if (src) src.metrics.fanOut++;
    if (edge.resolved) {
      const tgt = nodes.get(edge.target);
      if (tgt && edge.source !== edge.target) tgt.metrics.fanIn++;
    }
  }

  const symbols = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.line - b.line);
  return { symbols, callEdges: edges };
}

/** Symbols with the highest resolved fan-in (call hotspots) */
export function findHotspots(graph: CallGraph, threshold = 10): SymbolNode[] {
  return graph.symbols
    .filter(s => s.metrics.fanIn >= threshold && (s.kind === 'function' || s.kind === 'method'))
    .sort((a, b) => b.metrics.fanIn - a.metrics.fanIn || a.id.localeCompare(b.id));
}

/** Classes with too many methods or too much inbound traffic */
export function findGodClasses(graph: CallGraph, methodThreshold = 15, fanInThreshold = 20): Array<{ cls: SymbolNode; methodCount: number; totalFanIn: number }> {
  const methodsByClass = new Map<string, SymbolNode[]>();
  for (const sym of graph.symbols) {
    if (sym.kind !== 'method') continue;
    const clsName = sym.name.split('.')[0];
    const key = `${sym.file}#${clsName}`;
    if (!methodsByClass.has(key)) methodsByClass.set(key, []);
    methodsByClass.get(key)!.push(sym);
  }
  const out: Array<{ cls: SymbolNode; methodCount: number; totalFanIn: number }> = [];
  for (const sym of graph.symbols) {
    if (sym.kind !== 'class') continue;
    const methods = methodsByClass.get(sym.id) ?? [];
    const totalFanIn = methods.reduce((n, m) => n + m.metrics.fanIn, sym.metrics.fanIn);
    if (methods.length >= methodThreshold || totalFanIn >= fanInThreshold) {
      out.push({ cls: sym, methodCount: methods.length, totalFanIn });
    }
  }
  return out.sort((a, b) => b.totalFanIn - a.totalFanIn || a.cls.id.localeCompare(b.cls.id));
}

/** Longest resolved call chain length (cycle-safe) */
export function maxCallDepth(graph: CallGraph): number {
  const adj = new Map<string, string[]>();
  for (const e of graph.callEdges) {
    if (!e.resolved || e.kind !== 'call') continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  const memo = new Map<string, number>();
  const inStack = new Set<string>();
  function depth(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    if (inStack.has(id)) return 0;
    inStack.add(id);
    let best = 0;
    for (const next of adj.get(id) ?? []) best = Math.max(best, depth(next));
    inStack.delete(id);
    memo.set(id, best + 1);
    return best + 1;
  }
  let max = 0;
  for (const id of adj.keys()) max = Math.max(max, depth(id));
  return max;
}
