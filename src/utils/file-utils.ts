// ============================================================
// auk — AI Context Engineering Platform
// File system utilities
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** Compute SHA-256 hash of file content */
export function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/** Read file content safely */
export function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Write file with directory creation */
export function writeFileWithDir(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

/** Get file extension without dot */
export function getExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

/** Check if a path matches any of the given glob patterns */
export function matchesGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Simple glob matching: ** matches any path, * matches filename chars
    const regex = pattern
      .replace(/\*\*/g, '⁂')
      .replace(/\*/g, '[^/]*')
      .replace(/⁂/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(filePath);
  });
}

/** Get relative path from project root */
export function relativePath(filePath: string, root: string = process.cwd()): string {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

/** Determine language from file extension */
export function detectLanguage(filePath: string): string {
  const ext = getExtension(filePath);
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    go: 'go',
    java: 'java',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    cs: 'csharp',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    proto: 'protobuf',
    tf: 'terraform',
    hcl: 'terraform',
  };
  return langMap[ext] || 'unknown';
}

/** Check if a file is a source code file (not config/docs) */
export function isSourceFile(filePath: string): boolean {
  const sourceExts = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
    'py', 'go', 'java', 'rs', 'rb', 'php', 'cs',
    'c', 'cpp', 'h', 'hpp', 'swift', 'kt', 'scala',
  ]);
  return sourceExts.has(getExtension(filePath));
}

/** Get the size of a file in bytes */
export function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/** Check if file exists */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
