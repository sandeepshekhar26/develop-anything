// ============================================================
// auk — AI Context Engineering Platform
// `auk init` — first-time setup
// ============================================================

import { Command } from '../utils/cli.js';
import * as path from 'path';
import { ensureAukDir, saveConfig, isInitialized } from '../utils/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';
import type { AukConfig } from '../types/config.js';
import { gitOps } from '../utils/git.js';
import { logger } from '../utils/logger.js';
import { scanDirectory } from '../analyzer/scanner.js';
import { getFileSummary } from '../analyzer/scanner.js';

export const initCommand = new Command('init')
  .description('Initialize auk in your project')
  .option('--force', 'Overwrite existing configuration')
  .action(async (options) => {
    const projectRoot = process.cwd();

    if (isInitialized(projectRoot) && !options.force) {
      logger.warn('auk is already initialized. Use --force to reinitialize.');
      return;
    }

    logger.printBanner();
    logger.info('Initializing auk...');
    console.log();

    // Detect project info
    const projectName = path.basename(projectRoot);
    const isGit = gitOps.isGitRepo(projectRoot);

    logger.keyValue('Project', projectName);
    logger.keyValue('Git', isGit ? 'Yes' : 'No');

    // Quick scan to detect languages
    const config: AukConfig = { ...DEFAULT_CONFIG };
    config.project.name = projectName;
    config.project.root = projectRoot;

    const progress = logger.createProgress('Scanning project files...');
    const files = await scanDirectory(projectRoot, config);
    progress.stop(`Found ${files.length} source files`);

    const summary = getFileSummary(files);
    const detectedLangs = Object.entries(summary)
      .filter(([lang]) => lang !== 'unknown')
      .sort(([, a], [, b]) => b - a);

    if (detectedLangs.length > 0) {
      console.log();
      logger.info('Detected languages:');
      for (const [lang, count] of detectedLangs) {
        logger.keyValue(`  ${lang}`, `${count} files`);
      }
    }

    // Create .auk directory and save config
    ensureAukDir(projectRoot);
    await saveConfig(config, projectRoot);

    console.log();
    logger.success('auk initialized successfully!');
    console.log();
    logger.info('Next steps:');
    console.log('  1. Run `auk generate` to analyze your codebase and generate rules');
    console.log('  2. Run `auk compile` to output CLAUDE.md, AGENTS.md, etc.');
    console.log('  3. Run `auk verify` to check context health');
    console.log('  4. Run `auk review` to review architectural changes');
    console.log('  5. Run `auk decisions --discover` to find decision history');
    console.log();
  });
