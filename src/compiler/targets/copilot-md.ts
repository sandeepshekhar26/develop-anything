// ============================================================
// auk — Compiler target: .github/copilot-instructions.md
// ============================================================

import type { CompilerTarget } from '../target-registry.js';
import type { RulesFile } from '../../types/rules.js';
import type { DecisionsFile } from '../../types/decisions.js';
import { generateHeader, formatRulesAsMarkdown } from '../format.js';

export const copilotMdTarget: CompilerTarget = {
  name: 'copilot-md',
  displayName: '.github/copilot-instructions.md (Copilot)',
  outputPath: '.github/copilot-instructions.md',

  compile(rules: RulesFile, decisions?: DecisionsFile): string {
    const lines: string[] = [];
    lines.push(generateHeader(rules.healthScore));
    lines.push(`# Copilot Instructions — ${rules.project.name}`);
    lines.push('');
    lines.push(formatRulesAsMarkdown(rules.rules, decisions, {
      includeEvidence: false,
      includeDecisions: false,
    }));
    return lines.join('\n');
  },
};
