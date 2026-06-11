// ============================================================
// auk — Compiler target: .windsurfrules
// ============================================================

import type { CompilerTarget } from '../target-registry.js';
import type { RulesFile } from '../../types/rules.js';
import type { DecisionsFile } from '../../types/decisions.js';
import { ruleDescription, generateHeader } from '../format.js';

export const windsurfRulesTarget: CompilerTarget = {
  name: 'windsurf-rules',
  displayName: '.windsurfrules (Windsurf)',
  outputPath: '.windsurfrules',

  compile(rules: RulesFile, _decisions?: DecisionsFile): string {
    const lines: string[] = [];
    lines.push(generateHeader(rules.healthScore));

    for (const rule of rules.rules) {
      lines.push(`- ${ruleDescription(rule).trim().replace(/\n/g, ' ')}`);
    }
    lines.push('');
    return lines.join('\n');
  },
};
