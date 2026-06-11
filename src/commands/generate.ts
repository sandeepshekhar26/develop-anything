// ============================================================
// auk — AI Context Engineering Platform
// `auk generate` — analyze codebase and generate rules
// ============================================================

import * as path from 'path';
import { Command } from '../utils/cli.js';
import { loadConfig, loadYaml, saveYaml, saveJson, ensureAukDir } from '../utils/config.js';
import { preserveEnhancements } from '../generator/enhancement-validator.js';
import { emitPrompts } from '../generator/prompt-emitter.js';
import type { RulesFile } from '../types/rules.js';
import { scanDirectory } from '../analyzer/scanner.js';
import { parseFiles } from '../analyzer/parser.js';
import { classifyFiles, buildLayerMap } from '../analyzer/layer-detector.js';
import { buildImportGraph, detectCircularDeps, buildResolverContext } from '../analyzer/import-graph.js';
import { buildCallGraph } from '../analyzer/call-graph.js';
import { minePatterns, detectStructuralClusters } from '../analyzer/pattern-miner.js';
import { TfidfProvider } from '../semantic/similarity.js';
import { synthesizeRules } from '../generator/rule-synthesizer.js';
import { compileRules } from '../compiler/compiler-engine.js';
import type { AnalysisResult } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

export const generateCommand = new Command('generate')
  .description('Analyze your codebase and generate context rules')
  .option('--compile', 'Also compile rules to all targets after generating', true)
  .option('--no-compile', 'Skip compilation step')
  .option('--emit-prompts', 'Also write LLM enhancement prompts to .auk/prompts/')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    logger.printBanner();
    ensureAukDir(projectRoot);

    // Step 1: Scan
    logger.step(1, 5, 'Scanning project files...');
    const files = await scanDirectory(projectRoot, config);
    logger.success(`Found ${files.length} source files`);

    if (files.length === 0) {
      logger.warn('No source files found. Check your exclude patterns in .auk/config.yaml');
      return;
    }

    // Step 2: Parse
    logger.step(2, 5, 'Parsing source code...');
    const parsedFiles = await parseFiles(files, path.join(projectRoot, '.auk', 'cache.json'));
    const totalSymbols = parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0);
    const totalImports = parsedFiles.reduce((sum, f) => sum + f.imports.length, 0);
    logger.success(`Extracted ${totalSymbols} symbols, ${totalImports} imports`);

    // Step 3: Analyze architecture
    logger.step(3, 5, 'Analyzing architecture...');
    const layerClassifications = classifyFiles(parsedFiles);
    const layerMap = buildLayerMap(layerClassifications);
    const resolverCtx = buildResolverContext(projectRoot, files.map(f => f.path));
    const graph = buildImportGraph(parsedFiles, layerMap, resolverCtx);
    const cycles = detectCircularDeps(graph);

    if (cycles.length > 0) {
      logger.warn(`Found ${cycles.length} circular dependencies`);
    }

    // Symbol-level call graph (v2)
    const callGraph = buildCallGraph(parsedFiles, resolverCtx);
    graph.version = 2;
    graph.symbols = callGraph.symbols;
    graph.callEdges = callGraph.callEdges;
    const tsCount = parsedFiles.filter(f => f.parserUsed === 'tree-sitter').length;
    graph.parserCoverage = { treeSitter: tsCount, regex: parsedFiles.length - tsCount };

    // Save graph
    saveJson('graph.json', graph, projectRoot);
    logger.success(`Built dependency graph: ${graph.nodes.length} files, ${graph.edges.length} import edges, ${callGraph.symbols.length} symbols, ${callGraph.callEdges.length} call edges`);

    // Step 4: Mine patterns
    logger.step(4, 5, 'Mining conventions and patterns...');
    const patterns = minePatterns(parsedFiles);

    // Semantic similarity index + structural clusters
    const semantic = new TfidfProvider();
    semantic.index(parsedFiles);
    saveJson('semantic.json', semantic.serialize(), projectRoot);
    const clusters = semantic.clusters();
    patterns.push(...detectStructuralClusters(parsedFiles, clusters));
    logger.success(`Discovered ${patterns.length} conventions${clusters.length > 0 ? ` (${clusters.length} structural clusters)` : ''}`);

    // Build analysis result
    const langBreakdown: Record<string, number> = {};
    const layerBreakdown: Record<string, number> = {};
    for (const f of files) {
      langBreakdown[f.language] = (langBreakdown[f.language] || 0) + 1;
    }
    for (const [, layer] of layerMap) {
      layerBreakdown[layer] = (layerBreakdown[layer] || 0) + 1;
    }

    const analysis: AnalysisResult = {
      scannedFiles: files,
      parsedFiles,
      graph,
      patterns,
      layers: layerClassifications,
      stats: {
        totalFiles: files.length,
        totalSymbols,
        totalImports,
        languageBreakdown: langBreakdown,
        layerBreakdown,
      },
    };

    // Step 5: Synthesize rules
    logger.step(5, 5, 'Synthesizing rules...');
    const previousRules = await loadYaml<RulesFile>('rules.yaml', projectRoot);
    const rulesFile = synthesizeRules(analysis, config.project.name || 'project', projectRoot);
    // carry LLM enhancements across regeneration (stale-marked if core changed)
    preserveEnhancements(previousRules, rulesFile);
    await saveYaml('rules.yaml', rulesFile, projectRoot);
    logger.success(`Generated ${rulesFile.rules.length} rules → .auk/rules.yaml`);

    if (options.emitPrompts) {
      const promptFiles = emitPrompts(rulesFile, projectRoot);
      if (promptFiles.length > 0) {
        logger.success(`Wrote ${promptFiles.length} enhancement prompt batch${promptFiles.length > 1 ? 'es' : ''} → .auk/prompts/`);
        logger.info('Let your agent do the deep pass: run `/auk:enhance` in Claude Code, or point any agent at .auk/prompts/.');
      }
    }

    // Optional: Compile
    if (options.compile) {
      console.log();
      logger.header('Compiling to agent formats');
      await compileRules(projectRoot, config);
    }

    // Summary
    console.log();
    logger.header('Summary');
    logger.keyValue('Files Scanned', files.length);
    logger.keyValue('Symbols Found', totalSymbols);
    logger.keyValue('Import Edges', graph.edges.length);
    logger.keyValue('Patterns Mined', patterns.length);
    logger.keyValue('Rules Generated', rulesFile.rules.length);
    logger.keyValue('Health Score', `${rulesFile.healthScore}%`);

    if (cycles.length > 0) {
      logger.keyValue('Circular Deps', `${cycles.length} ⚠️`);
    }

    console.log();
    logger.success('Generation complete! Your AI agents now understand your codebase.');
    console.log();
  });
