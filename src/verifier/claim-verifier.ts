// ============================================================
// auk — AI Context Engineering Platform
// Claim verifier — verifies claims against the actual codebase
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { VerifiableClaim, ClaimStatus, VerificationResult } from '../types/rules.js';
import type { ParsedFile } from '../types/analysis.js';
import type { AukConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { matchesGlob } from '../utils/file-utils.js';

/** Verify a single claim against parsed files */
export function verifyClaim(
  claim: VerifiableClaim,
  parsedFiles: ParsedFile[],
  projectRoot: string,
  config: AukConfig
): VerifiableClaim {
  let actualScore = 0;
  let details = '';

  switch (claim.type) {
    case 'pattern-match':
    case 'no-pattern': {
      const pattern = claim.assertion;
      const scoped = claim.appliesTo
        ? parsedFiles.filter(pf => matchesGlob(pf.entry.path, [claim.appliesTo!]))
        : parsedFiles;
      let matchCount = 0;
      let totalRelevant = 0;

      for (const pf of scoped) {
        try {
          const content = fs.readFileSync(pf.entry.absolutePath, 'utf-8');
          totalRelevant++;
          if (content.includes(pattern)) {
            matchCount++;
          }
        } catch { /* skip unreadable files */ }
      }

      if (claim.type === 'no-pattern') {
        actualScore = totalRelevant > 0 ? (totalRelevant - matchCount) / totalRelevant : 1;
        details = `${matchCount}/${totalRelevant} files contain forbidden pattern "${pattern}"`;
      } else {
        actualScore = totalRelevant > 0 ? matchCount / totalRelevant : 0;
        details = `${matchCount}/${totalRelevant} files contain pattern "${pattern}"`;
      }
      break;
    }

    case 'import-constraint': {
      const parts = claim.assertion.split(' -> ');
      if (parts.length !== 2) { actualScore = 1; break; }

      const [sourceGlob, forbiddenGlob] = parts;
      let violations = 0;
      let checked = 0;

      for (const pf of parsedFiles) {
        if (!matchesGlob(pf.entry.path, [sourceGlob])) continue;
        checked++;

        for (const imp of pf.imports) {
          if (imp.resolvedPath && matchesGlob(imp.resolvedPath, [forbiddenGlob])) {
            violations++;
          }
          // Also check by source string pattern
          if (matchesGlob(imp.source, [forbiddenGlob])) {
            violations++;
          }
        }
      }

      actualScore = checked > 0 ? (violations === 0 ? 1.0 : Math.max(0, 1 - violations / checked)) : 1.0;
      details = violations > 0
        ? `${violations} violation(s) found in ${checked} checked files`
        : `No violations in ${checked} checked files`;
      break;
    }

    case 'naming-convention': {
      const convention = claim.assertion;
      const subject = claim.subject || 'all';
      const classKinds = new Set(['class', 'interface', 'type', 'enum', 'struct']);
      let matching = 0;
      let total = 0;

      for (const pf of parsedFiles) {
        for (const sym of pf.symbols) {
          const isClassLike = classKinds.has(sym.type);
          const relevant =
            subject === 'all' ||
            (subject === 'function' && sym.type === 'function') ||
            (subject === 'class' && isClassLike);
          if (relevant) {
            total++;
            switch (convention) {
              case 'camelCase':
                if (/^[a-z][a-zA-Z0-9]*$/.test(sym.name)) matching++;
                break;
              case 'snake_case':
                if (/^[a-z][a-z0-9_]*$/.test(sym.name)) matching++;
                break;
              case 'PascalCase':
                if (/^[A-Z][a-zA-Z0-9]*$/.test(sym.name)) matching++;
                break;
            }
          }
        }
      }

      actualScore = total > 0 ? matching / total : 1.0;
      details = `${matching}/${total} symbols follow ${convention}`;
      break;
    }

    case 'file-exists': {
      const filePath = path.join(projectRoot, claim.assertion);
      const exists = fs.existsSync(filePath);
      actualScore = exists ? 1.0 : 0.0;
      details = exists ? `File exists: ${claim.assertion}` : `File missing: ${claim.assertion}`;
      break;
    }

    default:
      actualScore = 0.5; // Unknown verification types get neutral score
      details = 'Custom verification — manual check required';
  }

  // Determine status relative to the claim's baseline threshold —
  // context rot is a DECLINE from what was true at generation time,
  // not failure to hit an absolute bar. 'obsolete' is reserved for
  // claims whose referenced files/patterns no longer exist at all.
  const baseline = claim.threshold > 0 ? claim.threshold : 1;
  const relative = Math.min(1, actualScore / baseline);
  let status: ClaimStatus;
  if (relative >= config.verification.validThreshold) {
    status = 'valid';
  } else if (relative >= config.verification.degradedThreshold) {
    status = 'degraded';
  } else if (claim.type === 'file-exists' && actualScore === 0) {
    status = 'obsolete';
  } else {
    status = 'violated';
  }

  return {
    ...claim,
    status,
    actualScore,
    details,
  };
}

/** Verify all claims and produce verification results grouped by rule */
export function verifyAllClaims(
  claims: VerifiableClaim[],
  parsedFiles: ParsedFile[],
  projectRoot: string,
  config: AukConfig
): VerificationResult[] {
  const verifiedClaims = claims.map(c => verifyClaim(c, parsedFiles, projectRoot, config));

  // Group by rule ID
  const byRule = new Map<string, VerifiableClaim[]>();
  for (const claim of verifiedClaims) {
    if (!byRule.has(claim.ruleId)) byRule.set(claim.ruleId, []);
    byRule.get(claim.ruleId)!.push(claim);
  }

  const results: VerificationResult[] = [];
  for (const [ruleId, ruleClaims] of byRule) {
    const avgScore = ruleClaims.reduce((sum, c) => sum + (c.actualScore || 0), 0) / ruleClaims.length;

    // Overall status is the worst among claims
    const statusPriority: Record<ClaimStatus, number> = {
      valid: 0, degraded: 1, violated: 2, obsolete: 3,
    };
    const worstStatus = ruleClaims.reduce<ClaimStatus>((worst, c) => {
      const s = c.status || 'valid';
      return statusPriority[s] > statusPriority[worst] ? s : worst;
    }, 'valid');

    results.push({
      ruleId,
      status: worstStatus,
      claims: ruleClaims,
      score: avgScore,
      details: ruleClaims.map(c => c.details || '').join('; '),
    });
  }

  return results;
}
