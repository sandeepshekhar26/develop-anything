// ============================================================
// Tests: Verifier
// ============================================================

import { describe, it } from 'node:test';
import { expect } from '../helpers/expect.js';
import { extractClaims, extractAllClaims } from '../../src/verifier/claim-extractor.js';
import { calculateHealthScore } from '../../src/verifier/health-scorer.js';
import type { Rule, VerificationResult } from '../../src/types/rules.js';

describe('extractClaims', () => {
  it('should extract pattern-match claim', () => {
    const rule: Rule = {
      id: 'test-rule',
      category: 'patterns',
      severity: 'warning',
      priority: 50,
      description: 'Test pattern',
      evidence: [],
      verification: { type: 'pattern-match', pattern: 'Result<', threshold: 0.9 },
      confidence: 0.8,
    };

    const claims = extractClaims(rule);
    expect(claims).toHaveLength(1);
    expect(claims[0].type).toBe('pattern-match');
    expect(claims[0].assertion).toBe('Result<');
    expect(claims[0].threshold).toBe(0.9);
  });

  it('should extract import-constraint claim', () => {
    const rule: Rule = {
      id: 'no-service-to-controller',
      category: 'architecture',
      severity: 'critical',
      priority: 95,
      description: 'No imports from controllers in services',
      evidence: [],
      verification: {
        type: 'import-constraint',
        source: 'src/services/**',
        forbidden: 'src/controllers/**',
      },
      confidence: 0.9,
    };

    const claims = extractClaims(rule);
    expect(claims).toHaveLength(1);
    expect(claims[0].type).toBe('import-constraint');
  });
});

describe('calculateHealthScore', () => {
  it('should return 100 for all valid results', () => {
    const results: VerificationResult[] = [
      { ruleId: 'r1', status: 'valid', claims: [], score: 1.0, details: '' },
      { ruleId: 'r2', status: 'valid', claims: [], score: 1.0, details: '' },
    ];

    const report = calculateHealthScore(results);
    expect(report.overallScore).toBe(100);
    expect(report.valid).toBe(2);
  });

  it('should penalize degraded rules', () => {
    const results: VerificationResult[] = [
      { ruleId: 'r1', status: 'valid', claims: [], score: 1.0, details: '' },
      { ruleId: 'r2', status: 'degraded', claims: [], score: 0.7, details: '' },
    ];

    const report = calculateHealthScore(results);
    expect(report.overallScore).toBe(80); // (100 + 60) / 2
    expect(report.degraded).toBe(1);
  });

  it('should heavily penalize violated rules', () => {
    const results: VerificationResult[] = [
      { ruleId: 'r1', status: 'valid', claims: [], score: 1.0, details: '' },
      { ruleId: 'r2', status: 'violated', claims: [], score: 0.3, details: '' },
    ];

    const report = calculateHealthScore(results);
    expect(report.overallScore).toBe(50); // (100 + 0) / 2
    expect(report.violated).toBe(1);
  });

  it('should return 100 for empty results', () => {
    const report = calculateHealthScore([]);
    expect(report.overallScore).toBe(100);
  });
});
