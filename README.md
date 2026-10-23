# A Window

A calm day planner set inside a live window. The window follows the real weather, time of day and season
in a city you choose: rain streaks the glass when it's raining there, lamps come on at dusk, snow settles
in winter, and the northern lights show on clear nights in the far north. The planner sits beside it on a
pane of dark glass, and Focus mode turns the room into a place to work.

The planner started as a copy of Daylight (the Lovable app), rebuilt here around the window. The Lovable
project is untouched.

## Download

Installers for Mac, Windows and Linux are on this project's **Releases** page. See [INSTALL.md](INSTALL.md) for
step-by-step instructions (including the one-time security prompts), and [RELEASING.md](RELEASING.md) for how to
publish a new version.

## Run it from the source

```sh
npm install
npm run dev        # in the browser, with hot reload
npm run desktop    # as a desktop app
npm run dist       # build an installer for this computer into release/
npm test
```

## Using it

- **The planner** fades in over the window with the **Planner** button (or `P`) and fades out again when you
  press it once more, or when you start Focus. `Esc` hides it too. It has Daylight's layout: a sidebar with
  the mini calendar, task lists and today's progress; Day, Week and Month views (`D`, `W`, `M`); and the task
  tray on the right. Prefer the window to stay in view? *Adjust → Planner → Side sheet* puts a slimmer day
  sheet beside the window instead.
- **Add a task** with the **Task** button (`⌘K`, `/` or `N`), or type into the *Add to…* field at the top of each
  task list and in the tray. It understands phrases like `Gym tomorrow 7am 45m #health`. With a time it goes on the
  timeline; with a day but no time it takes the next free slot; otherwise it goes to the list you're looking at.
  Paste a list (one per line, bullets and checkboxes are fine) to add a task per line. A new item in the editor has
  a Task / Event switch.
- **Click** an empty part of the timeline to start an event at that time. The timeline covers the whole day,
  midnight to midnight.
- **Drag** blocks to move them (across days in Week view), or drag tasks from the tray. The clock button on a
  tray task finds the next free slot.
- **Click** a block or task to edit it: category, time, length, checklist, notes, or delete (with undo).
- **Replan** (`R`) moves tasks that fell behind into the free time left today.
- **Focus** (`F`) works on the block happening now, or the next one, or a free session when the day is clear.
  Focused minutes are recorded on the block. `Space` pauses and `Esc` exits.
- **The window**: search for any city or town (Coquitlam, say) and choose a room in the bottom bar. Places you've
  picked stay at the top of the list.
  - **Painted rooms:** the *Midnight study* and the *Cozy bedroom* are 2D paintings, with brushwork, hand-drawn
    edges and grain. Each is painted in night, day and lamplight and blended live. Sunlight through the window
    falls across the desk, bed and floor and slides with the real sun.
  - **3D rooms:** the Listening room, a Nordic cabin and a Mediterranean room.
  - **Views:** every room looks out on a painted view, the *Painted city* or the *Painted valley*. Any room goes
    with any view.
  - **Auto** picks a room to suit the city: the cabin in the far north and south, the study in East Asia, the
    Mediterranean room where it's warm, and the Listening room elsewhere.
  - **Your own background:** the last choice in the room menu replaces the window and the room with a picture or
    video of yours (a 4K photo, a looping MP4 or WebM, an animated GIF), kept on this device only. Optionally: a
    second one for after dark that fades in at sunset in the window's city, dimming after dark, and the city's rain
    and snow on the glass over it.
  - **The glass:** frost grows on it on cold mornings, mist forms when it's cold and damp (drag to wipe it), and
    the lit room reflects in it at night.
  - **Adjust:** picks the view, the weather, a preview of another time of day, the volume, and under *Sounds* your
    own level for each sound (rain, wind, city, fire, crickets, birds, café murmur, vinyl crackle).
- **Scenes** (in Settings): save the window as it is (room, view and sounds) and show it again any time. Schedule
  scenes through the day, say the study by day and the bedroom after nine, and pick one to switch to while you
  focus.
- **Repeating events**: an event can repeat every day, every weekday or every week. Delete one day or the whole series.
- **Settings** (the gear): °C/°F, 12/24-hour clock, the first day of the week, reminders, layout, backups, and in the
  desktop app the live wallpaper, open at login and what's playing.

## Desktop extras

