# A Window: notes for Claude

- If the user asks to "integrate Claude", "connect Claude", "let Claude edit my plan", "add the Claude
  connector", or similar: build what `docs/claude-connector.md` describes, following it step by step, and keep
  its rules. Ask before deviating from it.
- The planner is local-first: plan data stays in the app's storage; never add a server or account.
- Run `npx tsc --noEmit -p .` and `npx vitest run` before committing.
- Shipping to installed apps: the Windows and Linux apps update themselves from this repo's GitHub releases. To
  release, bump `version` in package.json, commit, then `git tag vX.Y.Z && git push awindow vX.Y.Z`; the Release
  workflow builds and publishes it. The version must go up, or installed apps won't see the update.
- The product's agreed objective is the checklist at the top of `docs/roadmap.md`. Work toward it, tick items off
  as they ship, and keep the log at the bottom of that file current.
- The owner builds and runs the app on Windows from `C:\Users\drake\A-Window`. Whenever you give them commands to
  run on their PC, make `cd C:\Users\drake\A-Window` the first command.
