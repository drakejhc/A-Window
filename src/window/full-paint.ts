/** Builds a painted pack in full without holding up the page. In order of preference: replay its layers from the
 *  cache (instant), paint them in a worker and replay them here (the page stays smooth), or paint here as before.
 *  Fresh paintings are saved for next time. */
import { paintTones, recordPaint, replayPaint, tonesKey, type Painted } from "./packs/paint";
import { loadPainting, savePainting } from "./paint-cache";
import type { PaintReply, PaintRequest } from "./paint-worker";
import type { Geom } from "./types";
import { makeRng, type Rng } from "./util";

type Pack = { id: string; build(g: Geom, rng: Rng): unknown };
type Layers = { images: (Painted | null)[]; sizes: [number, number][] };

/** Packs the worker knows how to paint. */
const IN_WORKER = new Set(["painted", "painted-bedroom", "painted-city", "painted-valley"]);
/** The cache is keyed by the build, so new code never replays old paintings; in development it's off. */
const BUILD = import.meta.env.DEV ? null : new URL(import.meta.url).pathname;

let worker: Worker | null | undefined;
let jobs = 0;
const waiting = new Map<number, (r: PaintReply) => void>();

function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./paint-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<PaintReply>) => {
      waiting.get(e.data.job)?.(e.data);
      waiting.delete(e.data.job);
    };
    worker.onerror = () => {
      // Without a worker (an odd sandbox, an old engine), everything paints on the page as before.
      for (const done of waiting.values()) done({ job: -1, error: "The paint worker stopped" });
      waiting.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function paintInWorker(pack: string, g: Geom, seed: number): Promise<Layers | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  return new Promise((resolve) => {
    const job = ++jobs;
    waiting.set(job, (r) => resolve("error" in r ? null : { images: r.images, sizes: r.sizes }));
    w.postMessage({ job, pack, g, seed, dpr: window.devicePixelRatio || 1, tones: paintTones() } satisfies PaintRequest);
  });
}

export const cacheKey = (pack: string, g: Geom) => (BUILD ? `${BUILD}|${pack}|${window.devicePixelRatio || 1}|${tonesKey()}|${JSON.stringify(g)}` : null);

export async function buildInFull<D>(pack: Pack, g: Geom, seed: number): Promise<D> {
  const key = cacheKey(pack.id, g);
  let layers: Layers | null = key ? await loadPainting(key) : null;
  let fresh = false;
  if (!layers && IN_WORKER.has(pack.id)) {
    layers = await paintInWorker(pack.id, g, seed);
    fresh = !!layers;
  }
  if (layers) {
    try {
      const data = replayPaint(layers.images, layers.sizes, () => pack.build(g, makeRng(seed))) as D;
      if (fresh && key) void savePainting(key, layers.images, layers.sizes);
      return data;
    } catch {
      /* the layers didn't match this build: paint it here instead */
    }
  }
  await new Promise((r) => window.setTimeout(r, 0));
  const { result, canvases, sizes } = recordPaint(() => pack.build(g, makeRng(seed)));
  if (key) void savePainting(key, canvases, sizes);
  return result as D;
}
