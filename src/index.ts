// ============================================================
// auk — AI Context Engineering Platform
// CLI Entry Point
//
// One command. Every AI coding tool understands your codebase.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
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
import { enhanceCommand } from './commands/enhance.js';
import { graphCommand } from './commands/graph.js';
import { setVerbose } from './utils/logger.js';

/** Read the package version relative to this module (works in dist and dev). */
function readVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const rel of ['../package.json', '../../package.json']) {
    try {
      return JSON.parse(fs.readFileSync(path.join(here, rel), 'utf-8')).version || '0.0.0';
    } catch { /* try next */ }
  }
  return '0.0.0';
}

const program = new Command();

program
  .name('auk')
  .description('auk — The AI Context Engineering Platform. One command. Every AI coding tool understands your codebase.')
  .version(readVersion())
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
program.addCommand(enhanceCommand);
program.addCommand(graphCommand);

// Default action (no command) — show help
program.action(() => {
  program.help();
});

program.parse();
