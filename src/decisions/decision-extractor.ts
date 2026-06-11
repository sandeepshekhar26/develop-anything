// ============================================================
// auk — AI Context Engineering Platform
// Decision extractor — extracts decisions from multiple sources
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Decision, DecisionSource, DecisionSourceType } from '../types/decisions.js';
import type { Rule } from '../types/rules.js';
import { findDecisionCommits, getFileHistory, getAuthors } from './git-archaeologist.js';
import { logger } from '../utils/logger.js';

/** Extract decisions from all available sources */
export function discoverDecisions(
  rules: Rule[],
  projectRoot: string
): Decision[] {
  const decisions: Decision[] = [];

  // 1. Extract from git history
  const commitDecisions = extractFromCommits(projectRoot);
  decisions.push(...commitDecisions);

  // 2. Extract from ADR files
  const adrDecisions = extractFromADRs(projectRoot);
  decisions.push(...adrDecisions);

  // 3. Extract from code comments
  const commentDecisions = extractFromComments(rules, projectRoot);
  decisions.push(...commentDecisions);

  // 4. Link decisions to rules
  for (const decision of decisions) {
    for (const rule of rules) {
      if (rule.id.includes(decision.id) || decision.id.includes(rule.id) ||
          decision.title.toLowerCase().includes(rule.category)) {
        if (!decision.relatedRules.includes(rule.id)) {
          decision.relatedRules.push(rule.id);
        }
        if (!rule.decisionRef) {
          rule.decisionRef = decision.id;
        }
      }
    }
  }

  logger.debug(`Discovered ${decisions.length} decisions`);
  return decisions;
}

/** Extract decisions from meaningful commits */
function extractFromCommits(projectRoot: string): Decision[] {
  const decisions: Decision[] = [];
  const commits = findDecisionCommits(projectRoot);

  for (const commit of commits) {
    const id = `commit-${commit.hash.slice(0, 8)}-${slugify(commit.message)}`;

    decisions.push({
      id,
      title: commit.message.replace(/^(refactor|feat|fix|chore|arch|breaking):\s*/i, ''),
      decidedAt: commit.date,
      decidedBy: commit.author,
      commit: commit.hash,
      rationale: commit.message,
      sources: [{
        type: 'commit',
        ref: commit.hash,
        message: commit.message,
      }],
      evolution: [{
        date: commit.date,
        adoption: 0,
        state: `Introduced: ${commit.message}`,
      }],
      status: 'active',
      relatedRules: [],
    });
  }

  return decisions;
}

/** Extract decisions from ADR files */
function extractFromADRs(projectRoot: string): Decision[] {
  const decisions: Decision[] = [];
  const adrDirs = ['docs/adr', 'docs/decisions', 'adr', 'decisions', 'doc/adr'];

  for (const dir of adrDirs) {
    const adrPath = path.join(projectRoot, dir);
    if (!fs.existsSync(adrPath)) continue;

    try {
      const files = fs.readdirSync(adrPath).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(adrPath, file), 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        const statusMatch = content.match(/## Status\s*\n\s*(\w+)/i);
        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);

        const id = `adr-${path.basename(file, '.md')}`;
        decisions.push({
          id,
          title: titleMatch?.[1] || path.basename(file, '.md'),
          decidedAt: dateMatch?.[1] || new Date().toISOString().split('T')[0],
          decidedBy: 'team',
          rationale: content.slice(0, 500),
          sources: [{
            type: 'adr',
            file: `${dir}/${file}`,
          }],
          evolution: [],
          status: (statusMatch?.[1]?.toLowerCase() as any) || 'active',
          relatedRules: [],
        });
      }
    } catch { /* skip unreadable dirs */ }
  }

  return decisions;
}

/** Extract decisions from code comments */
function extractFromComments(rules: Rule[], projectRoot: string): Decision[] {
  const decisions: Decision[] = [];

  // Look for files referenced in rules
  for (const rule of rules) {
    for (const evidence of rule.evidence) {
      if (!evidence.file || evidence.file.includes('*')) continue;

      const filePath = path.join(projectRoot, evidence.file);
      if (!fs.existsSync(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Look for decision-like comments
          if (line.match(/\/\/\s*(Decision|Why|ADR|Note):/i) ||
              line.match(/#\s*(Decision|Why|ADR|Note):/i)) {
            const text = line.replace(/^[\/\/#\s]*(Decision|Why|ADR|Note):\s*/i, '');

            decisions.push({
              id: `comment-${rule.id}-${i}`,
              title: text.slice(0, 80),
              decidedAt: new Date().toISOString().split('T')[0],
              decidedBy: getAuthors(evidence.file, projectRoot)[0] || 'unknown',
              rationale: text,
              sources: [{
                type: 'comment',
                file: evidence.file,
                line: i + 1,
                text,
              }],
              evolution: [],
              status: 'active',
              relatedRules: [rule.id],
            });
          }
        }
      } catch { /* skip */ }
    }
  }

  return decisions;
}

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}
