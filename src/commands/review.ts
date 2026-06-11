// ============================================================
// auk — AI Context Engineering Platform
// `auk review` — architectural PR review
// ============================================================

import { Command } from '../utils/cli.js';
import { loadConfig, loadJson, loadYaml } from '../utils/config.js';
import { gitOps } from '../utils/git.js';
import { parseDiff } from '../reviewer/diff-parser.js';
import { overlayDiffOnGraph } from '../reviewer/graph-overlay.js';
import { detectViolations } from '../reviewer/violation-detector.js';
import { suggestPatterns } from '../reviewer/pattern-suggester.js';
import { printReviewReport, generateMarkdownReview } from '../reviewer/review-reporter.js';
import type { DependencyGraph } from '../types/analysis.js';
import type { RulesFile } from '../types/rules.js';
import type { ReviewResult } from '../types/review.js';
import { logger } from '../utils/logger.js';
import { writeFileWithDir } from '../utils/file-utils.js';
import * as path from 'path';

export const reviewCommand = new Command('review')
  .description('Review architectural impact of code changes')
  .option('--diff <ref>', 'Compare against a git ref (branch/commit)')
  .option('--ci', 'CI mode — exit code 1 on violations')
  .option('--markdown', 'Output markdown report')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    logger.printBanner();

    // Get diff
    let diffOutput: string;
    const diffBase = options.diff || 'staged';

    if (options.diff) {
      diffOutput = gitOps.getDiffBetween(options.diff, 'HEAD', projectRoot);
    } else {
      // Review staged changes by default
      diffOutput = gitOps.getDiff(undefined, projectRoot);
      if (!diffOutput) {
        // Fall back to last commit
        diffOutput = gitOps.getDiff('HEAD~1', projectRoot);
      }
    }

    if (!diffOutput) {
      logger.info('No changes to review.');
      return;
    }

    // Parse diff
    const diffFiles = parseDiff(diffOutput);
    logger.info(`Reviewing ${diffFiles.length} changed files...`);

    // Load graph
    const graph = loadJson<DependencyGraph>('graph.json', projectRoot);
    if (!graph) {
      logger.warn('No dependency graph found. Run `auk generate` first for full review.');
    }

    // Load rules
    const rules = await loadYaml<RulesFile>('rules.yaml', projectRoot);

    // Overlay diff on graph
    const { newEdges, complexityChanges } = graph
      ? overlayDiffOnGraph(diffFiles, graph)
      : { newEdges: [], complexityChanges: [] };

    // Detect violations
    let violations = detectViolations(diffFiles, newEdges, complexityChanges, graph!, rules || undefined);

    // Suggest patterns
    if (graph) {
      violations = suggestPatterns(violations, graph);
    }

    // Build result
    const result: ReviewResult = {
      timestamp: new Date().toISOString(),
      diffBase,
      totalFilesChanged: diffFiles.length,
      violations,
      complexityChanges,
      newEdges,
      summary: {
        clean: Math.max(0, diffFiles.length - violations.length),
        suggestions: violations.filter(v => v.severity === 'suggestion').length,
        warnings: violations.filter(v => v.severity === 'warning').length,
        violations: violations.filter(v => v.severity === 'violation').length,
      },
    };

    // Output
    if (options.markdown) {
      const md = generateMarkdownReview(result);
      const outPath = path.join(projectRoot, '.auk', 'review.md');
      writeFileWithDir(outPath, md);
      logger.success(`Markdown report saved to .auk/review.md`);
    } else {
      printReviewReport(result);
    }

    // CI mode
    if (options.ci && result.summary.violations > 0) {
      process.exit(1);
    }
  });
