// ============================================================
// auk — AI Context Engineering Platform
// LLM enhancer — optional enhancement (works without any LLM)
// ============================================================

import type { Rule } from '../types/rules.js';
import { logger } from '../utils/logger.js';

/** LLM enhancement is optional — this module is a no-op by default */
export async function enhanceRulesWithLLM(rules: Rule[]): Promise<Rule[]> {
  // In v1, we ship with pure static analysis
  // LLM enhancement will be added in v2
  logger.debug('LLM enhancement is optional — using static analysis descriptions');
  return rules;
}
