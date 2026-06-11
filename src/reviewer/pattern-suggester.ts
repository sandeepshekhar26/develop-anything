// ============================================================
// auk — AI Context Engineering Platform
// Pattern suggester — suggests existing patterns
// ============================================================

import type { DependencyGraph } from '../types/analysis.js';
import type { Violation } from '../types/review.js';

/** Suggest existing patterns from the codebase that could solve detected violations */
export function suggestPatterns(
  violations: Violation[],
  graph: DependencyGraph
): Violation[] {
  for (const violation of violations) {
    if (violation.type === 'boundary-violation' || violation.type === 'circular-dependency') {
      // Look for files in the same domain that handle similar dependencies
      const relatedNodes = graph.nodes
        .filter(n => n.layer === 'service' && n.centrality.degree > 0 && n.centrality.degree < 6)
        .slice(0, 3);

      if (relatedNodes.length > 0) {
        const suggestionFile = relatedNodes[0].id;
        violation.suggestion = violation.suggestion || '';
        violation.suggestion += ` Look at ${suggestionFile} for an example of how this domain handles similar dependencies.`;
      }
    }
  }

  return violations;
}
