// ============================================================
// auk — AI Context Engineering Platform
// Health scorer — calculates context health score
// ============================================================

import type { VerificationResult, HealthReport, ClaimStatus } from '../types/rules.js';

/** Calculate the overall health score */
export function calculateHealthScore(results: VerificationResult[]): HealthReport {
  if (results.length === 0) {
    return {
      timestamp: new Date().toISOString(),
      overallScore: 100,
      totalRules: 0,
      valid: 0,
      degraded: 0,
      violated: 0,
      obsolete: 0,
      results: [],
    };
  }

  let valid = 0, degraded = 0, violated = 0, obsolete = 0;

  for (const result of results) {
    switch (result.status) {
      case 'valid': valid++; break;
      case 'degraded': degraded++; break;
      case 'violated': violated++; break;
      case 'obsolete': obsolete++; break;
    }
  }

  // Weighted scoring:
  // - valid = 100%
  // - degraded = 60%
  // - violated = 0%
  // - obsolete = 0%
  const total = results.length;
  const weightedScore = (valid * 100 + degraded * 60) / total;
  const overallScore = Math.round(weightedScore);

  return {
    timestamp: new Date().toISOString(),
    overallScore,
    totalRules: total,
    valid,
    degraded,
    violated,
    obsolete,
    results,
  };
}

/** Get health badge color based on score */
export function getBadgeColor(score: number): string {
  if (score >= 90) return 'brightgreen';
  if (score >= 75) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

/** Generate badge URL */
export function generateBadgeUrl(score: number): string {
  const color = getBadgeColor(score);
  return `https://img.shields.io/badge/context--health-${score}%25-${color}`;
}
