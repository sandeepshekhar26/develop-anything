// ============================================================
// auk — Compiler target: .gemini/settings.json or GEMINI.md
// ============================================================

import type { CompilerTarget } from '../target-registry.js';
import type { RulesFile } from '../../types/rules.js';
import type { DecisionsFile } from '../../types/decisions.js';
import { generateHeader, formatRulesAsMarkdown } from '../format.js';

export const geminiSettingsTarget: CompilerTarget = {
  name: 'gemini-settings',
  displayName: 'GEMINI.md (Gemini CLI)',
  outputPath: 'GEMINI.md',

  compile(rules: RulesFile, decisions?: DecisionsFile): string {
    const lines: string[] = [];
    lines.push(generateHeader(rules.healthScore));
    lines.push(`# Gemini Instructions — ${rules.project.name}`);
    lines.push('');
    lines.push(formatRulesAsMarkdown(rules.rules, decisions, {
      includeEvidence: true,
      includeDecisions: true,
    }));
    return lines.join('\n');
  },
};
