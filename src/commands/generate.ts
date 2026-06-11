// ============================================================
// auk — AI Context Engineering Platform
// `auk generate` — analyze codebase and generate rules
// ============================================================

import { Command } from '../utils/cli.js';
import { loadConfig, saveYaml, saveJson, ensureAukDir } from '../utils/config.js';
import { scanDirectory } from '../analyzer/scanner.js';
import { parseFiles } from '../analyzer/parser.js';
import { classifyFiles, buildLayerMap } from '../analyzer/layer-detector.js';
import { buildImportGraph, detectCircularDeps } from '../analyzer/import-graph.js';
import { minePatterns } from '../analyzer/pattern-miner.js';
import { synthesizeRules } from '../generator/rule-synthesizer.js';
import { compileRules } from '../compiler/compiler-engine.js';
import type { AnalysisResult } from '../types/analysis.js';
import { logger } from '../utils/logger.js';

export const generateCommand = new Command('generate')
  .description('Analyze your codebase and generate context rules')
  .option('--compile', 'Also compile rules to all targets after generating', true)
  .option('--no-compile', 'Skip compilation step')
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
    const parsedFiles = parseFiles(files);
    const totalSymbols = parsedFiles.reduce((sum, f) => sum + f.symbols.length, 0);
    const totalImports = parsedFiles.reduce((sum, f) => sum + f.imports.length, 0);
    logger.success(`Extracted ${totalSymbols} symbols, ${totalImports} imports`);

    // Step 3: Analyze architecture
    logger.step(3, 5, 'Analyzing architecture...');
    const layerClassifications = classifyFiles(parsedFiles);
    const layerMap = buildLayerMap(layerClassifications);
    const graph = buildImportGraph(parsedFiles, layerMap);
    const cycles = detectCircularDeps(graph);

    if (cycles.length > 0) {
      logger.warn(`Found ${cycles.length} circular dependencies`);
    }

    // Save graph
    saveJson('graph.json', graph, projectRoot);
    logger.success(`Built dependency graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

    // Step 4: Mine patterns
    logger.step(4, 5, 'Mining conventions and patterns...');
    const patterns = minePatterns(parsedFiles);
    logger.success(`Discovered ${patterns.length} conventions`);

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
    const rulesFile = synthesizeRules(analysis, config.project.name || 'project');
    await saveYaml('rules.yaml', rulesFile, projectRoot);
    logger.success(`Generated ${rulesFile.rules.length} rules → .auk/rules.yaml`);

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
