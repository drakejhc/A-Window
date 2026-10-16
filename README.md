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
- **Quick add** (`⌘K`, `/` or `N`) understands phrases like `Gym tomorrow 7am 45m #health`. With a time it goes
  on the timeline; with a day but no time it takes the next free slot; otherwise it goes to a list.
- **Drag** blocks to move them (across days in Week view), or drag tasks from the tray. The clock button on a
  tray task finds the next free slot.
- **Click** a block or task to edit it: category, time, length, checklist, notes, or delete (with undo).
- **Replan** (`R`) moves tasks that fell behind into the free time left today.
- **Focus** (`F`) works on the block happening now, or the next one, or a free session when the day is clear.
  Focused minutes are recorded on the block. `Space` pauses and `Esc` exits.
- **The window**: search for any city and choose a room in the bottom bar. The 3D rooms are the Listening room, a Nordic
  cabin, a Japanese room and a Mediterranean room, plus two illustrated ones (a Lofi desk and a Cozy bedroom) that
  look drawn but keep real perspective and light; *Auto* picks one to suit the city (the cabin in the far north and
  south, the Japanese room in East Asia, the Mediterranean room where it's warm, the Listening room elsewhere). The
  drawn rooms (Lofi study, Warm minimal, Attic, Log cabin) are lighter still,
  and turn sound on. *Adjust* picks the view outside (rooftops, a fjord or a city skyline), the weather, a preview of another time of
  day, and the volume. Any room goes with any view.
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

## How it fits together

| Folder | What's in it |
| --- | --- |
| `src/window/` | The live window: astronomy, weather, environment, renderer, procedural audio, and the scenes in `packs/` |
| `src/planner/` | The planner's data model, storage, quick-add parser and replanning (pure functions, tested) |
| `src/ui/` | React components: the scene canvas, day sheet, timeline, tray, editor, focus card, dock |
| `electron/` | The desktop shell: serves the app from a private `awindow://` origin, plus the tray, wallpaper and music |
| `src/settings.ts`, `src/music.ts`, `src/desktop.ts` | Preferences, now-playing state, and the bridge to the desktop shell |
| `scripts/artifact.mjs` | Turns the build into a page for publishing as a Claude artifact (`npm run artifact`) |

The window engine (`src/window/engine.ts`) runs one clock, weather feed and soundscape and knows nothing
about the planner. The planner knows nothing about the window. `App.tsx` is the only place they meet.

## Rooms and views

The scene has two halves. A **view** (`ViewPack`) draws the landscape inside the glass; a **room** (`RoomPack`) draws
the walls around the window and the desk or sill in front of it. The renderer handles the sky, weather and glass in
between, so any room works with any view. See `src/window/types.ts` for the interfaces, `packs/lofi-study.ts` and
`packs/warm-minimal.ts` for rooms, and `packs/props.ts` for the shared cat, mug, plant, books and fairy lights. Add a
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
