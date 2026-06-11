// ============================================================
// Tests: zero-dependency YAML serializer/parser
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { dump, load } from '../../src/utils/yaml.js';

describe('yaml round-trip', () => {
  it('round-trips scalars', () => {
    for (const v of [42, -3.14, true, false, null, 'hello', 'with spaces', '0.9']) {
      expect(load(dump(v))).toEqual(v);
    }
  });

  it('round-trips nested objects', () => {
    const obj = {
      version: 1,
      project: { name: 'my-app', languages: ['typescript', 'python'] },
      score: 92.5,
      active: true,
      nothing: null,
    };
    expect(load(dump(obj))).toEqual(obj);
  });

  it('round-trips arrays of objects (rules.yaml shape)', () => {
    const rules = {
      rules: [
        {
          id: 'error-handling-result-pattern',
          severity: 'critical',
          priority: 98,
          description: 'Error handling uses Result<T,E>.\nNever throw in services — always return Result.',
          evidence: [
            { file: 'src/types/result.ts', line: 1, note: 'Pattern definition' },
          ],
          verification: { type: 'pattern-match', pattern: 'Result<', threshold: 0.9 },
        },
        {
          id: 'no-controller-in-service',
          description: 'Services never import Controllers',
          evidence: [],
          verification: { type: 'import-constraint', knownViolations: 3 },
        },
      ],
    };
    expect(load(dump(rules))).toEqual(rules);
  });

  it('round-trips multiline strings as block scalars', () => {
    const obj = { rationale: 'line one\nline two\n\nline four' };
    const text = dump(obj);
    expect(text).toContain('|-');
    expect(load(text)).toEqual(obj);
  });

  it('round-trips strings that look like other types', () => {
    const obj = { a: 'true', b: '42', c: 'null', d: 'no', e: '- not a list' };
    expect(load(dump(obj))).toEqual(obj);
  });

  it('round-trips empty collections', () => {
    const obj = { list: [], map: {}, nested: { also: [] } };
    expect(load(dump(obj))).toEqual(obj);
  });

  it('round-trips special characters in strings', () => {
    const obj = {
      msg: 'has: colon',
      hash: 'has # hash',
      quote: 'she said "hi"',
      emoji: 'arrows → and dashes —',
    };
    expect(load(dump(obj))).toEqual(obj);
  });
});

describe('yaml load (hand-written input)', () => {
  it('parses comments and blank lines', () => {
    const text = `
# top comment
version: 1   # inline comment

project:
  name: demo
`;
    expect(load(text)).toEqual({ version: 1, project: { name: 'demo' } });
  });

  it('parses flow arrays', () => {
    expect(load('langs: [typescript, python, go]')).toEqual({
      langs: ['typescript', 'python', 'go'],
    });
  });

  it('parses block scalars with |', () => {
    const text = 'description: |\n  first line\n  second line\n';
    expect(load(text)).toEqual({ description: 'first line\nsecond line\n' });
  });

  it('parses nested sequences of mappings', () => {
    const text = `
decisions:
  - id: one
    status: active
  - id: two
    status: deprecated
`;
    expect(load(text)).toEqual({
      decisions: [
        { id: 'one', status: 'active' },
        { id: 'two', status: 'deprecated' },
      ],
    });
  });

  it('parses quoted keys and values', () => {
    expect(load('"my key": "my: value"')).toEqual({ 'my key': 'my: value' });
  });
});
