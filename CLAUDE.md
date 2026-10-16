# A Window: notes for Claude

- If the user asks to "integrate Claude", "connect Claude", "let Claude edit my plan", "add the Claude
  connector", or similar: build what `docs/claude-connector.md` describes, following it step by step, and keep
  its rules. Ask before deviating from it.
- The planner is local-first: plan data stays in the app's storage; never add a server or account.
- Run `npx tsc --noEmit -p .` and `npx vitest run` before committing.
