// ============================================================
// auk — AI Context Engineering Platform
// File system scanner with gitignore support
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { FileEntry, Language } from '../types/analysis.js';
import type { AukConfig } from '../types/config.js';
import { hashFile, detectLanguage, matchesGlob, getFileSize } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';

/** Load and parse .gitignore patterns */
function loadGitignore(root: string): string[] {
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];
  const content = fs.readFileSync(gitignorePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      // Convert gitignore pattern to glob
      if (line.endsWith('/')) return line + '**';
      if (!line.includes('/') && !line.includes('*')) return '**/' + line;
      return line;
    });
}

/** Should this file be excluded? */
function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  return matchesGlob(relativePath, excludePatterns);
}

/** Scan a directory tree and return all source files */
export async function scanDirectory(
  root: string,
  config: AukConfig
): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  const gitignorePatterns = loadGitignore(root);
  const allExclude = [...config.analysis.exclude, ...gitignorePatterns];
  let skipped = 0;

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, '/');

      // Skip excluded paths
      if (shouldExclude(relPath, allExclude)) {
        skipped++;
        continue;
      }

      // Skip hidden dirs (except .github, .cursor, etc.)
      if (entry.name.startsWith('.') && entry.isDirectory() &&
          !['github', 'cursor', 'vscode'].some(n => entry.name === `.${n}`)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const lang = detectLanguage(fullPath) as Language;
        const size = getFileSize(fullPath);

        // Skip very large files (>1MB) and binary files
        if (size > 1024 * 1024 || size === 0) continue;

        // Only include source code files and select config files
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        const sourceExts = new Set([
          'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
          'py', 'go', 'java', 'rs', 'rb', 'php', 'cs',
          'c', 'cpp', 'h', 'hpp', 'swift', 'kt', 'scala',
        ]);

        if (!sourceExts.has(ext)) continue;

        // Check max files limit
        if (files.length >= config.analysis.maxFiles) continue;

        files.push({
          path: relPath,
          absolutePath: fullPath,
          language: lang,
          size,
          hash: hashFile(fullPath),
        });
      }
    }
  }

  walk(root);
  logger.debug(`Scanned: ${files.length} source files (${skipped} excluded)`);
  return files;
}

/** Get file stats summary */
export function getFileSummary(files: FileEntry[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const file of files) {
    summary[file.language] = (summary[file.language] || 0) + 1;
  }
  return summary;
}
