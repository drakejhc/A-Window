# A Window

A calm day planner set inside a live window. The window follows the real weather, time of day and season
in a city you choose: rain streaks the glass when it's raining there, lamps come on at dusk, snow settles
in winter, and the northern lights show on clear nights in the far north. The planner sits beside it on a
pane of dark glass, and Focus mode turns the room into a place to work.

The planner started as a copy of Daylight (the Lovable app), rebuilt here around the window. The Lovable
project is untouched.

## Run it

```sh
npm install
npm run dev        # in the browser, with hot reload
npm run desktop    # as a desktop app
npm run dist       # build an installer into release/ (.dmg on a Mac, .exe on Windows, AppImage on Linux)
npm test
```

Build the installer on the system you want to run it on. The app isn't code-signed, so the first time you
open it on a Mac, right-click it and choose **Open**. The desktop app keeps its data between launches.

## Using it

- **The day sheet** shows the selected day. Pick a day from the week strip, or use ← and → (T jumps to today).
- **Quick add** understands phrases like `Gym tomorrow 7am 45m #health`. With a time it goes on the timeline;
  with a day but no time it takes the next free slot; otherwise it goes to a list. Press `/` or `N` to start typing.
- **Drag** blocks to move them, or drag tasks up from *Unscheduled*. The clock button finds the next free slot.
- **Click** a block or task to edit it: category, time, length, checklist, notes, or delete (with undo).
- **Replan** appears when tasks fall behind and moves them into the free time left today.
- **Focus** (`F`) works on the block happening now, or the next one, or a free session when the day is clear.
  Focused minutes are recorded on the block. `Space` pauses and `Esc` exits.
- **The window**: choose a city and scene in the bottom bar, and turn sound on. *Adjust* lets you pick the
  weather by hand, preview another time of day, set the free focus length and the volume. `P` hides the day sheet.

## How it fits together

| Folder | What's in it |
| --- | --- |
| `src/window/` | The live window: astronomy, weather, environment, renderer, procedural audio, and the scenes in `packs/` |
| `src/planner/` | The planner's data model, storage, quick-add parser and replanning (pure functions, tested) |
| `src/ui/` | React components: the scene canvas, day sheet, timeline, tray, editor, focus card, dock |
| `electron/` | The desktop shell, which serves the built app from a private `awindow://` origin |
| `scripts/artifact.mjs` | Turns the build into a page for publishing as a Claude artifact (`npm run artifact`) |

The window engine (`src/window/engine.ts`) runs one clock, weather feed and soundscape and knows nothing
about the planner. The planner knows nothing about the window. `App.tsx` is the only place they meet.

## Scenes

A scene ("window pack") draws only what makes it its own; the renderer handles the sky, weather and glass.
See `src/window/types.ts` for the `WindowPack` interface, and `packs/attic-room.ts` and `packs/fjord-cabin.ts`
for examples. Add a new pack to `PACKS` in `engine.ts` and it appears in the scene picker.

Weather comes from [Open-Meteo](https://open-meteo.com) (free, no key) and refreshes every 15 minutes.
Your plan is stored in this browser or app only (localStorage); there is no account.
