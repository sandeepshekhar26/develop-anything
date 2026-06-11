// ============================================================
// auk — AI Context Engineering Platform
// Claim extractor — parses rules into verifiable claims
// ============================================================

import type { Rule, VerifiableClaim, VerificationType } from '../types/rules.js';

/** Extract verifiable claims from a rule */
export function extractClaims(rule: Rule): VerifiableClaim[] {
  const claims: VerifiableClaim[] = [];

  switch (rule.verification.type) {
    case 'pattern-match':
      if (!rule.verification.pattern) {
        // No machine-checkable pattern — treat as custom (manual check)
        claims.push({
          ruleId: rule.id,
          description: rule.description,
          type: 'custom',
          assertion: rule.description,
          threshold: rule.verification.threshold || 0.8,
        });
        break;
      }
      claims.push({
        ruleId: rule.id,
        description: `Pattern "${rule.verification.pattern}" is present in files`,
        type: 'pattern-match',
        assertion: rule.verification.pattern,
        threshold: rule.verification.threshold || 0.8,
        appliesTo: rule.appliesTo,
      });
      break;

    case 'no-pattern':
      claims.push({
        ruleId: rule.id,
        description: `Pattern "${rule.verification.pattern}" is absent from files`,
        type: 'no-pattern',
        assertion: rule.verification.pattern || '',
        threshold: rule.verification.threshold || 0.95,
        appliesTo: rule.appliesTo,
      });
      break;

    case 'import-constraint':
      claims.push({
        ruleId: rule.id,
        description: `No imports from ${rule.verification.forbidden} in ${rule.verification.source}`,
        type: 'import-constraint',
        assertion: `${rule.verification.source} -> ${rule.verification.forbidden}`,
        threshold: 1.0, // Import constraints are binary
      });
      break;

    case 'naming-convention':
      claims.push({
        ruleId: rule.id,
        description: `Naming convention "${rule.verification.pattern}" is followed`,
        type: 'naming-convention',
        assertion: rule.verification.pattern || '',
        threshold: rule.verification.threshold || 0.9,
        subject: rule.verification.subject || 'all',
      });
      break;

    case 'file-exists':
      claims.push({
        ruleId: rule.id,
        description: `File or pattern exists: ${rule.verification.pattern}`,
        type: 'file-exists',
        assertion: rule.verification.pattern || '',
        threshold: 1.0,
      });
      break;

    case 'directory-structure':
      claims.push({
        ruleId: rule.id,
        description: `Directory structure follows pattern`,
        type: 'directory-structure',
        assertion: rule.verification.pattern || '',
        threshold: rule.verification.threshold || 0.8,
      });
      break;

    default:
      // For custom or unknown types, create a basic claim
      claims.push({
        ruleId: rule.id,
        description: rule.description,
        type: rule.verification.type,
        assertion: rule.description,
        threshold: rule.verification.threshold || 0.8,
      });
  }

  return claims;
}

/** Extract claims from all rules */
export function extractAllClaims(rules: Rule[]): VerifiableClaim[] {
  return rules.flatMap(extractClaims);
}
