/** Paints a painted pack's layers off the main thread, so the app stays smooth while a room or view paints.
 *  Sent a pack id, the geometry and seed, it runs the pack's build with OffscreenCanvas, records every layer and
 *  sends them back as ImageBitmaps; the page then replays the build with them (see `replayPaint`). */
import { paintedBedroom } from "./packs/painted-bedroom";
import { paintedCity } from "./packs/painted-city";
import { paintedStudy } from "./packs/painted-study";
import { paintedValley } from "./packs/painted-valley";
import { recordPaint, setPaintDpr, setPaintTones, type PaintTones } from "./packs/paint";
import type { Geom } from "./types";
import { makeRng } from "./util";

const PACKS: Record<string, { build(g: Geom, rng: ReturnType<typeof makeRng>): unknown }> = {
  [paintedBedroom.id]: paintedBedroom,
  [paintedCity.id]: paintedCity,
  [paintedStudy.id]: paintedStudy,
  [paintedValley.id]: paintedValley,
};

export type PaintRequest = { job: number; pack: string; g: Geom; seed: number; dpr: number; tones: PaintTones };
export type PaintReply = { job: number; images: (ImageBitmap | null)[]; sizes: [number, number][] } | { job: number; error: string };

self.onmessage = (e: MessageEvent<PaintRequest>) => {
  const { job, pack, g, seed, dpr, tones } = e.data;
  try {
    const p = PACKS[pack];
    if (!p) throw new Error(`No painted pack "${pack}" in the worker`);
    setPaintDpr(dpr);
    setPaintTones(tones);
    const { canvases, sizes } = recordPaint(() => p.build(g, makeRng(seed)));
    const images = canvases.map((c) => (c ? (c as unknown as OffscreenCanvas).transferToImageBitmap() : null));
    (self as unknown as Worker).postMessage({ job, images, sizes } satisfies PaintReply, images.filter((i): i is ImageBitmap => !!i));
  } catch (err) {
    (self as unknown as Worker).postMessage({ job, error: String(err) } satisfies PaintReply);
  }
};
