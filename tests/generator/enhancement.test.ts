// ============================================================
// auk — tests for the host-agent enhancement flow
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseEnhancementResponse, applyEnhancements, preserveEnhancements } from '../../src/generator/enhancement-validator.js';
import { rulesNeedingEnhancement } from '../../src/generator/prompt-emitter.js';
import type { Rule, RulesFile } from '../../src/types/rules.js';

function makeRule(id: string, description = 'Original deterministic description'): Rule {
  return {
    id, category: 'patterns', severity: 'info', priority: 50,
    description, evidence: [], verification: { type: 'custom' }, confidence: 0.8,
  };
}

function makeFile(rules: Rule[]): RulesFile {
  return {
    version: 1, generatedAt: 'now', healthScore: 100,
    project: { name: 'test', languages: ['typescript'] }, rules,
  };
}

describe('enhancement validator', () => {
  it('applies a valid response and bumps file version', () => {
    const file = makeFile([makeRule('rule-a')]);
    const response = parseEnhancementResponse(JSON.stringify({
      version: 1, batch: 'b1',
      enhancements: [{ ruleId: 'rule-a', description: 'Much clearer enhanced description.', rationale: 'Because reasons.' }],
    }));
    const result = applyEnhancements(response, file, process.cwd());
    assert.deepStrictEqual(result.applied, ['rule-a']);
    assert.strictEqual(file.version, 2);
    assert.strictEqual(file.rules[0].enhanced?.rationale, 'Because reasons.');
    // deterministic core untouched
    assert.strictEqual(file.rules[0].description, 'Original deterministic description');
  });

  it('skips unknown rule ids and out-of-bounds descriptions', () => {
    const file = makeFile([makeRule('rule-a')]);
    const response = parseEnhancementResponse(JSON.stringify({
      version: 1, batch: 'b1',
      enhancements: [
        { ruleId: 'nope', description: 'A perfectly fine description.' },
        { ruleId: 'rule-a', description: 'short' },
      ],
    }));
    const result = applyEnhancements(response, file, process.cwd());
    assert.strictEqual(result.applied.length, 0);
    assert.strictEqual(result.skipped.length, 2);
    assert.strictEqual(file.rules[0].enhanced, undefined);
  });

  it('rejects structurally invalid responses', () => {
    assert.throws(() => parseEnhancementResponse('{"version":2}'), /version/);
    assert.throws(() => parseEnhancementResponse('not json'), /not valid JSON/);
    assert.throws(() => parseEnhancementResponse('{"version":1,"batch":"x","enhancements":[{"description":"y"}]}'), /ruleId/);
  });

  it('drops example references to files that do not exist', () => {
    const file = makeFile([makeRule('rule-a')]);
    const response = parseEnhancementResponse(JSON.stringify({
      version: 1, batch: 'b1',
      enhancements: [{
        ruleId: 'rule-a', description: 'Enhanced description here.',
        examples: [{ file: 'package.json', note: 'real' }, { file: 'no/such/file.ts', note: 'fake' }],
      }],
    }));
    applyEnhancements(response, file, process.cwd());
    assert.deepStrictEqual(file.rules[0].enhanced?.examples, [{ file: 'package.json', note: 'real' }]);
  });
});

describe('enhancement preservation across regenerate', () => {
  it('carries enhancements for unchanged rules, marks stale when core changed', () => {
    const oldFile = makeFile([makeRule('same'), makeRule('changed', 'old core text')]);
    oldFile.rules[0].enhanced = { description: 'Enhanced same.', enhancedAt: 't', source: 'host-agent' };
    oldFile.rules[1].enhanced = { description: 'Enhanced changed.', enhancedAt: 't', source: 'host-agent' };

    const newFile = makeFile([makeRule('same'), makeRule('changed', 'new core text'), makeRule('brand-new')]);
    preserveEnhancements(oldFile, newFile);

    assert.strictEqual(newFile.rules[0].enhanced?.description, 'Enhanced same.');
    assert.strictEqual(newFile.rules[0].enhanced?.stale, undefined);
    assert.strictEqual(newFile.rules[1].enhanced?.stale, true);
    assert.strictEqual(newFile.rules[2].enhanced, undefined);

    // pending = stale + never-enhanced
    const pending = rulesNeedingEnhancement(newFile).map(r => r.id);
    assert.deepStrictEqual(pending, ['changed', 'brand-new']);
  });
});
