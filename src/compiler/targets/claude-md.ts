// ============================================================
// auk — Compiler target: CLAUDE.md
// ============================================================

import type { CompilerTarget } from '../target-registry.js';
import type { RulesFile } from '../../types/rules.js';
import type { DecisionsFile } from '../../types/decisions.js';
import { generateHeader, formatRulesAsMarkdown } from '../format.js';

export const claudeMdTarget: CompilerTarget = {
  name: 'claude-md',
  displayName: 'CLAUDE.md (Claude Code)',
  outputPath: 'CLAUDE.md',

  compile(rules: RulesFile, decisions?: DecisionsFile): string {
    const lines: string[] = [];

    lines.push(generateHeader(rules.healthScore));
    lines.push(`# Project: ${rules.project.name}`);
    lines.push('');
    lines.push(`**Languages:** ${rules.project.languages.join(', ')}`);
    if (rules.project.framework) {
      lines.push(`**Framework:** ${rules.project.framework}`);
    }
    lines.push(`**Rules:** ${rules.rules.length} | **Health:** ${rules.healthScore}%`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // Critical rules first (Claude context window optimization)
    const critical = rules.rules.filter(r => r.severity === 'critical');
    if (critical.length > 0) {
      lines.push('## ⚠️ Critical Rules (ALWAYS follow these)');
      lines.push('');
      for (const rule of critical) {
        lines.push(`- **${rule.id}**: ${rule.description.trim()}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // All rules by category
    lines.push(formatRulesAsMarkdown(rules.rules, decisions, {
      includeEvidence: true,
      includeDecisions: true,
    }));

    return lines.join('\n');
  },
};
