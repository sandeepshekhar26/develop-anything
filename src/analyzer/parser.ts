// ============================================================
// auk — AI Context Engineering Platform
// Parser dispatcher — tree-sitter (wasm) when a grammar is
// available, regex fallback otherwise. Tree-sitter failures of
// any kind degrade silently to regex: `npx auk` never hard-fails
// because of wasm.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { FileEntry, ParsedFile } from '../types/analysis.js';
import { logger } from '../utils/logger.js';
import { emptyParsedFile, parseFileRegex } from './regex-parser.js';
import { createParser, loadGrammar, queryFor } from './ts-parser/loader.js';
import { grammarKeyFor } from './ts-parser/queries.js';
import { parseWithTreeSitter } from './ts-parser/ts-parser.js';

/** Parse a single file with the regex parser (sync; kept for tests and tools) */
export { parseFileRegex as parseFile } from './regex-parser.js';

interface ParseCacheFile {
  version: 1;
  files: Record<string, { hash: string; parsed: Omit<ParsedFile, 'entry'> }>;
}

/** Load the incremental parse cache (.auk/cache.json) */
function loadParseCache(cachePath: string): ParseCacheFile | null {
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as ParseCacheFile;
    return data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

/** Parse all files: tree-sitter where possible, regex elsewhere.
    When cachePath is given, unchanged files (by content hash) are
    reused from the previous run instead of being re-parsed. */
export async function parseFiles(entries: FileEntry[], cachePath?: string): Promise<ParsedFile[]> {
  const cache = cachePath ? loadParseCache(cachePath) : null;
  const fresh: ParsedFile[] = [];
  const reused: ParsedFile[] = [];
  const toParse: FileEntry[] = [];

  for (const entry of entries) {
    const hit = cache?.files[entry.path];
    if (hit && hit.hash === entry.hash) {
      reused.push({ ...hit.parsed, entry });
    } else {
      toParse.push(entry);
    }
  }

  if (toParse.length > 0) {
    fresh.push(...await parseFilesUncached(toParse));
  }
  if (reused.length > 0) {
    logger.debug(`Parse cache: reused ${reused.length}, parsed ${fresh.length}`);
  }

  const results = [...reused, ...fresh];
  // keep input order for deterministic downstream output
  const order = new Map(entries.map((e, i) => [e.path, i]));
  results.sort((a, b) => order.get(a.entry.path)! - order.get(b.entry.path)!);

  if (cachePath) {
    const out: ParseCacheFile = { version: 1, files: {} };
    for (const pf of results) {
      const { entry, ...parsed } = pf;
      out.files[entry.path] = { hash: entry.hash, parsed };
    }
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(out));
    } catch (err) {
      logger.debug(`Could not write parse cache: ${err}`);
    }
  }

  return results;
}

async function parseFilesUncached(entries: FileEntry[]): Promise<ParsedFile[]> {
  // Load only the grammars actually present in this scan
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = grammarKeyFor(entry.language, entry.path);
    if (key) keys.add(key);
  }
  await Promise.all([...keys].map((k) => loadGrammar(k)));

  const results: ParsedFile[] = [];
  let treeSitterCount = 0;

  for (const entry of entries) {
    let content: string;
    try {
      content = fs.readFileSync(entry.absolutePath, 'utf-8');
    } catch {
      results.push(emptyParsedFile(entry));
      continue;
    }

    const key = grammarKeyFor(entry.language, entry.path);
    const parser = key ? createParser(key) : null;
    const query = key ? queryFor(key) : null;

    if (parser && query && key) {
      try {
        results.push(parseWithTreeSitter(entry, content, parser, query, key));
        treeSitterCount++;
        continue;
      } catch (err) {
        logger.debug(`tree-sitter parse failed for ${entry.path}, regex fallback: ${err}`);
      } finally {
        parser.delete();
      }
    } else if (parser) {
      parser.delete();
    }

    try {
      results.push(parseFileRegex(entry, content));
    } catch (err) {
      logger.debug(`Failed to parse ${entry.path}: ${err}`);
      results.push(emptyParsedFile(entry));
    }
  }

  logger.debug(`Parsed ${results.length} files (${treeSitterCount} tree-sitter, ${results.length - treeSitterCount} regex)`);
  return results;
}
