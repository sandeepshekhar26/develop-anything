// ============================================================
// auk — AI Context Engineering Platform
// `auk compile` — compile rules to all agent formats
// ============================================================

import { Command } from '../utils/cli.js';
import { loadConfig } from '../utils/config.js';
import { compileRules } from '../compiler/compiler-engine.js';
import type { CompilerTargetName } from '../types/config.js';
import { logger } from '../utils/logger.js';

export const compileCommand = new Command('compile')
  .description('Compile rules.yaml to all enabled agent formats')
  .option('--targets <targets>', 'Comma-separated list of targets', (v: string) => v.split(',') as CompilerTargetName[])
  .option('--dry-run', 'Preview output without writing files')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const config = await loadConfig(projectRoot);

    logger.printBanner();
    logger.header('Compiling Rules');

    const outputs = await compileRules(projectRoot, config, {
      dryRun: options.dryRun as boolean | undefined,
      targets: options.targets as CompilerTargetName[] | undefined,
    });

    if (outputs.size === 0) {
      logger.warn('No output generated. Run `auk generate` first.');
      return;
    }

    console.log();
    logger.success(`Compiled to ${outputs.size} target(s)`);
    console.log();
  });
