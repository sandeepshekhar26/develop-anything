// ============================================================
// auk — AI Context Engineering Platform
// Compiler engine — loads rules and compiles to all targets
// ============================================================

import type { RulesFile } from '../types/rules.js';
import type { DecisionsFile } from '../types/decisions.js';
import { getEnabledTargets } from './target-registry.js';
import type { CompilerTarget } from './target-registry.js';
import type { AukConfig, CompilerTargetName } from '../types/config.js';
import { loadYaml } from '../utils/config.js';
import { writeFileWithDir } from '../utils/file-utils.js';
import { logger } from '../utils/logger.js';
import * as path from 'path';

/** Compile rules to all enabled target formats */
export async function compileRules(
  projectRoot: string,
  config: AukConfig,
  options: { dryRun?: boolean; targets?: CompilerTargetName[] } = {}
): Promise<Map<string, string>> {
  // Load rules
  const rulesFile = await loadYaml<RulesFile>('rules.yaml', projectRoot);
  if (!rulesFile) {
    logger.warn('No rules file found. Run `auk generate` first.');
    return new Map();
  }
  if (!rulesFile.rules) rulesFile.rules = [];
  if (rulesFile.rules.length === 0) {
    // Still emit target files: the project overview is useful context even
    // when no conventions were mined (tiny codebases).
    logger.info('Rules file contains 0 rules — compiling overview only.');
  }

  // Load decisions if available
  const decisions = await loadYaml<DecisionsFile>('decisions.yaml', projectRoot);

  // Get enabled targets
  const targetNames = options.targets || config.targets;
  const targets = getEnabledTargets(targetNames);

  const outputs = new Map<string, string>();

  for (const target of targets) {
    const compiled = target.compile(rulesFile, decisions || undefined);
    const outputPath = path.join(projectRoot, target.outputPath);

    outputs.set(target.name, compiled);

    if (!options.dryRun) {
      writeFileWithDir(outputPath, compiled);
      logger.success(`${target.displayName} → ${target.outputPath}`);
    } else {
      logger.info(`[DRY RUN] ${target.displayName} → ${target.outputPath}`);
    }
  }

  return outputs;
}

// Shared formatting helpers live in ./format.js (kept separate to avoid
// a circular import: engine -> registry -> targets -> engine).
export { generateHeader, formatRulesAsMarkdown } from './format.js';
