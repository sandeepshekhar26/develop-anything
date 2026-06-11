// ============================================================
// auk — AI Context Engineering Platform
// CLI Entry Point
//
// One command. Every AI coding tool understands your codebase.
// ============================================================

import { Command } from './utils/cli.js';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { verifyCommand } from './commands/verify.js';
import { compileCommand } from './commands/compile.js';
import { reviewCommand } from './commands/review.js';
import { decisionsCommand } from './commands/decisions.js';
import { doctorCommand } from './commands/doctor.js';
import { badgeCommand } from './commands/badge.js';
import { mcpCommand } from './commands/mcp.js';
import { setVerbose } from './utils/logger.js';

const program = new Command();

program
  .name('auk')
  .description('auk — The AI Context Engineering Platform. One command. Every AI coding tool understands your codebase.')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colored output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose) setVerbose(true);
  });

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(verifyCommand);
program.addCommand(compileCommand);
program.addCommand(reviewCommand);
program.addCommand(decisionsCommand);
program.addCommand(doctorCommand);
program.addCommand(badgeCommand);
program.addCommand(mcpCommand);

// Default action (no command) — show help
program.action(() => {
  program.help();
});

program.parse();
