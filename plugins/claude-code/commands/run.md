---
description: Full auk pipeline (/auk:run) — analyze the codebase, deep-enhance every rule with this agent, and compile all AI-context files in one shot
---

Run auk end to end so the user gets rich, codebase-specific AI-context files
from a single command. You (this agent) are the LLM that does the semantic pass —
do not ask the user to copy-paste prompts anywhere.

## 1. Analyze (deterministic)

Run `npx -y auk-develop generate --no-compile --emit-prompts` in the project
root. This parses the code (tree-sitter), builds the import + call graph,
mines conventions, clusters files, writes `.auk/rules.yaml` and
`.auk/graph.json`, and emits `.auk/prompts/enhance-rules-NN.md`.

## 2. Deep pass (you)

Read every `.auk/prompts/enhance-rules-NN.md`. For each rule, open the cited
evidence files and rewrite the `description` to be specific to THIS codebase —
naming real directories, frameworks, types, and functions — plus a `rationale`
for why it exists and what breaks if violated. Be concrete and actionable.
Work through batches in parallel where practical. Write each
`enhance-rules-NN.response.json` to match the embedded schema, then run
`npx -y auk-develop enhance --apply <file>` for each.

## 3. Compile

Run `npx -y auk-develop compile` to regenerate CLAUDE.md, AGENTS.md,
`.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`,
`.aider.conf.yml`, and GEMINI.md from the enhanced rules.

## 4. Report

Tell the user how many rules were generated and enhanced, the project overview
auk detected (stack, entrypoints, directory map), and remind them they can:
- run `auk verify` (or `auk verify --ci`) to catch context rot over time,
- run `auk graph --open` to explore the dependency/call graph,
- commit `.auk/rules.yaml`, `graph.json`, and the compiled files.
