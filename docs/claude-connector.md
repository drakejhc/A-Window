# Build plan: let people use their own Claude to update their plan

Goal: a user types into Claude Code or the Claude desktop app something like *"move my study blocks to
tomorrow afternoon and add 30 minutes for groceries"*, and Claude edits their A Window planner. Each user uses
their own Claude subscription; the app sends nothing to Anthropic itself and needs no API key.

How: the desktop app ships a small **MCP server** (Model Context Protocol) that Claude launches. It exposes
planner actions as tools and talks to the running A Window app over a local, authenticated connection.

## Architecture

```
Claude Code / Claude desktop ──stdio──▶ electron/mcp.cjs (MCP server, a separate Node process)
                                              │  HTTP on 127.0.0.1:<port>, bearer token
                                              ▼
                                   electron/main.cjs (bridge endpoint)
                                              │  IPC
                                              ▼
                       renderer: src/planner/store.ts (usePlanner) applies the change, saves, re-renders
```

- **Why through the running app:** the plan lives in the renderer's localStorage (`a-window:planner-v1`,
  `src/planner/store.ts`). Writing it from outside would race the open app. Routing every change through the
  renderer keeps one writer, keeps the UI live, and keeps undo working.
- **When the app isn't running:** `mcp.cjs` should say so ("Open A Window and try again"). Optional later: launch
  the app hidden with `--hidden` (already supported by `electron/main.cjs`) and retry.

## Pieces to build

1. **`src/planner/actions.ts` (pure, tested).** Plain functions over `PlannerData` (types in `src/planner/model.ts`),
   each returning the new data plus a short description of the change:
   - `listDay(data, date)` → blocks for a day (use `blocksOn`); `listTasks(data, bucket?)`.
   - `addTask`, `addEvent` (title, date `YYYY-MM-DD`, start hour as a number like 14.5, duration minutes,
     category, optional repeat), `updateItem(id, patch)`, `moveItem(id, date, start)`, `completeTask(id)`,
     `deleteItem(id, date?)` (for a repeating event, `date` skips one occurrence like `skipOccurrence`).
   - `findFreeSlot(data, date, minutes)` and `replan(data, now)`: reuse `src/planner/planning.ts`, the same
     collision rules as click-scheduling and timeline drops.
   - Parse loose phrasing with `src/planner/quickadd.ts` where a tool takes free text.
   Add tests next to the existing ones in `src/test/`.
2. **Renderer hook.** In `src/App.tsx`, listen for bridge requests (a new `onPlannerRequest` in
   `electron/preload.cjs` / `src/desktop.ts`), run the matching action against the current state through the
   `usePlanner` setters so it saves and re-renders, keep the previous state for the existing Undo toast, and
   reply with the result or an error.
3. **Bridge in `electron/main.cjs`.** A tiny HTTP server on `127.0.0.1` (random port), accepting only requests
   with a random token. Write `{ port, token }` to `app.getPath("userData")/mcp.json` (owner-readable only).
   Forward each request to the main window over IPC and return the reply. Respect the existing single-instance lock.
4. **`electron/mcp.cjs`.** An MCP server over stdio using `@modelcontextprotocol/sdk`. Tools (clear descriptions,
   JSON-schema inputs): `get_today`, `get_day`, `list_tasks`, `add_task`, `add_event`, `move_item`, `update_item`,
   `complete_task`, `delete_item`, `find_free_slot`, `replan_today`. Each reads `mcp.json` and calls the bridge.
   Include "today's date and the user's time zone" in `get_today` so Claude resolves "tomorrow" correctly.
5. **Packaging.** Add `electron/mcp.cjs` to `build.files` in `package.json`. The installed app runs it with its own
   Node: `"<A Window executable>" --mcp`. Handle that flag at the top of `electron/main.cjs` by requiring
   `mcp.cjs` and not opening any windows.
6. **Settings → "Use with Claude".** A section in `src/ui/SettingsPanel.tsx` (desktop only) with an on/off switch
   (bridge off by default) and a copy button for the setup line:
   - Claude Code: `claude mcp add a-window -- "<path to A Window>" --mcp`
   - Claude desktop: the matching `mcpServers` entry for `claude_desktop_config.json`.
7. **Docs.** A short section in `README.md` and `INSTALL.md`.

## Rules
- Bridge off until the user turns it on; bind to 127.0.0.1 only; require the token; never log plan contents.
- Every change Claude makes is undoable in the app, and the app shows a toast: "Claude moved 3 blocks · Undo".
- Destructive tools (`delete_item`, `replan_today`) describe what they will change in their result.
- Keep the planner local-first: nothing about this sends data anywhere except to the user's own Claude.

## Done when
- `npx tsc --noEmit -p .` and `npx vitest run` pass, with tests for `actions.ts`.
- With the app open, `claude mcp add …` then "what's on today?" and "add a 30 min walk at 5pm" work, and the
  block appears in A Window without a reload.
