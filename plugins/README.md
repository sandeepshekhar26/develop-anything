# auk agent integrations

auk works standalone (`npx -y auk-develop generate`). These integrations add
the LLM-enhancement loop, which uses **your existing AI agent** — no API keys.

## Claude Code

```bash
# from a project using auk:
claude plugin install ./plugins/claude-code   # or copy into ~/.claude/plugins
```

Then run `/auk-enhance` inside Claude Code. Alternatively register the MCP server:

```json
{ "mcpServers": { "auk": { "command": "npx", "args": ["-y", "auk-develop", "mcp"] } } }
```

and ask the agent to use `get_enhancement_tasks` + `apply_enhancements`.

## Cursor / Copilot / other agents

Add this to your rules file (`.cursor/rules/auk.mdc`, `.github/copilot-instructions.md`, …):

> When asked to enhance auk rules: run `npx -y auk-develop enhance --emit`,
> read each `.auk/prompts/enhance-rules-NN.md`, write the matching
> `*.response.json` per the embedded schema, run
> `npx -y auk-develop enhance --apply <file>`, then `npx -y auk-develop compile`.

The flow is agent-agnostic: prompts in, schema-validated JSON out.
