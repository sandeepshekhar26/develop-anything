# auk agent integrations

auk works standalone (`npx -y auk-develop generate`), but the **deep pass** —
rewriting each mined rule into sharp, codebase-specific guidance — is best done
by an agent that can read your code. These integrations make that one command.

The split is deliberate:

- **Structural facts** (parsing, call graph, clusters, conventions) come from the
  deterministic `auk-develop` CLI — fast, free, repeatable.
- **Semantic depth** (why a rule exists, what breaks if violated, the real file
  and type names) comes from *your* agent during the deep pass — no API keys,
  no copy-paste.

## Claude Code (recommended)

Install from this repo as a plugin marketplace:

```
/plugin marketplace add sandeepshekhar26/develop-anything
/plugin install auk
```

Then, in any project:

```
/auk:run        # full pipeline: analyze → deep-enhance every rule → compile all files
/auk:enhance    # just the deep-enhance pass on existing rules, then compile
```

`/auk:run` runs `auk generate --emit-prompts`, the agent reads `.auk/prompts/*` and
the cited code, writes the enhanced rules back, applies them, and compiles
CLAUDE.md / AGENTS.md / `.cursor/rules` / copilot-instructions — all in one go.

You can also register the MCP server for live queries:

```json
{ "mcpServers": { "auk": { "command": "npx", "args": ["-y", "auk-develop", "mcp"] } } }
```

and ask the agent to use `get_enhancement_tasks` + `apply_enhancements`.

## Cursor / Copilot / Codex / Gemini CLI / other agents

The deep pass is agent-agnostic. Add this to your agent's rules file
(`.cursor/rules/auk.mdc`, `.github/copilot-instructions.md`, `GEMINI.md`, …):

> When asked to set up or refresh auk context: run
> `npx -y auk-develop generate --no-compile --emit-prompts`, read every
> `.auk/prompts/enhance-rules-NN.md`, open the cited code, and rewrite each rule
> to be specific to this codebase (real dirs, types, frameworks) with a
> rationale. Write each `enhance-rules-NN.response.json` per the embedded schema,
> run `npx -y auk-develop enhance --apply <file>` for each, then
> `npx -y auk-develop compile`.

Prompts in, schema-validated JSON out — the same loop the Claude Code command
automates.
