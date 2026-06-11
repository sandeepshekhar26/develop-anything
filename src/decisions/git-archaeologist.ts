// ============================================================
// auk — AI Context Engineering Platform
// Git archaeologist — mines git history for decision origins
// ============================================================

import * as fs from 'fs';
import { gitOps } from '../utils/git.js';
import { logger } from '../utils/logger.js';

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

/** Parse a git log line into CommitInfo */
function parseLogLine(line: string): CommitInfo | null {
  const parts = line.split('|');
  if (parts.length < 4) return null;
  return {
    hash: parts[0].trim(),
    author: parts[1].trim(),
    date: parts[3]?.trim() || parts[2]?.trim() || '',
    message: parts[parts.length - 1].trim(),
  };
}

/** Find the first commit that introduced a pattern in a file */
export function findPatternOrigin(file: string, pattern: string, cwd?: string): CommitInfo | null {
  const result = gitOps.getFirstCommitWithPattern(file, pattern, cwd);
  if (!result) return null;
  return parseLogLine(result);
}

/** Get commit history for a file */
export function getFileHistory(file: string, limit: number = 20, cwd?: string): CommitInfo[] {
  const lines = gitOps.getLog(file, { limit }, cwd);
  return lines.map(parseLogLine).filter((c): c is CommitInfo => c !== null);
}

/** Find commits that mention architectural decisions */
export function findDecisionCommits(cwd?: string): CommitInfo[] {
  const prefixKeywords = ['refactor:', 'arch:', 'decision:', 'migrate:', 'adopt:'];
  const topicKeywords = [
    'architecture', 'convention', 'pattern', 'adopt', 'switch to',
    'replace', 'standardize', 'enforce', 'breaking change', 'deprecat', 'migrat',
  ];
  const allCommits = gitOps.getLog(undefined, { limit: 200 }, cwd);

  return allCommits
    .map(parseLogLine)
    .filter((c): c is CommitInfo => {
      if (!c) return false;
      const msg = c.message.toLowerCase();
      return prefixKeywords.some(k => msg.includes(k)) ||
             topicKeywords.some(k => msg.includes(k));
    });
}

/** Get all authors for a file */
export function getAuthors(file: string, cwd?: string): string[] {
  return gitOps.getFileAuthors(file, cwd);
}

/** Analyze how a pattern evolved over time (simplified) */
export function analyzePatternEvolution(
  files: string[],
  pattern: string,
  cwd?: string
): Array<{ date: string; matchCount: number; totalFiles: number }> {
  // Get recent commits that changed these files
  const commits = gitOps.getLog(undefined, { limit: 30, format: '%H|%aI' }, cwd);
  const snapshots: Array<{ date: string; matchCount: number; totalFiles: number }> = [];

  // For now, provide current state — full archaeology requires checkout per commit
  let matchCount = 0;
  let totalFiles = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      totalFiles++;
      if (content.includes(pattern)) matchCount++;
    } catch { /* skip */ }
  }

  snapshots.push({
    date: new Date().toISOString(),
    matchCount,
    totalFiles,
  });

  return snapshots;
}
