// ============================================================
// auk — AI Context Engineering Platform
// `auk verify` — context rot detection
// ============================================================

import { Command } from '../utils/cli.js';
import { loadConfig, loadYaml } from '../utils/config.js';
import { scanDirectory } from '../analyzer/scanner.js';
import { parseFiles } from '../analyzer/parser.js';
import type { RulesFile } from '../types/rules.js';
import { extractAllClaims } from '../verifier/claim-extractor.js';
import { verifyAllClaims } from '../verifier/claim-verifier.js';
import { calculateHealthScore } from '../verifier/health-scorer.js';
import { printHealthReport } from '../verifier/report-generator.js';
import { saveJson } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export const verifyCommand = new Command('verify')
  .description('Verify that context rules are still valid (detect context rot)')
  .option('--ci', 'CI mode — exit code 1 on violations')
  .option('--quick', 'Quick mode — only check critical rules')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    logger.printBanner();

    // Load rules
    const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
    if (!rulesFile || !rulesFile.rules || rulesFile.rules.length === 0) {
      logger.warn('No rules found. Run `auk generate` first.');
      process.exit(1);
    }

    let rules = rulesFile.rules;
    if (options.quick) {
      rules = rules.filter(r => r.severity === 'critical');
      logger.info(`Quick mode: checking ${rules.length} critical rules`);
    }

    // Scan and parse
    const progress = logger.createProgress('Scanning and parsing codebase...');
    const files = await scanDirectory(projectRoot, config);
    const parsedFiles = parseFiles(files);
    progress.stop(`Parsed ${files.length} files`);

    // Extract and verify claims
    const claims = extractAllClaims(rules);
    logger.info(`Verifying ${claims.length} claims across ${rules.length} rules...`);

    const results = verifyAllClaims(claims, parsedFiles, projectRoot, config);
    const report = calculateHealthScore(results);

    // Save health report
    saveJson('health.json', report, projectRoot);

    // Print report
    printHealthReport(report);

    // CI mode exit code
    if (options.ci && report.violated > 0) {
      logger.error(`${report.violated} rules violated — failing CI check`);
      process.exit(1);
    }
  });
