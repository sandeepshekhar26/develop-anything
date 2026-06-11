// ============================================================
// auk — AI Context Engineering Platform
// Target registry — plugin system for compiler targets
// ============================================================

import type { RulesFile } from '../types/rules.js';
import type { DecisionsFile } from '../types/decisions.js';
import type { CompilerTargetName } from '../types/config.js';
import { claudeMdTarget } from './targets/claude-md.js';
import { agentsMdTarget } from './targets/agents-md.js';
import { cursorRulesTarget } from './targets/cursor-rules.js';
import { copilotMdTarget } from './targets/copilot-md.js';
import { aiderConfTarget } from './targets/aider-conf.js';
import { windsurfRulesTarget } from './targets/windsurf-rules.js';
import { geminiSettingsTarget } from './targets/gemini-settings.js';

/** Interface for a compiler target */
export interface CompilerTarget {
  name: CompilerTargetName;
  displayName: string;
  outputPath: string;
  compile: (rules: RulesFile, decisions?: DecisionsFile) => string;
}

/** All registered targets */
const TARGET_REGISTRY: Record<CompilerTargetName, CompilerTarget> = {
  'claude-md': claudeMdTarget,
  'agents-md': agentsMdTarget,
  'cursor-rules': cursorRulesTarget,
  'copilot-md': copilotMdTarget,
  'aider-conf': aiderConfTarget,
  'windsurf-rules': windsurfRulesTarget,
  'gemini-settings': geminiSettingsTarget,
};

/** Get all available targets */
export function getAllTargets(): CompilerTarget[] {
  return Object.values(TARGET_REGISTRY);
}

/** Get specific enabled targets */
export function getEnabledTargets(names: CompilerTargetName[]): CompilerTarget[] {
  return names
    .filter(n => TARGET_REGISTRY[n])
    .map(n => TARGET_REGISTRY[n]);
}

/** Get a single target by name */
export function getTarget(name: CompilerTargetName): CompilerTarget | undefined {
  return TARGET_REGISTRY[name];
}
