// ============================================================
// auk — AI Context Engineering Platform
// Prompt emitter — host-agent LLM enhancement, no API keys.
// auk stays deterministic; the user's agent (Claude Code, Cursor,
// Copilot…) reads .auk/prompts/*.md, writes a response JSON, and
// `auk enhance --apply` validates and merges it into rules.yaml.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import type { Rule, RulesFile } from '../types/rules.js';
import { writeFileWithDir } from '../utils/file-utils.js';

const BATCH_SIZE = 10;
const MAX_EXCERPT_LINES = 18;

export const RESPONSE_SCHEMA_EXAMPLE = `{
  "version": 1,
  "batch": "<batch name>",
  "enhancements": [
    {
      "ruleId": "<existing rule id>",
      "description": "<rewritten description, 10-600 chars>",
      "rationale": "<optional: why this convention exists>",
      "examples": [{ "file": "<repo-relative path>", "note": "<what it shows>" }]
    }
  ]
}`;

/** Rules that still need enhancement (none yet, or core description changed) */
export function rulesNeedingEnhancement(rulesFile: RulesFile): Rule[] {
  return rulesFile.rules.filter(r => !r.enhanced || r.enhanced.stale);
}

/** Write enhancement prompt batches to .auk/prompts/; returns file paths */
export function emitPrompts(rulesFile: RulesFile, projectRoot: string): string[] {
  const pending = rulesNeedingEnhancement(rulesFile);
  const promptsDir = path.join(projectRoot, '.auk', 'prompts');
  const files: string[] = [];

  const batches: Rule[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  batches.forEach((batch, i) => {
    const batchName = `enhance-rules-${String(i + 1).padStart(2, '0')}`;
    const outPath = path.join(promptsDir, `${batchName}.md`);
    writeFileWithDir(outPath, renderBatch(batchName, i + 1, batches.length, batch, rulesFile, projectRoot));
    files.push(outPath);
  });

  if (files.length > 0) {
    writeFileWithDir(path.join(promptsDir, 'README.md'), README);
  }
  return files;
}

function renderBatch(batchName: string, n: number, total: number, rules: Rule[], rulesFile: RulesFile, projectRoot: string): string {
  const projectName = rulesFile.project.name;
  const ruleSections = rules.map(r => {
    const payload = {
      id: r.id,
      category: r.category,
      severity: r.severity,
      description: r.description,
      evidence: r.evidence.map(e => ({ file: e.file, line: e.line })),
      confidence: r.confidence,
    };
    const excerpts = renderExcerpts(r, projectRoot);
    return `## Rule: ${r.id}\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n${excerpts}`;
  }).join('\n');

  // Give the agent project orientation so enhancements are repo-specific.
  const ov = rulesFile.overview;
  const orientation = ov
    ? `## Project context\n\n${ov.summary}\n\n` +
      (ov.stack.length ? `**Stack:** ${ov.stack.join(', ')}\n\n` : '') +
      (ov.entrypoints.length ? `**Entrypoints:** ${ov.entrypoints.map(e => e.path).join(', ')}\n\n` : '') +
      (ov.directories.length ? `**Layout:**\n${ov.directories.map(d => `- ${d.path} — ${d.role}`).join('\n')}\n\n` : '')
    : '';

  return `# auk enhancement task (batch ${n}/${total})

You are enhancing AI-context rules for the project "${projectName}".

${orientation}For each rule below, rewrite the description so it is **specific to THIS
codebase**, not a generic best-practice. Name the actual files, directories,
types, or functions involved (use the code excerpts provided). Add a short
rationale explaining *why* the convention exists here and what breaks if it's
violated. Optionally add 1-2 example references (existing repo files only).

GUIDELINES:
- Be concrete: "Handlers in backend/internal/handlers/ accept *gin.Context and
  delegate to a service" beats "use consistent handler signatures".
- State the actionable rule an agent should follow when writing new code.
- Do NOT change rule ids, categories, severities, or verification logic.
- Descriptions must be 10-600 characters, plain text.
- Only reference files that exist in this repository.

${ruleSections}
## How to respond

Write a JSON file matching this schema to \`.auk/prompts/${batchName}.response.json\`:

\`\`\`json
${RESPONSE_SCHEMA_EXAMPLE.replace('<batch name>', batchName)}
\`\`\`

Then run: \`auk enhance --apply .auk/prompts/${batchName}.response.json\`
`;
}

/** Pull a few lines of real code around each evidence reference so the agent
    can ground its rewrite in the actual codebase rather than guessing. */
function renderExcerpts(rule: Rule, projectRoot: string): string {
  const refs = rule.evidence
    .filter(e => e.file && e.file !== 'various' && !e.file.endsWith('/'))
    .slice(0, 2);
  if (refs.length === 0) return '';

  const blocks: string[] = [];
  for (const ref of refs) {
    const abs = path.join(projectRoot, ref.file);
    let content: string;
    try { content = fs.readFileSync(abs, 'utf-8'); } catch { continue; }
    const all = content.split('\n');
    const center = ref.line && ref.line > 0 ? ref.line - 1 : 0;
    const start = Math.max(0, center - 3);
    const end = Math.min(all.length, start + MAX_EXCERPT_LINES);
    const snippet = all.slice(start, end)
      .map((l, idx) => `${String(start + idx + 1).padStart(4)} | ${l}`)
      .join('\n');
    const lang = path.extname(ref.file).slice(1) || '';
    blocks.push(`*${ref.file}${ref.line ? `:${ref.line}` : ''}*\n\n\`\`\`${lang}\n${snippet}\n\`\`\``);
  }
  if (blocks.length === 0) return '';
  return `\n**Code:**\n\n${blocks.join('\n\n')}\n`;
}

const README = `# auk enhancement prompts

These files are generated by \`auk generate --emit-prompts\` (or \`auk enhance --emit\`).

Workflow for an AI agent (Claude Code, Cursor, Copilot, …):
1. Read each \`enhance-rules-NN.md\` file.
2. Write the corresponding \`enhance-rules-NN.response.json\`.
3. Run \`auk enhance --apply <response file>\` — auk validates the JSON and
   merges it into \`.auk/rules.yaml\` without touching verification logic.
4. Run \`auk compile\` to regenerate CLAUDE.md / AGENTS.md / etc.

This directory is disposable; add it to .gitignore.
`;
