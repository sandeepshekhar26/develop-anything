# Changelog

All notable changes to auk are documented here. Format follows [Keep a Changelog](https://keepachangelog.com); versioning follows [SemVer](https://semver.org).

## [1.0.0] — 2026-06-11

### Added
- `auk init` — stack detection and first-time setup
- `auk generate` — codebase analysis: scanning, parsing, dependency graph, layer detection, convention mining, rule synthesis with evidence + confidence
- `auk verify` — context-rot detection: every rule becomes a machine-verifiable claim, scored valid/degraded/violated/obsolete relative to its generation-time baseline; `--ci` mode for pipelines
- `auk compile` — 7 targets from one source of truth: CLAUDE.md, AGENTS.md, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, `.aider.conf.yml`, GEMINI.md
- `auk review` — architectural diff review: layer-boundary violations, new circular dependencies, god-object growth, pattern suggestions from your own codebase
- `auk decisions` — git archaeology: mines commits, ADR files, and decision comments into a living `.auk/decisions.yaml`; rationale compiles into agent files
- `auk doctor` — generate + verify in one pass
- `auk badge` — shields.io endpoint JSON + standalone SVG context-health badge
- `auk mcp` — zero-dependency MCP stdio server exposing `get_rules`, `get_rule`, `get_health`, `get_architecture`, `get_dependencies`, `get_decisions`
- Reusable GitHub Action (`action.yml`) — verify + review on every PR with a posted comment
- **Zero runtime dependencies** — hand-rolled CLI framework, YAML engine, ANSI styling, and JSON-RPC; tests on built-in `node:test`
