// ============================================================
// auk — AI Context Engineering Platform
// Enhancement validator/merger — schema-validates agent-written
// enhancement responses and merges them into rules.yaml. The
// deterministic rule core is untouchable; bad input is rejected
// or skipped, never partially applied to a rule.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { EnhancementResponse, RulesFile } from '../types/rules.js';

export interface ApplyResult {
  applied: string[];           // rule ids enhanced
  skipped: Array<{ ruleId: string; reason: string }>;
}

const DESC_MIN = 10;
const DESC_MAX = 600;

/** Structural validation; throws with a readable message on a malformed file */
export function parseEnhancementResponse(raw: string): EnhancementResponse {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Response is not valid JSON: ${err}`);
  }
  const obj = data as Record<string, unknown>;
  if (obj?.version !== 1) throw new Error('Response "version" must be 1');
  if (typeof obj.batch !== 'string') throw new Error('Response "batch" must be a string');
  if (!Array.isArray(obj.enhancements)) throw new Error('Response "enhancements" must be an array');
  for (const [i, e] of (obj.enhancements as Array<Record<string, unknown>>).entries()) {
    if (typeof e?.ruleId !== 'string' || !e.ruleId) throw new Error(`enhancements[${i}].ruleId must be a non-empty string`);
    if (typeof e.description !== 'string') throw new Error(`enhancements[${i}].description must be a string`);
    if (e.rationale !== undefined && typeof e.rationale !== 'string') throw new Error(`enhancements[${i}].rationale must be a string`);
    if (e.examples !== undefined) {
      if (!Array.isArray(e.examples)) throw new Error(`enhancements[${i}].examples must be an array`);
      for (const ex of e.examples as Array<Record<string, unknown>>) {
        if (typeof ex?.file !== 'string' || typeof ex?.note !== 'string') {
          throw new Error(`enhancements[${i}].examples entries need string "file" and "note"`);
        }
      }
    }
  }
  return data as EnhancementResponse;
}

/** Merge a validated response into the rules file (mutates rulesFile).
    Per-rule problems are skipped and reported rather than failing the batch. */
export function applyEnhancements(
  response: EnhancementResponse,
  rulesFile: RulesFile,
  projectRoot: string
): ApplyResult {
  const result: ApplyResult = { applied: [], skipped: [] };
  const byId = new Map(rulesFile.rules.map(r => [r.id, r]));

  for (const e of response.enhancements) {
    const rule = byId.get(e.ruleId);
    if (!rule) {
      result.skipped.push({ ruleId: e.ruleId, reason: 'unknown rule id' });
      continue;
    }
    const desc = e.description.trim();
    if (desc.length < DESC_MIN || desc.length > DESC_MAX) {
      result.skipped.push({ ruleId: e.ruleId, reason: `description length ${desc.length} outside ${DESC_MIN}-${DESC_MAX}` });
      continue;
    }
    const examples = (e.examples ?? []).filter(ex =>
      fs.existsSync(path.join(projectRoot, ex.file))
    );

    rule.enhanced = {
      description: desc,
      enhancedAt: new Date().toISOString(),
      source: 'host-agent',
    };
    if (e.rationale?.trim()) rule.enhanced.rationale = e.rationale.trim();
    if (examples.length > 0) rule.enhanced.examples = examples;
    result.applied.push(e.ruleId);
  }

  if (result.applied.length > 0 && rulesFile.version < 2) rulesFile.version = 2;
  return result;
}

/** On regenerate: carry enhancements from the old rules file onto new rules.
    If the deterministic description changed, keep the enhancement but mark
    it stale so the next --emit-prompts run refreshes it. */
export function preserveEnhancements(oldFile: RulesFile | null, newFile: RulesFile): void {
  if (!oldFile) return;
  const oldById = new Map(oldFile.rules.map(r => [r.id, r]));
  let carried = false;
  for (const rule of newFile.rules) {
    const old = oldById.get(rule.id);
    if (!old?.enhanced) continue;
    rule.enhanced = { ...old.enhanced };
    if (old.description !== rule.description) rule.enhanced.stale = true;
    carried = true;
  }
  if (carried && newFile.version < 2) newFile.version = 2;
}
