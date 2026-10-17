# A Window: critique and roadmap

## The objective (agreed with the owner: do everything on this list)

**Worst moments to fix**
- [x] The painted valley's mountains are a regular zigzag with identical snow caps. Now a main range with one
  dominant peak, rugged ridgelines, shadowed faces and a ragged snowline, in front of a hazy far range.
- [x] The painted rooms look flat by day: no sunlight comes into the room, and golden hour isn't golden.
  Both painted rooms now have window light and a warm golden hour (`packs/window-light.ts`).
- [x] The art styles clash. The 3D rooms look out on a flat cartoon city, and the older views don't match the
  painted rooms. Every room now has a painted view, and the drawn rooftops, fjord and city views are retired
  (saved choices move to the nearest painted view).

**Smaller issues to fix**
- [x] The bed is the bedroom's largest and weakest shape. It now has quilting that follows its humps and a
  knitted terracotta throw draped over its side, which catches the window light and the fire.
- [x] The planner darkens the whole scene evenly. Its glass is now lighter frosted glass tinted by the scene's
  current colour (sky warmed by the lamp), so the room glows through.
- [x] Very wide screens show the window small in the middle. The window now keeps laptop proportions on big
  screens and widens with the screen's aspect (about half the width on ultra-wide).
- [ ] Big screens sit dark for seconds while a painted room paints.

**Then build, in order**
1. [x] The same window light in the Cozy bedroom.
2. [ ] Painted views behind the 3D rooms, and redrawn valley mountains.
3. [ ] The glass at night: a faint reflection of the room, condensation and frost.
4. [ ] Saved scenes with a schedule, plus a separate volume for each sound.
5. [ ] Saving painted rooms between launches so big screens don't sit dark while repainting.

**And the big options (all wanted; ask before starting each, as they're L-sized)**
- [ ] New painted rooms or views: a rainy café, a train compartment, a lighthouse, a sea cliff, a Tokyo alley.
- [ ] "Make it yours": swapping props, colours and the cat.
- [ ] The 3D rooms: retire them, or restyle them to match the painted ones (retire the Japanese room first).
- [ ] Background painting: painting rooms off the main thread, so the app stays smooth while they paint.

Following `docs/prompts/next-level.md`. Screenshots come from `scripts/screenshots.cjs` (82 shots: both painted
rooms at dawn, midday, golden hour, dusk and night × clear, overcast, rain, snow and fog; room and view swaps; the
four 3D rooms; planner, Focus, open view, narrow and ultra-wide). Vancouver, 17 October.

## Phase 0: critique

**Midnight study (painted).** At night it's the best thing in the app: a clear focal point (lamp, books, cat
against the lit city), a warm–cool split, and soft edges that read as paint. By day it falls apart. From midday
to golden hour the room is one lavender-grey value, the same as the sky, so the thumbnail is a flat grey box with
a window in it. No daylight enters the room, so the desk is no lighter at noon than at dusk. Golden hour isn't
golden: the sky picks up a little peach, but the room doesn't. The 3D rooms do this well (sun patches on walls and
floors), which makes the gap obvious. The foreground plant is a strong silhouette, but it's the same at every hour.

**Cozy bedroom (painted).** Dawn and dusk are lovely: fire, fairy lights and candles against a cool valley. The
weak spots:
- The bed is a large, flat grey shape across the bottom third, with no folds, light or texture. It is the
  biggest area in the picture and the least considered.
- By day the room goes as flat as the study.
- The fireplace flames are cut-paper triangles. They read well at night, but up close they're the least
  painterly part of the room.

**Painted valley.** The mountain range is a regular sawtooth with identical snow caps, the most "programmer art"
moment in the whole matrix. It's worst in the open view, where nothing hides it. The village lights at night are
pleasant but scattered at random. The trees and meadow are good.

**Painted city.** Good at night: lit windows, layered depth and haze. By day the blocks are uniform tones with no
light-side or shadow-side, so the city reads as cardboard.

