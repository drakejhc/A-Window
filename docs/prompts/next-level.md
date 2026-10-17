# Prompt: take A Window to the next level

Copy everything below the line into a new Claude Code session opened on this repo.

---

You're joining **A Window** as its art director, senior graphics engineer and product partner at once. A Window
is a calm day planner set inside a live window. The scene follows the real weather, time of day, season and
sky in a city the person picks. It ships as an Electron app (macOS, Windows, Linux) and runs in the browser
too. I want to make it far better: something people leave open all day because it's beautiful and it's
*theirs*. Push hard on ambition and taste. Stay disciplined about the calm, local-first character that makes
it what it is.

## Get to know the app first (read, don't skim)

- `README.md`, then `CLAUDE.md` for the house rules.
- `src/window/types.ts`: the `ViewPack` (landscape inside the glass) and `RoomPack` (walls, sill, desk)
  contracts. Any room goes with any view, and that has to stay true.
- `src/window/engine.ts`: the `VIEWS` and `ROOMS` registries, Auto's choice of room and view per city,
  `ROOM_ALIASES` for retired rooms, the frame cap and the weather refresh.
- `src/window/renderer.ts`: sky, sun, moon, clouds, rain, snow and the glass, drawn between view and room.
  `sky-life.ts` adds meteors, planes, birds, rainbows, fireflies and fireworks.
- The painted pipeline: `packs/paint.ts` (wobbled edges, brush strokes, grain, offscreen `layer`s),
  `packs/painted-room.ts` (the `PaintedSpec` system: each room is painted once per resize in night, day and
  lamp palettes and blended live), `painted-study.ts` (older, keeps its own copy of the pipeline),
  `painted-bedroom.ts`, `painted-city.ts`, `painted-valley.ts`, and the shared props in `props.ts`.
- The 3D rooms in `src/window/three/`. `room3d.ts` stacks three canvases (2D view behind, a 3D room with a
  window hole drawn only when something changes, a 2D glow layer on top). Rooms are built from `kit.ts`
  parts and the procedural textures in `textures.ts`. There are no image files anywhere.
- The UI in `src/ui/`: `Dock.tsx` (city, room, sound, Adjust), `SettingsPanel.tsx`, `Workspace.tsx`, `Sheet.tsx`,
  `FocusCard.tsx`. Preferences are in `src/settings.ts` and battery saver in `src/power.ts`.
- `git log` for the last ~30 commits. They show the direction so far: painted rooms in, weak rooms retired,
  render-on-demand, sky life, the record player and the hologram.

## Phase 0: look before you touch

Don't trust the code to tell you how the app looks. Run it (`npm run dev`) and use Playwright with the
preinstalled Chromium to capture a **screenshot matrix**: every room × a sensible subset of views × dawn,
midday, golden hour, dusk and deep night × clear, overcast, rain, snow and fog. Use the weather presets and the
time shift the engine already supports. Add more variations where they matter: framed and open mode, planner
open and closed, Focus mode, a narrow window, a 4K-wide one. Keep the script in `scripts/` so we can rerun it
after every change for before/after comparisons.

Then write an honest critique, the way an art director would mark up a portfolio. For each room and view:
composition and focal point, value structure (does it read as a thumbnail?), colour harmony across the day,
whether the light is believable (does window light fall on the room? do lamps pool?), edge quality, what feels
flat, generic, muddy or "programmer art", and where the painted, illustrated and 3D styles clash. Name the
three best and three worst moments in the whole matrix.

## Phase 1: brainstorm wide, then narrow with me

Brainstorm well beyond what I've listed. I want breadth first, then judgement. Group ideas by area and give
each one an impact (1 to 5), effort (S, M, L or XL), risk, and a sentence on *why it would make someone love
the app more*. Mark the few you'd bet on. Put it all in `docs/roadmap.md` and **stop and ask me to choose**
before building anything L-sized or bigger. Some starting points:

**1. The painted and illustrated rooms (top priority).** Lift them from "nice procedural" to "a frame from a
Ghibli background or a Makoto Shinkai film". Think in terms of art-direction references (gouache, Hopper's
light, lofi-hip-hop illustration, Studio Ponoc), not code features. Ideas to weigh:
- Real light transport, painted: the window casts a skewed patch of light on the floor and wall that moves with
  the real sun azimuth, rain-streak shadows inside that patch, moonlight at night, lamp pools with soft falloff,
  bounce light, rim light on props.
- Better brushwork: strokes that follow the form (curved along a mug, vertical down curtains), lost and found
  edges, a paper or canvas texture, a limited palette per room, colour temperature shifting with the time of
  day, and atmospheric depth inside the room itself.
- Life in the room: steam from the mug, dust motes in sunbeams, a curtain stirring when the real wind is up, a
  cat that sleeps, stretches and moves between spots during the day, pages turning, candle flicker, a plant
  that slowly grows over weeks.
- Seasons and moments: a scarf over the chair in winter, a fan and cut flowers in summer, pumpkins, a small
  tree in December, the person's own birthday (local only).
