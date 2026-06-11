// ============================================================
// auk — AI Context Engineering Platform
// Parser interface — implemented by the tree-sitter parser and
// the regex fallback parser.
// ============================================================

import type { FileEntry, Language, ParsedFile } from '../types/analysis.js';

export interface CodeParser {
  readonly name: 'tree-sitter' | 'regex';
  supports(language: Language): boolean;
  parse(entry: FileEntry, content: string): ParsedFile;
}

export interface ParserProvider {
  /** Load the wasm runtime and grammars; safe to call multiple times */
  init(): Promise<void>;
  /** Best available parser for a language (tree-sitter if grammar loaded, else regex) */
  parserFor(entry: FileEntry): CodeParser;
}