**The older drawn views (rooftops, fjord, city).** Hard vector edges and flat fills. They clash with both painted
rooms. The city view is striking at dusk, but it's a different art style.

**The 3D rooms.**
- The Listening room is the strongest: product-shot lighting and a warm lamp pool.
- The Mediterranean room at midday has beautiful shutter-slat sun on the wall.
- The cabin's log walls and cushions are convincing.
- The Japanese room is the weakest: the shoji, cabinet and lantern are all white boxes.
- All four look out on the flat vector city view, which undercuts them. A painted view behind them would fit far
  better.

**Modes and sizes.**
- Narrow works.
- The planner's glass sheet dims the whole scene evenly. It should feel like frosted glass in the room's own
  palette.
- The Focus card sits over the window rather than in the room.
- Ultra-wide (3440×1440) letterboxes the window into a small centre with large dark margins.
- At ultra-wide, the bedroom took more than 9 s to paint here (software rendering), and the screen stays dark
  until it's done.

**Three best moments.**
1. The Cozy bedroom at dusk: fire, fairy lights, candles, and the cool valley behind.
2. The Midnight study at night: lamp, cat, and the lit city.
3. The Listening room at dusk, and the Mediterranean room's slatted sun at midday.

**Three worst moments.**
1. The painted valley's sawtooth mountains, especially in the open view.
2. Both painted rooms by day: flat lavender-grey, no sunlight in the room, and a golden hour that isn't golden.
3. Style clashes: the 3D rooms looking out on vector clip-art cities, and the painted rooms with the old drawn
   views.

## Phase 1: ideas

Each idea gets an impact (1–5), an effort (S, M, L or XL), a risk, and a reason someone would love the app more
for it. ★ marks the ones I'd bet on.

### 1. Painted rooms

| Idea | Impact | Effort | Risk | Why it matters |
|---|---|---|---|---|
| ★ Window light: the sun's patch on desk and floor, skewed by the real azimuth, warm at golden hour, mullion shadows, dust in the beam, faint moonlight | 5 | S–M | Low | The room finally responds to the day outside; it's the single biggest daytime fix |
| ★ Golden hour that glows: warm the whole room and its shadows, not just the sky | 4 | S | Low | The most photographed hour should be the most beautiful one |
| ★ Repaint the bed (folds, light along its top, a knitted throw) | 4 | M | Low | The largest shape in the bedroom is currently its weakest |
| Painted fire: layered strokes, embers, light flickering on the hearth and floor | 3 | M | Low | The fire is the bedroom's heart |
| Brushwork that follows form, lost and found edges, a paper texture | 4 | L | Medium | Moves the look from "procedural" towards gouache |
| Life: the cat sleeps, stretches and moves spots during the day; curtains move with the real wind; pages turn | 4 | M | Low | Rewards leaving the app open; nobody sees the same hour twice |
| Seasonal props (scarf in winter, flowers in summer, pumpkins, a small December tree), plus the person's birthday | 4 | M | Low | It feels like someone lives there and the year passes |
| Move `painted-study.ts` onto `PaintedSpec` | 2 | M | Low | One pipeline, so every improvement reaches every room |
| New painted rooms: a rainy café corner, a train compartment, a lighthouse keeper's room | 5 | L each | Medium | New places are what people share |
| The 3D rooms: retire them, or give them a painterly pass (toon shading, painted textures) | 3 | L | High | Two art styles split the app's identity; I'd retire the Japanese room first and decide on the others after the painted rooms improve |

### 2. Scenery

