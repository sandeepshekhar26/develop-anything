---
name: auk
description: Use when the user asks about codebase conventions, architecture rules, context health, CLAUDE.md generation, or wants AI context files kept in sync with the code. auk analyzes the codebase deterministically and generates verifiable rules.
---

# auk — AI context engineering

auk (`npx -y auk-develop`) generates, verifies, and compiles AI context from
the actual codebase.

## Commands
- `auk generate` — analyze code → `.auk/rules.yaml`, `graph.json`, `semantic.json`, compiled context files
- `auk verify` — re-check every rule against current code; reports context rot
- `auk review --diff <ref>` — architectural diff review (layer violations, new cycles, god objects)
- `auk enhance --emit` / `--apply <json>` — LLM enhancement loop (you write the JSON)
- `auk graph --open` — interactive dependency/call-graph viewer
- `auk mcp` — MCP server (tools: get_rules, get_architecture, get_call_graph, get_dependencies, get_enhancement_tasks, apply_enhancements, …)

## Conventions
- `.auk/rules.yaml`, `graph.json`, `decisions.yaml`, `semantic.json` should be committed; `.auk/cache.json` and `.auk/prompts/` gitignored.
- Never hand-edit compiled outputs (CLAUDE.md etc.); change rules and run `auk compile`.
- When enhancing rules, never alter ids, severities, or verification blocks — only descriptions/rationales via the response schema.
