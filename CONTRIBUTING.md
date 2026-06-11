# Contributing to auk

Thanks for your interest! auk is intentionally easy to hack on: **zero runtime dependencies**, plain TypeScript, and tests on built-in `node:test`.

## Development setup

Requires Node ≥ 22.6 (for built-in TypeScript type stripping — no build step needed during development).

```bash
git clone https://github.com/sandeepshekhar26/develop-anything.git
cd develop-anything

npm run dev -- --help     # run the CLI straight from source
npm test                  # run the full test suite (no install required!)

npm install               # only needed for building/publishing (tsup + tsc)
npm run typecheck
npm run build
```

## Project layout

```
src/
├── index.ts        CLI entry — registers all commands
├── commands/       one file per command (init, generate, verify, compile,
│                   review, decisions, doctor, badge, mcp)
├── analyzer/       scanner, parser, import graph, pattern miner, layers
├── generator/      analysis → rules (synthesizer, priority ranker)
├── verifier/       rules → claims → verification → health score
├── compiler/       rules.yaml → per-tool output (targets/ = plugin registry)
├── reviewer/       diff parsing, graph overlay, violation detection
├── decisions/      git archaeology, decision extraction & storage
└── utils/          zero-dep building blocks: cli.ts, yaml.ts, logger.ts, git.ts
```

## Easy wins (good first issues)

- **New compiler target** — implement the `CompilerTarget` interface in
  `src/compiler/targets/`, register it in `target-registry.ts`. ~50 lines.
  Wanted: Zed, Continue, JetBrains AI Assistant, Amazon Q.
- **New convention miner** — add a detector in `src/analyzer/pattern-miner.ts`
  and map it to a machine-verifiable check in `src/generator/rule-synthesizer.ts`.
- **Language depth** — improve symbol/import extraction in `src/analyzer/parser.ts`.

## Rules of the road

1. **Zero runtime dependencies is a hard constraint.** If you need a library, write the minimal subset in `src/utils/`.
2. Every rule auk generates must carry **evidence** (file:line) and, where possible, a **machine-verifiable claim**. No vibes-based rules.
3. Add tests (`tests/**/*.test.ts`, node:test + the local `expect` helper).
4. Keep PRs focused; one feature per PR.

## Release flow (maintainers)

Tag `vX.Y.Z` → CI tests, builds, publishes to npm with provenance, and creates a GitHub release.
