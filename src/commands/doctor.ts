// ============================================================
// auk — AI Context Engineering Platform
// `auk doctor` — full health check
// ============================================================

import { Command } from '../utils/cli.js';
import { logger } from '../utils/logger.js';

export const doctorCommand = new Command('doctor')
  .description('Full health check — generate + verify + review in one pass')
  .action(async () => {
    const projectRoot = process.cwd();

    logger.printBanner();
    logger.header('Running Full Health Check');
    console.log();

    // Import commands dynamically to avoid circular deps
    const { generateCommand } = await import('./generate.js');
    const { verifyCommand } = await import('./verify.js');

    logger.info('Step 1: Generating rules...');
    await generateCommand.parseAsync(['generate', '--no-compile'], { from: 'user' });

    console.log();
    logger.info('Step 2: Verifying rules...');
    await verifyCommand.parseAsync(['verify'], { from: 'user' });

    console.log();
    logger.success('Health check complete!');
    console.log();
  });
