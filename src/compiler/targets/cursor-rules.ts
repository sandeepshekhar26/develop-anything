// ============================================================
// auk — Compiler target: .cursor/rules/*.mdc
// ============================================================

import type { CompilerTarget } from '../target-registry.js';
import type { RulesFile } from '../../types/rules.js';
import type { DecisionsFile } from '../../types/decisions.js';
import { generateHeader } from '../format.js';

export const cursorRulesTarget: CompilerTarget = {
  name: 'cursor-rules',
  displayName: '.cursor/rules (Cursor)',
  outputPath: '.cursor/rules/auk-rules.mdc',

  compile(rules: RulesFile, decisions?: DecisionsFile): string {
    const lines: string[] = [];

    // MDC front matter
    lines.push('---');
    lines.push(`description: "Auto-generated rules for ${rules.project.name} by auk"`);
    lines.push('globs:');
    lines.push('alwaysApply: true');
    lines.push('---');
    lines.push('');
    lines.push(generateHeader(rules.healthScore));

    for (const rule of rules.rules) {
      const severity = rule.severity === 'critical' ? '🔴' : rule.severity === 'warning' ? '🟡' : 'ℹ️';
      lines.push(`${severity} **${rule.id}**: ${rule.description.trim()}`);
      lines.push('');
    }

    return lines.join('\n');
  },
};
