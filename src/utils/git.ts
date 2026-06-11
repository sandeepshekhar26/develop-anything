// ============================================================
// auk — AI Context Engineering Platform
// Git operations helper
// ============================================================

import { execSync } from 'child_process';
import * as fs from 'fs';
import { logger } from './logger.js';

/** Execute a git command and return stdout */
function git(args: string, cwd?: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err: any) {
    logger.debug(`git ${args} failed: ${err.message}`);
    return '';
  }
}

/** Check if current directory is a git repository */
export function isGitRepo(cwd?: string): boolean {
  return git('rev-parse --is-inside-work-tree', cwd) === 'true';
}

/** Get the git root directory */
export function getGitRoot(cwd?: string): string {
  return git('rev-parse --show-toplevel', cwd);
}

/** Get the current branch name */
export function getCurrentBranch(cwd?: string): string {
  return git('rev-parse --abbrev-ref HEAD', cwd);
}

/** Get list of changed files since a ref */
export function getChangedFiles(since: string = 'HEAD~1', cwd?: string): string[] {
  const output = git(`diff --name-only ${since}`, cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

/** Get staged files */
export function getStagedFiles(cwd?: string): string[] {
  const output = git('diff --cached --name-only', cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

/** Get the unified diff output */
export function getDiff(ref?: string, cwd?: string): string {
  if (ref) {
    return git(`diff ${ref}`, cwd);
  }
  return git('diff --cached', cwd);
}

/** Get diff between two refs */
export function getDiffBetween(base: string, head: string = 'HEAD', cwd?: string): string {
  return git(`diff ${base}..${head}`, cwd);
}

/** Get git log entries */
export function getLog(
  file?: string,
  options: { limit?: number; format?: string } = {},
  cwd?: string
): string[] {
  const limit = options.limit || 50;
  const format = options.format || '%H|%an|%ae|%aI|%s';
  const fileArg = file ? ` -- "${file}"` : '';
  const output = git(`log -n ${limit} --format="${format}"${fileArg}`, cwd);
  return output ? output.split('\n').filter(Boolean) : [];
}

/** Get git blame for a file */
export function getBlame(file: string, cwd?: string): string {
  return git(`blame --porcelain "${file}"`, cwd);
}

/** Get the first commit that introduced a pattern in a file */
export function getFirstCommitWithPattern(file: string, pattern: string, cwd?: string): string {
  return git(`log --all -1 --format="%H|%an|%aI|%s" -S "${pattern}" -- "${file}"`, cwd);
}

/** Get all authors who modified a file */
export function getFileAuthors(file: string, cwd?: string): string[] {
  const output = git(`log --format="%an" -- "${file}"`, cwd);
  return [...new Set(output.split('\n').filter(Boolean))];
}

/** Get commit count per file */
export function getCommitCount(file: string, cwd?: string): number {
  const output = git(`log --oneline -- "${file}"`, cwd);
  return output ? output.split('\n').filter(Boolean).length : 0;
}

/** Install a git hook */
export function installHook(hookName: string, script: string, cwd?: string): boolean {
  const root = getGitRoot(cwd);
  if (!root) return false;

  const hookPath = `${root}/.git/hooks/${hookName}`;
  try {
    fs.writeFileSync(hookPath, script, { mode: 0o755 });
    return true;
  } catch {
    return false;
  }
}

export const gitOps = {
  isGitRepo,
  getGitRoot,
  getCurrentBranch,
  getChangedFiles,
  getStagedFiles,
  getDiff,
  getDiffBetween,
  getLog,
  getBlame,
  getFirstCommitWithPattern,
  getFileAuthors,
  getCommitCount,
  installHook,
};
