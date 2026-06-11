// ============================================================
// auk — AI Context Engineering Platform
// Violation detector — detects architectural violations
// ============================================================

import type { DiffFile, Violation, NewEdge, ComplexityChange } from '../types/review.js';
import type { DependencyGraph } from '../types/analysis.js';
import type { RulesFile, Rule } from '../types/rules.js';

/** Detect all violations in a diff */
export function detectViolations(
  diffFiles: DiffFile[],
  newEdges: NewEdge[],
  complexityChanges: ComplexityChange[],
  graph: DependencyGraph,
  rules?: RulesFile
): Violation[] {
  const violations: Violation[] = [];

  // 1. Boundary violations
  for (const edge of newEdges) {
    if (edge.crossesBoundary) {
      violations.push({
        type: 'boundary-violation',
        severity: 'violation',
        file: edge.source,
        message: `New import from ${edge.source} → ${edge.target} crosses a layer boundary.`,
        explanation: `Your codebase has established layer boundaries. This import introduces a new cross-boundary dependency that violates the architectural pattern.`,
        suggestion: `Consider adding an intermediate service or using dependency injection to decouple these layers.`,
      });
    }
  }

  // 2. Circular dependencies
  for (const edge of newEdges) {
    if (edge.createsCycle) {
      violations.push({
        type: 'circular-dependency',
        severity: 'violation',
        file: edge.source,
        message: `This change creates a circular dependency: ${edge.source} ↔ ${edge.target}`,
        explanation: `A reverse import already exists. This creates a circular dependency that can cause initialization issues and makes the code harder to reason about.`,
        suggestion: `Extract shared types into a separate module, or use event-based communication instead of direct imports.`,
      });
    }
  }

  // 3. God object warnings
  for (const change of complexityChanges) {
    if (change.isGodObjectRisk) {
      violations.push({
        type: 'god-object',
        severity: 'warning',
        file: change.file,
        message: `${change.file} now has ${change.after.degree} connections (was ${change.before.degree}). Becoming a god object.`,
        explanation: `Files with many connections become central points of failure and are hard to modify without causing cascading changes.`,
        suggestion: `Consider breaking this file into smaller, focused modules with single responsibilities.`,
      });
    }
  }

  // 4. Rule violations from rules.yaml
  if (rules) {
    for (const rule of rules.rules) {
      if (rule.verification.type === 'import-constraint' && rule.verification.forbidden) {
        for (const file of diffFiles) {
          for (const imp of file.addedImports) {
            if (imp.includes(rule.verification.forbidden.replace('/**', '').replace('/*', ''))) {
              violations.push({
                type: 'rule-violation',
                severity: 'violation',
                file: file.path,
                message: `New import violates rule "${rule.id}": ${rule.description.trim().split('\n')[0]}`,
                explanation: rule.description,
                relatedRule: rule.id,
                relatedDecision: rule.decisionRef,
              });
            }
          }
        }
      }
    }
  }

  return violations;
}
