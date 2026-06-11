// ============================================================
// auk — Git hooks
// ============================================================

import { gitOps } from '../utils/git.js';
import { logger } from '../utils/logger.js';

/** Install post-commit hook */
export function installPostCommitHook(cwd?: string): boolean {
  const script = `#!/bin/sh
# auk post-commit hook — auto-verify context health
npx auk-dev verify --quick 2>/dev/null || true
`;
  return gitOps.installHook('post-commit', script, cwd);
}

/** Install pre-commit hook */
export function installPreCommitHook(cwd?: string): boolean {
  const script = `#!/bin/sh
# auk pre-commit hook — verify context before commit
npx auk-dev verify --ci --quick
`;
  return gitOps.installHook('pre-commit', script, cwd);
}
