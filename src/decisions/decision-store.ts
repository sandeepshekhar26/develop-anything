// ============================================================
// auk — AI Context Engineering Platform
// Decision store — manages decisions.yaml persistence
// ============================================================

import type { Decision, DecisionsFile } from '../types/decisions.js';
import { loadYaml, saveYaml } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const DECISIONS_FILE = 'decisions.yaml';

/** Load decisions from .auk/decisions.yaml */
export async function loadDecisions(projectRoot: string): Promise<DecisionsFile> {
  const data = await loadYaml<DecisionsFile>(DECISIONS_FILE, projectRoot);
  return data || { version: 1, decisions: [] };
}

/** Save decisions to .auk/decisions.yaml */
export async function saveDecisions(data: DecisionsFile, projectRoot: string): Promise<void> {
  await saveYaml(DECISIONS_FILE, data, projectRoot);
  logger.debug(`Saved ${data.decisions.length} decisions`);
}

/** Add or update a decision */
export async function upsertDecision(decision: Decision, projectRoot: string): Promise<void> {
  const data = await loadDecisions(projectRoot);
  const existing = data.decisions.findIndex(d => d.id === decision.id);

  if (existing >= 0) {
    data.decisions[existing] = { ...data.decisions[existing], ...decision };
  } else {
    data.decisions.push(decision);
  }

  await saveDecisions(data, projectRoot);
}

/** Merge newly discovered decisions with existing ones */
export async function mergeDecisions(
  discovered: Decision[],
  projectRoot: string
): Promise<DecisionsFile> {
  const existing = await loadDecisions(projectRoot);
  const existingIds = new Set(existing.decisions.map(d => d.id));

  let added = 0;
  for (const decision of discovered) {
    if (!existingIds.has(decision.id)) {
      existing.decisions.push(decision);
      existingIds.add(decision.id);
      added++;
    }
  }

  if (added > 0) {
    await saveDecisions(existing, projectRoot);
    logger.success(`Added ${added} new decisions`);
  } else {
    logger.info('No new decisions found');
  }

  return existing;
}
