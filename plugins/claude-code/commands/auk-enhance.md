---
description: Generate auk rules and LLM-enhance their descriptions using this session
---

Run the auk enhancement workflow:

1. Run `npx -y auk-develop generate --no-compile --emit-prompts` in the project root.
2. Read every `.auk/prompts/enhance-rules-NN.md` file.
3. For each batch, follow its instructions: rewrite each rule description to be
   clearer and more actionable, add a short rationale, and (optionally) example
   file references that exist in this repo. Read the evidence files when helpful.
4. Write each response to `.auk/prompts/enhance-rules-NN.response.json` exactly
   matching the response schema embedded in the prompt file.
5. Run `npx -y auk-develop enhance --apply <response file>` for each response.
   If auk reports skipped rules, fix the response and re-apply.
6. Run `npx -y auk-develop compile` to refresh CLAUDE.md, AGENTS.md, and the
   other agent context files.
7. Summarize what was enhanced.
