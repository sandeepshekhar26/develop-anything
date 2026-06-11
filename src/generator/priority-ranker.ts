// ============================================================
// auk — AI Context Engineering Platform
// Priority ranker — ranks rules by importance
// ============================================================

import type { Rule } from '../types/rules.js';
import type { AnalysisResult } from '../types/analysis.js';

/** Rank rules by importance */
export function rankRules(rules: Rule[], analysis: AnalysisResult): Rule[] {
  const totalFiles = analysis.stats.totalFiles;

  for (const rule of rules) {
    let score = 0;

    // 1. Severity weight (0-40 points)
    switch (rule.severity) {
      case 'critical': score += 40; break;
      case 'warning': score += 25; break;
      case 'info': score += 10; break;
    }

    // 2. Category weight (0-30 points)
    const categoryWeights: Record<string, number> = {
      'architecture': 30,
      'error-handling': 25,
      'imports': 20,
      'types': 15,
      'naming': 15,
      'testing': 10,
      'file-organization': 10,
      'patterns': 10,
      'dependencies': 15,
    };
    score += categoryWeights[rule.category] || 10;

    // 3. Evidence strength (0-15 points)
    const evidenceCount = rule.evidence.length;
    score += Math.min(evidenceCount * 3, 15);

    // 4. Confidence adjustment (0-15 points)
    score += Math.round(rule.confidence * 15);

    rule.priority = Math.min(score, 100);
  }

  // Sort by priority descending
  return rules.sort((a, b) => b.priority - a.priority);
}