- **Live wallpaper**: the window behind your desktop icons (macOS and Linux; experimental on Windows), from the menu
  bar or tray icon or Settings. Choose the whole room or just the view.
- **What's playing**: Spotify (macOS, Windows) or Apple Music (macOS) puts a record player on the sill with the album
  art spinning, tints the lamp with the album's colour, shows a small player with controls, and turns the ambience down.
  It reads the player locally (AppleScript on macOS, the Spotify window on Windows): no account or API key.
- **Menu bar / tray icon**: open the planner, start Focus, toggle the wallpaper, quit. Closing the window keeps the app
  (and the wallpaper) running there.
- **Use with Claude**: turn on *Settings → Use with Claude* and add the line it shows to Claude Code or the Claude
  desktop app, once. Then your own Claude can read and change your plan while A Window is open ("what's on today?",
  "move my study blocks to tomorrow afternoon"), and each change shows in the app at once with Undo. It's off until you
  turn it on, only reachable from your own computer, and needs no API key; nothing goes anywhere but your Claude.
  How it works: `electron/mcp.cjs` is an MCP server Claude launches (the app's executable run as plain Node); it calls
  a token-protected bridge on 127.0.0.1 in the running app (`electron/bridge.cjs`), which hands each call to the page,
  where `src/planner/actions.ts` applies it. See `docs/claude-connector.md`.

## How it fits together

| Folder | What's in it |
| --- | --- |
| `src/window/` | The live window: astronomy, weather, environment, renderer, procedural audio, and the scenes in `packs/` |
| `src/planner/` | The planner's data model, storage, quick-add parser, replanning and the actions Claude can take (pure functions, tested) |
| `src/ui/` | React components: the scene canvas, day sheet, timeline, tray, editor, focus card, dock |
| `electron/` | The desktop shell: serves the app from a private `awindow://` origin, plus the tray, wallpaper, music and the Claude bridge |
| `src/settings.ts`, `src/music.ts`, `src/desktop.ts` | Preferences, now-playing state, and the bridge to the desktop shell |
| `scripts/artifact.mjs` | Turns the build into a page for publishing as a Claude artifact (`npm run artifact`) |

The window engine (`src/window/engine.ts`) runs one clock, weather feed and soundscape and knows nothing
about the planner. The planner knows nothing about the window. `App.tsx` is the only place they meet.

## Rooms and views

The scene has two halves. A **view** (`ViewPack`) draws the landscape inside the glass; a **room** (`RoomPack`) draws
the walls around the window and the desk or sill in front of it. The renderer handles the sky, weather and glass in
between, so any room works with any view. See `src/window/types.ts` for the interfaces, `packs/painted-room.ts` (the painted-room
system) with `packs/painted-bedroom.ts` and `packs/painted-study.ts` for rooms, `packs/painted-city.ts` and
`packs/painted-valley.ts` for views, and `packs/props.ts` for shared props. `sky-life.ts` adds meteors, planes, birds,
rainbows, fireflies and fireworks to every view. `scripts/screenshots.cjs` captures every room across times of day and
weather for before/after comparisons. Add a
pack to `VIEWS` or `ROOMS` in `engine.ts` and it appears in the pickers.

**3D rooms** (`src/window/three/`) are rendered with three.js and loaded only when chosen. Three layers keep them cheap:
the same 2D renderer draws the view outside on its own canvas behind the glass; the 3D room renders with a transparent
hole for the window, and only when its light, the pointer or a spinning record changes (an idle room doesn't redraw
at all); and a 2D layer on top draws the flicker of lamps, candles and fire. The room is lit by the real sun (with its
shadows through the window and blinds), the sky's colour and the lamp, with ambient occlusion and a little bloom.
Low sun also comes in through unseen side windows, so blind stripes slant across the wall as the day goes on. Each design
(`listening-room.ts`, `nordic-cabin.ts`, `japanese-room.ts`, `mediterranean.ts`) builds its furniture from the parts in `kit.ts` and textures painted in `textures.ts`, so there
are no image files. Illustrated rooms (`style: "illustrated"`) use toon materials from `kit.toon` for a flat,
drawn look, with a cool window light that turns moonlit blue at night. Without WebGL, a 3D room falls back to its 2D stand-in.

Weather comes from [Open-Meteo](https://open-meteo.com) (free, no key) and refreshes every 15 minutes.
Your plan is stored in this browser or app only (localStorage); there is no account.
