// ============================================================
// auk — AI Context Engineering Platform
// Library Entry Point
//
// This module exposes auk's deterministic analysis engine as an
// importable library, separate from the CLI (`src/index.ts`).
// Importing this file has NO side effects — it never parses argv
// or runs a command. Downstream tools (e.g. family-pack) consume
// these exports to build on top of auk without forking it.
// ============================================================

import * as path from 'path';
import { loadConfig } from './utils/config.js';
import { scanDirectory } from './analyzer/scanner.js';
import { parseFiles } from './analyzer/parser.js';
import { classifyFiles, buildLayerMap } from './analyzer/layer-detector.js';
import {
  buildImportGraph,
  detectCircularDeps,
  buildResolverContext,
} from './analyzer/import-graph.js';
import { buildCallGraph, findGodClasses, findHotspots } from './analyzer/call-graph.js';
import { minePatterns, detectStructuralClusters } from './analyzer/pattern-miner.js';
import { TfidfProvider } from './semantic/similarity.js';
import type { AukConfig } from './types/config.js';
import type {
  AnalysisResult,
  DependencyGraph,
  DetectedPattern,
  FileEntry,
  LayerClassification,
  ParsedFile,
  SymbolNode,
} from './types/analysis.js';
import type { CallGraph } from './analyzer/call-graph.js';

// ----- Types -----------------------------------------------------------------

export * from './types/analysis.js';
export * from './types/rules.js';
export * from './types/review.js';
export * from './types/decisions.js';
export * from './types/config.js';

// ----- Low-level engine functions --------------------------------------------
// Re-exported so consumers can compose their own pipelines.

export { scanDirectory, getFileSummary } from './analyzer/scanner.js';
export { parseFiles } from './analyzer/parser.js';
export { parseFile } from './analyzer/parser.js';
export { classifyFiles, buildLayerMap } from './analyzer/layer-detector.js';
export {
  buildImportGraph,
  detectCircularDeps,
  buildResolverContext,
} from './analyzer/import-graph.js';
export {
  buildCallGraph,
  findGodClasses,
  findHotspots,
  maxCallDepth,
} from './analyzer/call-graph.js';
export type { CallGraph } from './analyzer/call-graph.js';
export { minePatterns, detectStructuralClusters } from './analyzer/pattern-miner.js';
export { TfidfProvider } from './semantic/similarity.js';

// Reviewer engine
export { detectViolations } from './reviewer/violation-detector.js';
export { parseDiff } from './reviewer/diff-parser.js';
export { overlayDiffOnGraph } from './reviewer/graph-overlay.js';

// Decision archaeology
export { discoverDecisions } from './decisions/decision-extractor.js';
export {
  findPatternOrigin,
  getFileHistory,
  findDecisionCommits,
  getAuthors,
  analyzePatternEvolution,
} from './decisions/git-archaeologist.js';

// Verify / rot engine
export { extractClaims, extractAllClaims } from './verifier/claim-extractor.js';
export { verifyClaim, verifyAllClaims } from './verifier/claim-verifier.js';
export { calculateHealthScore } from './verifier/health-scorer.js';

// Enhancement (no-API-key prompt batches)
export { emitPrompts, rulesNeedingEnhancement } from './generator/prompt-emitter.js';

// Config helpers
export { loadConfig, getAukDir, isInitialized } from './utils/config.js';

// ----- High-level convenience ------------------------------------------------

/** Everything a downstream tool needs from one deterministic pass. */
export interface ProjectAnalysis extends AnalysisResult {
  /** Symbol-level call graph (god-class / hotspot source). */
  callGraph: CallGraph;
  /** Import cycles, each a list of file paths forming the loop. */
  cycles: string[][];
  /** God-object candidates from the call graph. */
  godClasses: Array<{ cls: SymbolNode; methodCount: number; totalFanIn: number }>;
  /** High-fan-in hotspot symbols (high blast radius). */
  hotspots: SymbolNode[];
}

export interface AnalyzeOptions {
  /** Pre-loaded config; if omitted, loadConfig(root) is used. */
  config?: AukConfig;
  /** Method-count threshold for god classes (default 15). */
  godClassMethodThreshold?: number;
  /** Fan-in threshold for god classes (default 20). */
  godClassFanInThreshold?: number;
  /** Fan-in threshold for hotspots (default 10). */
  hotspotThreshold?: number;
}

/**
 * Run auk's full deterministic analysis on a project, in-process, with no
 * file writes. This mirrors the orchestration inside `auk generate` but
 * returns the structured result instead of persisting `.auk/` artifacts —
 * exactly what a library consumer wants.
 */
export async function analyzeProject(
  projectRoot: string,
  opts: AnalyzeOptions = {}
): Promise<ProjectAnalysis> {
  const config = opts.config ?? (await loadConfig(projectRoot));

  // 1. Scan + parse
  const files: FileEntry[] = await scanDirectory(projectRoot, config);
  const parsedFiles: ParsedFile[] = await parseFiles(
    files,
    path.join(projectRoot, '.auk', 'cache.json')
  );

  // 2. Architecture
  const layers: LayerClassification[] = classifyFiles(parsedFiles);
  const layerMap = buildLayerMap(layers);
  const resolverCtx = buildResolverContext(projectRoot, files.map((f) => f.path));
  const graph: DependencyGraph = buildImportGraph(parsedFiles, layerMap, resolverCtx);
  const cycles = detectCircularDeps(graph);

  // 3. Call graph (v2)
  const callGraph = buildCallGraph(parsedFiles, resolverCtx);
  graph.version = 2;
  graph.symbols = callGraph.symbols;
  graph.callEdges = callGraph.callEdges;
  const tsCount = parsedFiles.filter((f) => f.parserUsed === 'tree-sitter').length;
  graph.parserCoverage = { treeSitter: tsCount, regex: parsedFiles.length - tsCount };

  // 4. Patterns + semantic clusters
  const patterns: DetectedPattern[] = minePatterns(parsedFiles);
  const semantic = new TfidfProvider();
  semantic.index(parsedFiles);
  const clusters = semantic.clusters();
  patterns.push(...detectStructuralClusters(parsedFiles, clusters));

  // 5. Derived hotspots / god classes
  const godClasses = findGodClasses(
    callGraph,
    opts.godClassMethodThreshold ?? 15,
    opts.godClassFanInThreshold ?? 20
  );
  const hotspots = findHotspots(callGraph, opts.hotspotThreshold ?? 10);

  // Stats
  const langBreakdown: Record<string, number> = {};
  const layerBreakdown: Record<string, number> = {};
  for (const f of files) langBreakdown[f.language] = (langBreakdown[f.language] || 0) + 1;
  for (const [, layer] of layerMap) layerBreakdown[layer] = (layerBreakdown[layer] || 0) + 1;

  return {
    scannedFiles: files,
    parsedFiles,
    graph,
    patterns,
    layers,
    callGraph,
    cycles,
    godClasses,
    hotspots,
    stats: {
      totalFiles: files.length,
      totalSymbols: parsedFiles.reduce((s, f) => s + f.symbols.length, 0),
      totalImports: parsedFiles.reduce((s, f) => s + f.imports.length, 0),
      languageBreakdown: langBreakdown,
      layerBreakdown,
    },
  };
}
