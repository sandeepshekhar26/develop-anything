// ============================================================
// auk — AI Context Engineering Platform
// Tree-sitter loader — lazy wasm runtime + grammar loading.
// Any failure here degrades silently to the regex parser:
// `npx auk` must never hard-fail because of wasm.
// ============================================================

// Type-only imports are erased at compile time, so they never trigger module
// resolution. The runtime values are loaded via dynamic import() inside
// initRuntime() — that way a missing/broken `web-tree-sitter` degrades to the
// regex parser instead of crashing the CLI at startup.
import type { Parser as ParserType, Language as TSLanguage, Query as QueryType } from 'web-tree-sitter';
import { resolveAsset } from '../../utils/assets.js';
import { logger } from '../../utils/logger.js';
import { GRAMMARS } from './queries.js';

type TreeSitterModule = typeof import('web-tree-sitter');

let runtimeReady: Promise<boolean> | null = null;
let ts: TreeSitterModule | null = null;   // resolved module, set once ready
const languages = new Map<string, TSLanguage | null>();
const queries = new Map<string, QueryType>();

/** Initialize the tree-sitter wasm runtime once. Returns false on failure
    (missing package, wasm init error, …) so callers fall back to regex. */
export function initRuntime(): Promise<boolean> {
  if (!runtimeReady) {
    runtimeReady = (async () => {
      try {
        ts = await import('web-tree-sitter');
        await ts.Parser.init();
        return true;
      } catch (err) {
        logger.debug(`tree-sitter runtime unavailable, using regex parser: ${err}`);
        ts = null;
        return false;
      }
    })();
  }
  return runtimeReady;
}

/** Load (and cache) a grammar by key; null if unavailable */
export async function loadGrammar(key: string): Promise<TSLanguage | null> {
  if (languages.has(key)) return languages.get(key)!;
  let lang: TSLanguage | null = null;
  try {
    if (await initRuntime() && ts) {
      lang = await ts.Language.load(resolveAsset(GRAMMARS[key].wasm));
    }
  } catch (err) {
    logger.debug(`grammar ${key} unavailable, falling back to regex: ${err}`);
  }
  languages.set(key, lang);
  return lang;
}

/** Compiled query for a loaded grammar (cached) */
export function queryFor(key: string): QueryType | null {
  if (queries.has(key)) return queries.get(key)!;
  const lang = languages.get(key);
  if (!lang || !ts) return null;
  try {
    const q = new ts.Query(lang, GRAMMARS[key].spec.query);
    queries.set(key, q);
    return q;
  } catch (err) {
    logger.debug(`query compile failed for ${key}: ${err}`);
    languages.set(key, null);
    return null;
  }
}

/** Create a parser bound to a loaded grammar; null if grammar missing */
export function createParser(key: string): ParserType | null {
  const lang = languages.get(key);
  if (!lang || !ts) return null;
  const p = new ts.Parser();
  p.setLanguage(lang);
  return p;
}
