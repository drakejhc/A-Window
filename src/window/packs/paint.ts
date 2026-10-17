/** Painterly drawing for the hand-painted scenes: shapes with wobbly, hand-drawn edges, filled with layers of
 *  short translucent brush strokes, and a grain to lay over the whole picture. Painting is slow, so scenes paint
 *  once into cached layers (see `layer`) and only blend those layers each frame. */
import { retint } from "../../personal";
import { mixRGB, rgba, scaleRGB, type RGB, type Rng } from "../util";

export type Pt = [number, number];

/** The wall and blanket colours chosen in "Make it yours", painted into the rooms. */
export type PaintTones = { walls: RGB | null; blanket: RGB | null };
let tones: PaintTones = { walls: null, blanket: null };
export function setPaintTones(t: PaintTones) {
  tones = t;
}
export const paintTones = () => tones;
/** A short key for the current tones, so a change repaints the room (and caches it separately). */
export const tonesKey = () => `${tones.walls?.join(",") ?? "-"}/${tones.blanket?.join(",") ?? "-"}`;

/** A palette with the chosen colours applied: walls keep their light and shade and change colour; the blanket and
 *  throw change colour more fully. */
export function tonePalette<P extends Record<string, RGB>>(pal: P): P {
  if (!tones.walls && !tones.blanket) return pal;
  const out: Record<string, RGB> = { ...pal };
  for (const k of Object.keys(out)) {
    if (tones.walls && /wall/i.test(k)) out[k] = retint(out[k]!, tones.walls);
    if (tones.blanket && /throw|blanket/i.test(k)) out[k] = retint(out[k]!, tones.blanket, 0.85);
  }
  return out as P;
}

let draft = false;
/** Paints a quick draft: lower resolution and far fewer, broader strokes. A scene shows its draft at once and
 *  repaints in full a moment later, instead of sitting dark for the seconds a full painting takes. */
export function paintDraft<T>(fn: () => T): T {
  draft = true;
  try {
    return fn();
  } finally {
    draft = false;
  }
}

/** A painted image as replay hands it back: anything drawImage takes, with its size. */
export type Painted = CanvasImageSource & { width: number; height: number };

/** A context that does nothing: what replayed layers draw with, since their painting is already done. */
const nothing: unknown = new Proxy(function () {}, { get: () => nothing, apply: () => nothing, set: () => true });
export const NOOP = nothing as CanvasRenderingContext2D;

let recording: { canvases: HTMLCanvasElement[]; sizes: [number, number][] } | null = null;
let replaying: { images: (Painted | null)[]; sizes: [number, number][]; i: number } | null = null;
let dpr: number | null = null;

/** A canvas in the page, or off-screen in a worker. */
const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  if (typeof document === "undefined") return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** A canvas that's drawn on live (scratch for window light, masks), never recorded or replayed. */
export function freshCanvas(W: number, H: number) {
  return makeCanvas(Math.max(1, Math.round(W)), Math.max(1, Math.round(H)));
}

/** The pixel ratio to paint for, where `window` isn't available (a worker). */
export function setPaintDpr(value: number) {
  dpr = value;
}

/** Runs a build and keeps every layer it paints, in order, with the sizes it asked for, so the same build can be
 *  replayed later (from the cache, or from a worker) without painting. Freed scratch layers come back as null. */
export function recordPaint<T>(fn: () => T) {
  recording = { canvases: [], sizes: [] };
  try {
    const result = fn();
    const { canvases, sizes } = recording;
    return { result, sizes, canvases: canvases.map((c) => (c.width && c.height ? c : null)) };
  } finally {
    recording = null;
  }
}

/** Runs a build again with its painted layers handed back instead of painted. Throws if the build asks for
 *  different layers than were recorded (a different size, or changed code), so the caller can paint for real. */
export function replayPaint<T>(images: (Painted | null)[], sizes: [number, number][], fn: () => T): T {
  replaying = { images, sizes, i: 0 };
  try {
    const result = fn();
    if (replaying.i !== images.length) throw new Error("Replay used a different number of layers");
    return result;
  } finally {
    replaying = null;
  }
}

/** An offscreen canvas at up to `maxK`× resolution, drawn on in CSS pixels. Painted layers are large, so keep
 *  only the ones you need and `free` scratch layers as soon as they're used. */
