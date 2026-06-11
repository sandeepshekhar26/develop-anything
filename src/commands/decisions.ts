// ============================================================
// auk — AI Context Engineering Platform
// `auk decisions` — decision tracker & archaeology
// ============================================================

import { Command } from '../utils/cli.js';
import { loadConfig, loadYaml } from '../utils/config.js';
import type { RulesFile } from '../types/rules.js';
import { discoverDecisions } from '../decisions/decision-extractor.js';
import { loadDecisions, mergeDecisions } from '../decisions/decision-store.js';
import { printTimeline, printDecisionDetail } from '../decisions/timeline-renderer.js';
import { logger } from '../utils/logger.js';

export const decisionsCommand = new Command('decisions')
  .description('Track architectural decisions and their history')
  .option('--discover', 'Mine git history for decisions')
  .option('--timeline', 'Show decision evolution timeline')
  .option('--show <id>', 'Show details for a specific decision')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    logger.printBanner();

    if (options.discover) {
      // Mine git history
      logger.info('Mining git history for architectural decisions...');

      const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
      const rules = rulesFile?.rules || [];

      const discovered = discoverDecisions(rules, projectRoot);
      logger.success(`Found ${discovered.length} decisions`);

      await mergeDecisions(discovered, projectRoot);

      // Show timeline
      const data = await loadDecisions(projectRoot);
      printTimeline(data);
      return;
    }

    if (options.show) {
      const data = await loadDecisions(projectRoot);
      const decision = data.decisions.find(d => d.id === options.show || d.id.includes(options.show));
      if (decision) {
        printDecisionDetail(decision);
      } else {
        logger.warn(`Decision "${options.show}" not found`);
      }
      return;
    }

    if (options.timeline) {
      const data = await loadDecisions(projectRoot);
      printTimeline(data);
      return;
    }

    // Default: show all decisions
    const data = await loadDecisions(projectRoot);
    if (data.decisions.length === 0) {
      logger.info('No decisions tracked yet. Run `auk decisions --discover` to find them.');
      return;
    }
    printTimeline(data);
  });
