<div align="center">

# 🪶 auk

### The AI Context Engineering Platform

**One command. Every AI coding tool understands your codebase.**

[![CI](https://github.com/sandeepshekhar26/develop-anything/actions/workflows/ci.yml/badge.svg)](https://github.com/sandeepshekhar26/develop-anything/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/auk-develop)](https://www.npmjs.com/package/auk-develop)
[![Dependencies](https://img.shields.io/badge/dependencies-1%20(tree--sitter)-brightgreen)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)](https://nodejs.org)

```bash
npx auk-develop init && npx auk-develop generate
```

*30 seconds later: CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md — all derived from your **actual code**, not templates.*

</div>

---

## The problem

Every AI coding tool needs context about your codebase — and today you write it by hand:

- **It's generic.** "Use TypeScript. Write clean code." Your agent already knew that.
- **It rots.** You migrated from axios to fetch six months ago. Your CLAUDE.md still says axios. Your AI confidently writes axios.
- **It's fragmented.** CLAUDE.md for Claude Code, `.cursor/rules` for Cursor, `.github/copilot-instructions.md` for Copilot, `.windsurfrules`, `.aider.conf.yml`, GEMINI.md… all drifting apart.
- **It has no memory.** Your codebase made hundreds of architectural decisions. Nobody wrote down why. Your AI can't tell an intentional pattern from an accident.

Existing tools visualize your code (knowledge graphs, dashboards) or manage hand-written rules. **Nobody builds the context *from* the code.** auk does.

## What auk generates

Not this:

> *"Use TypeScript. Follow existing patterns. Write clean code."*

This:

> 🔴 **Error handling uses the `Result<T,E>` pattern from `src/types/result.ts` — never throw in the service layer, always return Result.** *(94% of services follow this — verified)*
>
> 🔴 **Services never import from Controllers. 3 existing violations are known tech debt — don't add more.** *(verified on every commit)*
>
> 🟡 **`UserService` has 11 connections and is becoming a god object — don't add more responsibilities.**

Every rule carries **evidence** (`file:line` references), a **confidence score**, and a **machine-verifiable claim** — so it can be proven true or flagged as rot, automatically.

## Quick start

```bash
cd your-project
npx auk-develop init        # detect your stack, create .auk/
npx auk-develop generate    # analyze code → rules → all agent formats
```

That's it. Now every AI tool you use reads context derived from your real code.

## The commands

| Command | What it does |
|:--|:--|
| `auk generate` | **Tree-sitter AST analysis** → mines conventions, builds the file *and function-level call graph*, clusters similar files semantically → writes `.auk/rules.yaml` + compiles all agent files |
| `auk verify` | **Context-rot detection.** Re-checks every rule against the codebase: ✅ valid / ⚠️ degraded / ❌ violated / 💀 obsolete. Exit code 1 in `--ci` mode |
| `auk compile` | One source of truth → CLAUDE.md, AGENTS.md, `.cursor/rules/*.mdc`, copilot-instructions.md, `.windsurfrules`, `.aider.conf.yml`, GEMINI.md |
| `auk review` | **Architectural PR review.** Maps your diff onto the dependency graph: catches layer violations, new circular deps, god objects forming — and suggests existing patterns from *your own code* |
| `auk decisions` | **Git archaeology.** Mines commit history, ADRs, and code comments to recover *when, who, and why* behind every convention |
| `auk badge` | Context-health badge for your README — like a coverage badge, but for AI context |
| `auk mcp` | **Live MCP server.** Agents query your rules, graph, and decisions in real time instead of reading a static file |
| `auk graph` | **Interactive graph viewer.** One self-contained HTML file (no CDN): force-directed dependency + call graph, colored by layer, with search and per-symbol fan-in/out. `--open` / `--serve` |
| `auk enhance` | **LLM polish without API keys.** Emits prompt batches your own AI agent (Claude Code, Cursor, Copilot…) processes; auk schema-validates the response and merges it — verification logic stays untouchable |

## Context rot detection

The feature that makes auk different: **every rule is a testable claim.**

```text
▸ Context Health Report
──────────────────────────────────────────────
  🟡 Overall Health Score: 80/100

  ✅ 2 rules are valid
  ⚠️ 2 rules are degraded

  ⚠️ exports-named-only
     1/7 files contain forbidden pattern "export default"
  ⚠️ error-handling-result-pattern
     3/7 files contain pattern "Result<"   (was 6/6 at generation)
```

Hook it into CI and your context files can never silently lie to your AI again:

```yaml
# .github/workflows/context-health.yml
- uses: sandeepshekhar26/develop-anything@v1
  with:
    fail-on-violations: true   # posts a PR comment + fails on rot
```

## Architectural PR review

`auk review` knows your architecture because it built the graph:

```text
❌ [rule-violation] src/services/report-service.ts
   New import violates "architecture-no-service-to-controller":
   Service layer should not import from Controller layer.
   1 existing violation is known tech debt — don't add more.
```

A linter checks syntax. `auk review` checks **intent**: layer boundaries, dependency direction, centrality growth, cycles — derived from your codebase, not a generic ruleset.

## Live context via MCP

Static context files have a ceiling — they're snapshots. `auk mcp` exposes your architecture as a queryable [MCP](https://modelcontextprotocol.io) server:

```json
{
  "mcpServers": {
    "auk": { "command": "npx", "args": ["-y", "auk-develop", "mcp"] }
  }
}
```

Your agent can now ask: *which files depend on `payment-service.ts`?* — *what's the error-handling convention here?* — *why does this codebase forbid Controller imports in Services?* — and get answers backed by the actual graph, decision log, and verified rules.

Tools exposed: `get_rules`, `get_rule`, `get_health`, `get_architecture`, `get_dependencies`, `get_call_graph`, `get_decisions`, `get_enhancement_tasks`, `apply_enhancements`.

## LLM enhancement — your agent, no API keys

auk's analysis is deterministic; descriptions can still read mechanically. Instead of calling an LLM API (keys, cost, privacy), auk delegates to **the AI agent you already pay for**:

```bash
auk generate --emit-prompts     # writes .auk/prompts/enhance-rules-NN.md
# your agent writes enhance-rules-NN.response.json per the embedded schema
auk enhance --apply .auk/prompts/enhance-rules-01.response.json
auk compile
```

The response is schema-validated: unknown rule ids, oversized text, or attempts to touch verification logic are rejected. Enhanced descriptions survive regeneration and are marked stale if the underlying code pattern changed.

Claude Code users: install the plugin in [`plugins/claude-code/`](plugins/) and run `/auk-enhance` — it does the whole loop. Cursor/Copilot instructions are in [`plugins/README.md`](plugins/README.md).

## Decision archaeology

```bash
auk decisions --discover
```

```yaml
# .auk/decisions.yaml
- id: comment-error-handling-result-pattern-0
  title: All services return Result<T,E> — throw hides control flow
  decidedBy: skumar
  sources:
    - type: comment
      file: src/types/result.ts
      line: 1
  relatedRules: [error-handling-result-pattern]
```

The *why* gets compiled into CLAUDE.md/AGENTS.md too — so agents understand not just **what** the rules are, but **why they exist** (and when it's safe to push back).

## Why auk vs …

| | Visualizers (knowledge graphs) | Rule managers | **auk** |
|:--|:--:|:--:|:--:|
| Reads your actual code | ✅ | ❌ | ✅ |
| Generates agent context | ❌ | ✅ (hand-written) | ✅ (derived) |
| Verifies context is still true | ❌ | ❌ | ✅ |
| Reviews PRs architecturally | ❌ | ❌ | ✅ |
| Tracks decision history | ❌ | ❌ | ✅ |
| Live agent queries (MCP) | ❌ | ❌ | ✅ |
| Dependencies | many | some | **one** (tree-sitter) |

## One dependency. Really.

```json
"dependencies": { "web-tree-sitter": "0.26.9" }
```

Real AST parsing via tree-sitter (WASM grammars bundled — no native compilation, no downloads), with a zero-dep regex fallback so `npx` never fails. Everything else — CLI framework, YAML engine, TF-IDF engine, ANSI colors, diff parser, MCP server, graph viewer — is hand-rolled inside the package and fully tested (77 tests on plain `node:test`).

## How it works

```text
            ┌──────────────┐
 your code →│  generate    │→ .auk/rules.yaml  (+ graph.json, decisions.yaml)
            └──────┬───────┘
                   │
      ┌────────────┼────────────────┐
      ▼            ▼                ▼
 ┌─────────┐  ┌─────────┐    ┌───────────┐
 │ compile │  │ verify  │    │  review   │
 └────┬────┘  └────┬────┘    └─────┬─────┘
      ▼            ▼               ▼
 CLAUDE.md     health score   PR violations
 AGENTS.md     (rot report)   + suggestions
 .cursorrules      │
 copilot, etc.     ▼
              README badge
```

1. **Scan** — walks the tree (gitignore-aware), detects languages; unchanged files reuse the incremental cache
2. **Parse** — tree-sitter AST extraction (TS/TSX/JS/Python/Go/Java/Rust) with body spans, call sites, and complexity; regex fallback for other languages
3. **Graph** — file-level import graph **plus a function-level call graph**: layers, cycles, hub files, hotspot functions (fan-in), god classes
4. **Mine** — statistical convention detection + **TF-IDF semantic clustering** ("these 12 files share the handler shape — new ones should too")
5. **Synthesize** — converts patterns into prioritized, *evidence-backed* rules
6. **Compile** — emits every agent format from one source of truth
7. **Verify** — re-checks each claim on every run; health = % still true

Languages with full AST analysis: TypeScript, JavaScript, Python, Go, Java, Rust. Regex-level support: Ruby, PHP, C#.

**Commit the output.** `.auk/rules.yaml`, `graph.json`, `semantic.json`, and `decisions.yaml` are deterministic (same code → byte-identical output) — commit them so teammates and CI skip regeneration. Gitignore `.auk/cache.json` and `.auk/prompts/`.

## FAQ

**Does it send my code anywhere?** No. 100% local static analysis. No LLM calls, no telemetry, no network. The optional `auk enhance` flow uses *your own* AI agent locally — auk itself never talks to an API.

**Will it overwrite my hand-written CLAUDE.md?** `generate` writes compiled files marked with a header. Keep hand-written content in `.auk/rules.yaml` as custom rules — they survive regeneration and compile to every format.

**Node version?** Runtime: Node ≥ 20. Running tests / from-source dev uses Node ≥ 22.6 (built-in type stripping).

## Contributing

`git clone` → `npm run dev` (runs from source, no install needed) → `npm test`. See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues: new compiler targets (Zed, Continue, JetBrains AI), new convention miners, language depth.

## License

[MIT](LICENSE) © Sandeep Kumar

---

<div align="center">

**If auk saved your AI from a stale CLAUDE.md, [star the repo ⭐](https://github.com/sandeepshekhar26/develop-anything) — it helps others find it.**

</div>
