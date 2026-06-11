// ============================================================
// auk — AI Context Engineering Platform
// Timeline renderer — renders decision evolution timeline
// ============================================================

import type { DecisionsFile, Decision } from '../types/decisions.js';
import { logger } from '../utils/logger.js';

/** Print decision timeline to terminal */
export function printTimeline(data: DecisionsFile): void {
  if (data.decisions.length === 0) {
    logger.info('No decisions tracked yet. Run `auk decisions --discover` to find them.');
    return;
  }

  logger.header('Decision Timeline');
  console.log();

  // Sort by date
  const sorted = [...data.decisions].sort((a, b) =>
    new Date(a.decidedAt).getTime() - new Date(b.decidedAt).getTime()
  );

  for (const decision of sorted) {
    const statusIcon = decision.status === 'active' ? '🟢' :
                       decision.status === 'evolving' ? '🟡' :
                       decision.status === 'deprecated' ? '🔴' : '⏸️';

    console.log(`  ${statusIcon} ${decision.decidedAt} — ${decision.title}`);
    console.log(`     By: ${decision.decidedBy}`);
    if (decision.rationale) {
      const rationale = decision.rationale.split('\n')[0].slice(0, 80);
      console.log(`     ${logger.brand.dim(rationale)}`);
    }
    if (decision.relatedRules.length > 0) {
      console.log(`     Rules: ${decision.relatedRules.join(', ')}`);
    }
    console.log();
  }

  console.log(`  Total: ${data.decisions.length} decisions tracked`);
  console.log();
}

/** Print details for a single decision */
export function printDecisionDetail(decision: Decision): void {
  logger.header(`Decision: ${decision.title}`);
  console.log();

  logger.keyValue('ID', decision.id);
  logger.keyValue('Status', decision.status);
  logger.keyValue('Decided At', decision.decidedAt);
  logger.keyValue('Decided By', decision.decidedBy);
  if (decision.commit) logger.keyValue('Commit', decision.commit);
  console.log();

  console.log('  Rationale:');
  for (const line of decision.rationale.split('\n')) {
    console.log(`    ${line}`);
  }
  console.log();

  if (decision.sources.length > 0) {
    console.log('  Sources:');
    for (const src of decision.sources) {
      console.log(`    - [${src.type}] ${src.ref || src.file || src.text || ''}`);
    }
    console.log();
  }

  if (decision.evolution.length > 0) {
    console.log('  Evolution:');
    for (const snap of decision.evolution) {
      console.log(`    ${snap.date} — ${snap.state} (${snap.adoption}%)`);
    }
    console.log();
  }

  if (decision.relatedRules.length > 0) {
    console.log(`  Related Rules: ${decision.relatedRules.join(', ')}`);
    console.log();
  }
}

/** Generate markdown timeline */
export function generateMarkdownTimeline(data: DecisionsFile): string {
  const lines: string[] = [];
  lines.push('# Decision Timeline');
  lines.push('');

  const sorted = [...data.decisions].sort((a, b) =>
    new Date(a.decidedAt).getTime() - new Date(b.decidedAt).getTime()
  );

  for (const d of sorted) {
    const icon = d.status === 'active' ? '🟢' : d.status === 'evolving' ? '🟡' : '🔴';
    lines.push(`## ${icon} ${d.title}`);
    lines.push(`- **Date:** ${d.decidedAt}`);
    lines.push(`- **By:** ${d.decidedBy}`);
    lines.push(`- **Status:** ${d.status}`);
    lines.push(`- **Rationale:** ${d.rationale.split('\n')[0]}`);
    lines.push('');
  }

  return lines.join('\n');
}
