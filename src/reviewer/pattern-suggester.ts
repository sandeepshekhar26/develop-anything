// ============================================================
// auk — AI Context Engineering Platform
// Pattern suggester — suggests existing patterns
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { DependencyGraph, FileEntry, Language } from '../types/analysis.js';
import type { DiffFile, Violation } from '../types/review.js';
import { parseFile } from '../analyzer/parser.js';
import { tokenizeFile } from '../semantic/tokenizer.js';
import { TfidfProvider, type SemanticIndexFile } from '../semantic/similarity.js';

/** Suggest existing patterns from the codebase that could solve detected violations */
export function suggestPatterns(
  violations: Violation[],
  graph: DependencyGraph
): Violation[] {
  for (const violation of violations) {
    if (violation.type === 'boundary-violation' || violation.type === 'circular-dependency') {
      // Look for files in the same domain that handle similar dependencies
      const relatedNodes = graph.nodes
        .filter(n => n.layer === 'service' && n.centrality.degree > 0 && n.centrality.degree < 6)
        .slice(0, 3);

      if (relatedNodes.length > 0) {
        const suggestionFile = relatedNodes[0].id;
        violation.suggestion = violation.suggestion || '';
        violation.suggestion += ` Look at ${suggestionFile} for an example of how this domain handles similar dependencies.`;
      }
    }
  }

  return violations;
}

const EXT_LANG: Record<string, Language> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.go': 'go', '.java': 'java', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
};

/** For each newly added file, suggest the most similar existing file from the
    persisted semantic index — its structure is the pattern to follow. */
export function suggestSimilarFiles(
  diffFiles: DiffFile[],
  semanticData: SemanticIndexFile,
  projectRoot: string
): Violation[] {
  const provider = TfidfProvider.deserialize(semanticData);
  const suggestions: Violation[] = [];

  for (const df of diffFiles) {
    if (df.status !== 'added') continue;
    const language = EXT_LANG[path.extname(df.path)];
    if (!language) continue;
    const absolutePath = path.join(projectRoot, df.path);
    if (!fs.existsSync(absolutePath)) continue;

    const entry: FileEntry = { path: df.path, absolutePath, language, size: 0, hash: '' };
    const tokens = tokenizeFile(parseFile(entry));
    const [best] = provider.similarToTokens(tokens, 1);
    if (!best || best.score < 0.3) continue;

    suggestions.push({
      type: 'convention-violation',
      severity: 'suggestion',
      file: df.path,
      message: `New file is most similar to ${best.file} (similarity ${best.score})`,
      explanation: 'Files of the same shape should follow the same structure and conventions.',
      suggestion: `Mirror the structure of ${best.file} — imports, export style, and error handling.`,
    });
  }

  return suggestions;
}
