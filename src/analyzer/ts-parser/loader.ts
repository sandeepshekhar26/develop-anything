// ============================================================
// auk — AI Context Engineering Platform
// Tree-sitter loader — lazy wasm runtime + grammar loading.
// Any failure here degrades silently to the regex parser:
// `npx auk` must never hard-fail because of wasm.
// ============================================================

import { Parser, Language as TSLanguage, Query } from 'web-tree-sitter';
import { resolveAsset } from '../../utils/assets.js';
import { logger } from '../../utils/logger.js';
import { GRAMMARS } from './queries.js';

let runtimeReady: Promise<boolean> | null = null;
const languages = new Map<string, TSLanguage | null>();
const queries = new Map<string, Query>();

/** Initialize the tree-sitter wasm runtime once. Returns false on failure. */
export function initRuntime(): Promise<boolean> {
  if (!runtimeReady) {
    runtimeReady = Parser.init()
      .then(() => true)
      .catch((err) => {
        logger.debug(`tree-sitter runtime unavailable, using regex parser: ${err}`);
        return false;
      });
  }
  return runtimeReady;
}

/** Load (and cache) a grammar by key; null if unavailable */
export async function loadGrammar(key: string): Promise<TSLanguage | null> {
  if (languages.has(key)) return languages.get(key)!;
  let lang: TSLanguage | null = null;
  try {
    if (await initRuntime()) {
      lang = await TSLanguage.load(resolveAsset(GRAMMARS[key].wasm));
    }
  } catch (err) {
    logger.debug(`grammar ${key} unavailable, falling back to regex: ${err}`);
  }
  languages.set(key, lang);
  return lang;
}

/** Compiled query for a loaded grammar (cached) */
export function queryFor(key: string): Query | null {
  if (queries.has(key)) return queries.get(key)!;
  const lang = languages.get(key);
  if (!lang) return null;
  try {
    const q = new Query(lang, GRAMMARS[key].spec.query);
    queries.set(key, q);
    return q;
  } catch (err) {
    logger.debug(`query compile failed for ${key}: ${err}`);
    languages.set(key, null);
    return null;
  }
}

/** Create a parser bound to a loaded grammar; null if grammar missing */
export function createParser(key: string): Parser | null {
  const lang = languages.get(key);
  if (!lang) return null;
  const p = new Parser();
  p.setLanguage(lang);
  return p;
}