export function layer(W: number, H: number, maxK = 1.5) {
  const k = Math.min(draft ? 0.6 : maxK, dpr ?? (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  const w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
  if (replaying) {
    const r = replaying, i = r.i++, img = r.images[i] ?? null, size = r.sizes[i];
    if (!size || size[0] !== w || size[1] !== h) throw new Error("Replay asked for a different layer");
    // A layer that was freed while painting is only a stand-in; the others arrive already painted.
    const c = makeCanvas(img ? w : 1, img ? h : 1);
    if (img) c.getContext("2d")!.drawImage(img, 0, 0);
    (c as { getContext: unknown }).getContext = () => NOOP;
    return { c, x: NOOP };
  }
  const c = makeCanvas(w, h);
  const x = c.getContext("2d")!;
  x.scale(k, k);
  if (recording) {
    recording.canvases.push(c);
    recording.sizes.push([w, h]);
  }
  return { c, x };
}

export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Breaks a polygon's edges into short steps and nudges each point, for an imperfect, hand-drawn edge. */
export function wobble(pts: Pt[], rng: Rng, amp: number, step = 22): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!;
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) {
      const u = k / n;
      out.push([x0 + (x1 - x0) * u + (rng() - 0.5) * amp, y0 + (y1 - y0) * u + (rng() - 0.5) * amp]);
    }
  }
  return out;
}

export function trace(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export type BrushOpts = {
  s: number;
  /** Stroke direction in radians (0 runs along x). */
  angle?: number;
  /** Pixels² of shape per stroke: lower is denser. */
  density?: number;
  /** How far stroke colours stray from the base (0..1). */
  spread?: number;
  /** Stroke length range, in pack units. */
  len?: [number, number];
  /** Darker outline strength (0 for none). */
  edge?: number;
};

/** Fills a shape with its colour, then brushes over it with short strokes in nearby colours. */
export function brush(ctx: CanvasRenderingContext2D, pts: Pt[], col: RGB, rng: Rng, o: BrushOpts) {
  if (ctx === NOOP) return;
  const s = o.s;
  trace(ctx, pts);
  ctx.fillStyle = rgba(col);
  ctx.fill();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  ctx.save();
  trace(ctx, pts);
  ctx.clip();
  ctx.lineCap = "round";
  const [l0, l1] = o.len ?? [10, 34];
  const n = Math.min(5000, ((x1 - x0) * (y1 - y0)) / (o.density ?? 240)) * (draft ? 0.15 : 1), wide = draft ? 2.2 : 1;
  for (let i = 0; i < n; i++) {
    const x = x0 + rng() * (x1 - x0), y = y0 + rng() * (y1 - y0);
    const a = (o.angle ?? 0) + (rng() - 0.5) * 0.6, L = (l0 + rng() * (l1 - l0)) * s;
    const k = 1 + (rng() - 0.5) * 2 * (o.spread ?? 0.14);
    const c = mixRGB(scaleRGB(col, k), rng() < 0.5 ? [255, 190, 150] : [110, 130, 220], 0.06);
    ctx.strokeStyle = rgba(c, 0.1 + rng() * 0.16);
    ctx.lineWidth = (2 + rng() * 7) * s * wide;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.cos(a) * L) / 2 + (rng() - 0.5) * 5 * s, y + (Math.sin(a) * L) / 2 + (rng() - 0.5) * 5 * s, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  ctx.restore();
  if (o.edge) {
    trace(ctx, pts);
    ctx.strokeStyle = rgba(scaleRGB(col, 0.55), o.edge);
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();
  }
}

/** A soft pool of light painted only onto what's already there. */
export function lightOnto(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: RGB, a: number) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.45, rgba(col, a * 0.35));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Keeps a layer only within a soft circle (for light that fades with distance from the lamp). */
export function fadeOut(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, W: number, H: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.35, "rgba(0,0,0,0.75)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Releases a scratch canvas's memory now rather than whenever it's collected. */
export function free(c: HTMLCanvasElement) {
  c.width = c.height = 0;
}

let grainCanvas: HTMLCanvasElement | null = null;
/** A small tile of film grain, to lay over the picture with `overlay`. */
export function grain() {
  if (grainCanvas) return grainCanvas;
  const S = 192, c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!, img = x.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return (grainCanvas = c);
}
