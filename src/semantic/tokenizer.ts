// ============================================================
// auk — AI Context Engineering Platform
// Semantic tokenizer — turns a parsed file into a deterministic
// bag of identifier sub-tokens for TF-IDF similarity.
// Sources: symbol names, import paths/symbols, comments, path
// segments. camelCase / snake_case / kebab-case are split.
// ============================================================

import type { ParsedFile } from '../types/analysis.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'from', 'with', 'this', 'that', 'not',
  'const', 'let', 'var', 'function', 'class', 'return', 'import',
  'export', 'default', 'new', 'void', 'null', 'undefined', 'true',
  'false', 'string', 'number', 'boolean', 'int', 'str', 'self',
  'public', 'private', 'static', 'async', 'await', 'def', 'index',
  'src', 'lib', 'main', 'mod', 'get', 'set', 'todo', 'fixme', 'note',
]);

/** Split an identifier into lowercase sub-tokens */
export function splitIdentifier(identifier: string): string[] {
  return identifier
    // camelCase / PascalCase boundaries (incl. acronym runs: HTTPServer → HTTP Server)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // snake_case, kebab-case, path separators, dots
    .split(/[\s_\-./\\:#]+/)
    .map(t => t.toLowerCase().replace(/[^a-z]/g, ''))
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

/** Tokenize a parsed file into a deterministic token bag */
export function tokenizeFile(pf: ParsedFile): string[] {
  const tokens: string[] = [];
  const add = (s: string) => tokens.push(...splitIdentifier(s));

  add(pf.entry.path);
  for (const sym of pf.symbols) {
    add(sym.name);
    if (sym.parentSymbol) add(sym.parentSymbol);
  }
  for (const imp of pf.imports) {
    add(imp.source);
    for (const s of imp.symbols) add(s);
  }
  for (const exp of pf.exports) add(exp.name);
  for (const comment of pf.comments) add(comment);

  return tokens;
}
