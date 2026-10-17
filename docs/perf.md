# Performance

Measured in headless Chromium on a cloud machine with no GPU, so canvas drawing is software-rendered. Absolute
times are slower than on a laptop with a GPU. Use them to compare changes, not to promise anything.

## How painting works now

A painted room or view is built in three steps, so the screen is never dark for long and the page stays smooth.

1. **Draft.** A quick draft paints on the page straight away: lower resolution and about 15% of the strokes
   (`paintDraft` in `packs/paint.ts`).
2. **Full painting.** The full painting comes from one of three places, in this order:
   - **The cache:** the layers of this scene at this size from an earlier launch, kept in IndexedDB
     (`paint-cache.ts`). The cache is keyed by the app build, keeps the last 6 paintings, and is off in
     development.
   - **The worker:** the layers painted in a Web Worker with OffscreenCanvas (`paint-worker.ts`), and saved to the
     cache.
   - **The page:** painted on the main thread as before, if there's no worker.
3. **Replay.** The pack's build runs again with the finished layers handed back instead of painted
   (`recordPaint` and `replayPaint`). It checks each layer's size, and if anything doesn't match, it paints for
   real instead.

## Baseline

**Bundle** (`npm run build`):

| File | Size | Gzipped | Loaded when |
|---|---|---|---|
| `index.js` | 371 kB | 122 kB | Always |
| `three.js` | 900 kB | 273 kB | Only when a 3D room is chosen |
| `paint-worker.js` | 45 kB | | When a painted scene paints |
| `index.css` | 33 kB | 7 kB | Always |

**Time to the first picture**, building view and room at 1600×1000:

| Scene | Before drafts | With drafts |
|---|---|---|
| Midnight study | 1.5 s | 0.35 s |
| Cozy bedroom | 4.3 s | 0.74 s |

**Main thread while the bedroom loads:**
- **Before:** one block of 2–4 s while the full painting ran on the page.
- **Now:** the largest block is about 0.85 s, at start-up (loading, plus the draft). The full painting happens in
  the worker or comes from the cache.

**Cache.** The second launch at the same size starts no worker. Both the room and the view replay from the
cache, and the result matches a fresh paint (mean pixel difference about 2 of 255, from animation and WebP).

**Frame cost.** Here, each animation frame of a painted room at 1600×1000 takes 140–200 ms, all of it software
canvas drawing. That's the next thing to measure on real hardware. Battery saver caps the frame rate at 20 fps.

## Next

- Measure the frame time and idle CPU on a real laptop, both plugged in and on battery.
- Redraw only what moves (dirty rectangles) when nothing else changes.
- Set a budget for the GPU memory used by painted layers (3 palettes × front and back, at up to 1.5× pixel
  ratio).