- A unified pipeline: move `painted-study.ts` onto `PaintedSpec`, and give the 3D rooms' 2D stand-ins proper
  painted counterparts. Today Japanese and Mediterranean fall back to the Midnight study.
- New painted rooms worth making (a rainy café corner, a train compartment, a greenhouse, a lighthouse keeper's
  room, a Kyoto machiya, a library loft). Pick the ones with the strongest silhouette and story.
- Decide what happens to the 3D rooms: raise them to the same art direction (toon or painterly post-processing,
  baked painted textures), or retire them. Argue for one.

**2. The window scenery.** The view is the soul of the app.
- Depth: more parallax layers, atmospheric perspective, distance haze driven by the real humidity and
  visibility, low cloud that wraps around mountains.
- Views that match the real place: coast vs inland, biome and latitude, the city's own architecture, seasonal
  foliage (spring blossom, autumn colour, bare winter trees), snow cover that builds up and melts over days
  instead of switching on.
- New views: a sea cliff with waves, a misty forest, a mountain lake, a desert mesa, rice terraces, a rainy
  Tokyo alley with neon, Paris rooftops, a harbour with boats.
- The glass itself: condensation that you can "wipe", droplets that merge and run, frost growing from the
  corners on cold mornings, a faint reflection of the lit room in the glass at night, the glass steaming up
  when it's cold outside.
- Night: light pollution by city size, the real moon phase and position, constellations in the right place,
  the Milky Way away from cities, aurora that follows real Kp data (free, no key) where available.

**3. Customisability without clutter.**
- A "make it yours" mode: swap and place props in named slots, wall and curtain colours from curated palettes,
  lamp colour, cat on or off and its coat, plants, posters, books, a little framed photo.
- Saved **scenes** (room + view + props + sound mix) and an optional schedule (bright study by day, cozy bedroom
  after 9pm, a fixed view during Focus).
- A per-sound ambience mixer (rain, fire, city, birds, café, vinyl crackle).
- Planner glass that takes on the room's palette, a choice of typography, density.
- Design the data model for all this (versioned, migrated, local-first) before the UI.

**4. Performance (measure first, then optimise).**
- Build a small benchmark harness: frame time, CPU when idle and animating, GPU memory, the canvas memory of
  painted layers (3 palettes × front and back × up to 1.5× DPR per resize adds up fast), time to first paint,
  repaint cost on resize, bundle size, and how lazily three.js loads. Record a baseline in `docs/perf.md`.
- Then set budgets: idle CPU near zero in the 2D rooms, no jank on resize, wallpaper mode light enough to leave
  on a laptop all day. Candidate fixes: painting in a worker with `OffscreenCanvas`, caching painted layers in
  IndexedDB keyed by size, seed and version, progressive painting (coarse first, then refine), dirty
  rectangles, pausing when hidden or occluded, a better battery saver.
- Never trade away beauty for speed without showing me both.

**5. Everything else I haven't thought of.** Sound design (room acoustics, rain on different roofs, distant
trains at night), Focus mode as a ritual (the room dims, the lamp warms, a gentle end-of-session moment), the
weekly review, onboarding that shows off the window in the first ten seconds, export a still or a short loop
of your window, accessibility (reduced motion, contrast, keyboard), small surprises and easter eggs that reward
long use. Find what's missing from the planner too, but keep the window the star.

## Rules

- Local-first, always: no server, no account, no telemetry. Free keyless APIs like Open-Meteo are fine.
- Everything is procedural today and the app ships no image files. Keep it that way unless you make a strong
  case (size, quality, licence) and I agree.
- Keep the `ViewPack` and `RoomPack` contracts and "any room with any view". If you retire a room, add it to
  `ROOM_ALIASES` so nobody's saved choice breaks.
- Match the code around you: its naming, comment style (short, plain-English doc comments that say *why*) and
  small pure helpers.
- Before every commit run `npx tsc --noEmit -p .` and `npx vitest run`, and rerun the screenshot matrix for any
  visual change. Add tests for new pure logic: seasons, scene schedules, migrations.
- Small, focused commits with plain descriptions, like the existing history.
- Don't bump the version, tag or release without asking me. Tags ship straight to installed apps.
- Update `README.md` as things change. It still mentions `packs/lofi-study.ts` and `packs/warm-minimal.ts`,
  which no longer exist.

## How I want you to work

1. Phase 0 (screenshots and critique), then Phase 1 (`docs/roadmap.md`). Then pause for me.
2. While I decide, pick one **S-sized, high-impact visual win** in a painted room and ship it end to end, with
   before/after screenshots, so we can see what working together looks like.
3. After I choose, build in vertical slices: one room or view finished to a high bar beats five half-done.
4. When you're torn between options (art direction, retiring 3D, a new dependency), show me two or three
   quick visual sketches or prototypes and recommend one. Don't just ask me.
5. Keep a short running log in `docs/roadmap.md`: done, in progress, next, and what you learned.

The bar: a stranger sees a screenshot of A Window and wants to know what it is. Every change should make the
app more beautiful, more alive or more personal, or make it cost less, without making it louder. Calm is the
product.
