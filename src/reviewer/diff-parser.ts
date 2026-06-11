// ============================================================
// auk — AI Context Engineering Platform
// Diff parser — parses git diffs into structured changes
// ============================================================

import type { DiffFile, DiffLine } from '../types/review.js';

/** Parse unified diff output into structured DiffFile objects */
export function parseDiff(diffOutput: string): DiffFile[] {
  const files: DiffFile[] = [];
  if (!diffOutput.trim()) return files;

  const fileSections = diffOutput.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split('\n');
    const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/);
    if (!headerMatch) continue;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];

    let status: DiffFile['status'] = 'modified';
    if (section.includes('new file mode')) status = 'added';
    if (section.includes('deleted file mode')) status = 'deleted';
    if (oldPath !== newPath) status = 'renamed';

    const addedLines: DiffLine[] = [];
    const removedLines: DiffLine[] = [];
    const addedImports: string[] = [];
    const removedImports: string[] = [];
    const addedSymbols: string[] = [];

    let currentLineNew = 0;
    let currentLineOld = 0;

    for (const line of lines) {
      // Hunk header
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLineOld = parseInt(hunkMatch[1]);
        currentLineNew = parseInt(hunkMatch[2]);
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        const content = line.slice(1);
        addedLines.push({ number: currentLineNew, content });
        currentLineNew++;

        // Detect new imports
        if (content.match(/^\s*import\s+/) || content.match(/^\s*from\s+/) ||
            content.match(/require\s*\(/) || content.match(/^\s*use\s+/)) {
          addedImports.push(content.trim());
        }

        // Detect new function/class definitions
        const funcMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
        const arrowMatch = content.match(/(?:export\s+)?(?:const|let)\s+(\w+)\s*=.*=>/);
        if (funcMatch) addedSymbols.push(funcMatch[1]);
        if (classMatch) addedSymbols.push(classMatch[1]);
        if (arrowMatch) addedSymbols.push(arrowMatch[1]);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const content = line.slice(1);
        removedLines.push({ number: currentLineOld, content });
        currentLineOld++;

        // Detect removed imports
        if (content.match(/^\s*import\s+/) || content.match(/^\s*from\s+/) ||
            content.match(/require\s*\(/) || content.match(/^\s*use\s+/)) {
          removedImports.push(content.trim());
        }
      } else if (!line.startsWith('\\')) {
        currentLineNew++;
        currentLineOld++;
      }
    }

    files.push({
      path: newPath,
      status,
      oldPath: status === 'renamed' ? oldPath : undefined,
      addedLines,
      removedLines,
      addedImports,
      removedImports,
      addedSymbols,
    });
  }

  return files;
}
