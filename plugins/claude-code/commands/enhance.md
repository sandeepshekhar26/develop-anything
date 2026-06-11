---
description: Deep-enhance auk rules (/auk:enhance) — this agent reads the code and rewrites every rule to be codebase-specific, then compiles all agent files
---

You are running auk's **deep pass**. auk has already extracted the structural
facts (tree-sitter parsing, call graph, clusters). Your job is the semantic
layer: turn its generic, machine-mined rules into sharp, codebase-specific
guidance — the part only an agent that can read the code can do.

Do this end to end, without asking the user to copy-paste anything:

1. **Emit the work.** Run `npx -y auk-develop generate --no-compile --emit-prompts`
   in the project root. This writes `.auk/prompts/enhance-rules-NN.md` batches.

2. **Read every batch file** under `.auk/prompts/`. Each contains rules, code
   excerpts, the project overview, and a response JSON schema.

3. **Do the analysis yourself.** For each rule, open the evidence files (and any
   neighbours you need) and rewrite the `description` so it is **specific to THIS
   repo**: name the actual directories, types, frameworks, and functions. Add a
   `rationale` explaining why the convention exists here and what breaks if it's
   violated. Prefer concrete instructions an agent can act on when writing new
   code. Process batches in parallel where practical.

   - Good: "HTTP handlers in `backend/internal/handlers/` take `*gin.Context`,
     validate with `ShouldBindJSON`, and delegate to a service in
     `internal/services/` — never put DB calls in a handler."
   - Bad: "Use consistent error handling."

4. **Write one `enhance-rules-NN.response.json` per batch**, matching the schema
   exactly. Only reference files that exist. Keep descriptions 10–600 chars.

5. **Apply each:** `npx -y auk-develop enhance --apply .auk/prompts/enhance-rules-NN.response.json`.
   If auk reports skipped rules, fix that response and re-apply.

6. **Compile:** `npx -y auk-develop compile` to refresh CLAUDE.md, AGENTS.md,
   `.cursor/rules`, copilot-instructions, etc. with the enhanced text.

7. **Summarize** what you sharpened, grouped by category.

Note: auk's deterministic verification logic is never touched by this — you are
only rewriting human-facing descriptions and rationales. The rules stay
machine-checkable by `auk verify`.