| Idea | Impact | Effort | Risk | Why it matters |
|---|---|---|---|---|
| ★ Repaint the valley's mountains: varied ridgelines, real snow lines, haze between ranges | 5 | M | Low | Removes the worst moment in the matrix |
| ★ Painted views behind the 3D rooms by default | 4 | S | Low | Ends the vector-city clash at almost no cost |
| ★ The glass at night: a faint reflection of the lit room, condensation on cold mornings, frost from the corners | 5 | M | Low | The window becomes a real object, and it differs every day |
| Day light-side and shadow-side for the painted city's buildings | 3 | S | Low | Stops the city reading as cardboard by day |
| Snow cover that builds up and melts over days | 3 | M | Low | Continuity rewards people who return |
| Light pollution by city size, constellations, the Milky Way away from cities, aurora from real Kp data | 4 | M | Low | The sky above your city is your sky |
| New views: sea cliff, misty forest, mountain lake, Tokyo alley with neon, Paris rooftops, harbour | 5 | L each | Medium | Places people recognise and love |
| Retire or repaint the older drawn views | 3 | M | Low | Fewer clashes |

### 3. Customisation

| Idea | Impact | Effort | Risk | Why it matters |
|---|---|---|---|---|
| ★ Saved scenes (room, view, sound mix) with a schedule (study by day, bedroom after 9 pm) | 5 | M | Low | The app follows your day without fiddling |
| ★ A per-sound mixer (rain, fire, city, birds, café, vinyl crackle) | 4 | S–M | Low | Sound is half of the calm |
| "Make it yours": props in slots, palettes, lamp colour, cat on or off and its coat | 5 | L | Medium | It becomes *yours*; needs a versioned data model first |
| Planner glass tinted by the room's palette | 3 | S | Low | The planner belongs to the room instead of covering it |

### 4. Performance

| Idea | Impact | Effort | Risk | Why it matters |
|---|---|---|---|---|
| ★ Benchmark harness and `docs/perf.md` baseline | 3 | S | Low | Every later optimisation needs it |
| ★ Cache painted layers in IndexedDB by size, seed and version | 4 | M | Low | Instant start and resize, instead of seconds of dark |
| Progressive painting: coarse first, then refine | 4 | M | Medium | No dark screen on big monitors |
| Paint in a worker with `OffscreenCanvas` | 3 | L | Medium | Keeps the UI smooth during a repaint |
| Idle-CPU budget: only redraw what moves when nothing else does | 3 | M | Medium | Lighter wallpaper mode on laptops |

Baseline so far:
- Main bundle 369 kB (121 kB gzipped). three.js is a separate 900 kB chunk (273 kB gzipped), loaded only when a 3D
  room is chosen.
- In headless software rendering, painting the bedroom took more than 9 s at 3440×1440 and about 5 s at 1600×1000.

### 5. Everything else

| Idea | Impact | Effort | Risk | Why it matters |
|---|---|---|---|---|
| Focus as a ritual: the room dims, the lamp warms, a quiet chime and moment at the end | 4 | S–M | Low | Focus becomes the thing people open the app for |
| Onboarding that shows the window off in the first ten seconds | 4 | M | Low | First impressions |
| Export a still or a short loop of your window | 4 | M | Low | Shareable, and people share beautiful things |
| Reduced motion, contrast and keyboard passes | 3 | M | Low | Calm for everyone |
| Sound: rain on the roof versus glass, distant trains at night | 3 | M | Low | Depth without visuals |
| Weekly review in the planner | 3 | M | Low | The planner earns its keep |
| Small surprises for long use: the cat's birthday, a letter on the desk after 100 days | 3 | S each | Low | Delight |

## What I'd bet on, in order

1. Window light and golden hour in the painted rooms (S–M). Started below.
2. Painted views behind the 3D rooms, and the valley's mountains repainted (S + M).
3. The glass at night: reflection, condensation and frost (M).
4. Saved scenes with a schedule, and a sound mixer (M).
5. Cached painted layers (M), so big screens don't sit dark.

**Your call before I build anything L or bigger:**
- new painted rooms or views;
- "make it yours";
- retiring the 3D rooms or giving them a painterly pass;
- worker painting.

## Log

- **Done:**
  - screenshot matrix (`scripts/screenshots.cjs`);
  - critique;
  - this roadmap;
  - window light in the Midnight study.
- **In progress:** none.
- **Next:** your choice from the list above.
- **Learned:** in headless software rendering, a full painted-room paint takes 5–10 s at desktop sizes. The
  screenshot script waits 9 s per painted shot.
