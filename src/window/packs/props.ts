/** Small things that make a room feel lived in, shared between rooms. Each draws at a scale `s` (1 ≈ a 900px
 *  window) and takes a `lit` function that lights a colour for the room's current daylight and lamplight. */
import type { FrameEnv } from "../types";
import { mapRGB, mixRGB, rgba, scaleRGB, type RGB, type Rng } from "../util";

export type Lit = (c: RGB) => RGB;

/** How bright the room is from daylight (0..1). */
export const dayLevel = (env: FrameEnv) => Math.min(1, (env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);

/** Lights a colour by daylight plus the warm lamp; `warmth` scales how much the lamp reaches it. */
export function lighter(env: FrameEnv, warmth = 1): Lit {
  const day = dayLevel(env), k = 0.14 + 0.66 * day;
  const lamp = scaleRGB(env.lampColor, 0.3 * env.lamp * warmth);
  return (c) => mapRGB(c, (v, i) => v * k + lamp[i as 0] * (v / 255 + 0.25));
}

/** Evening glow for fairy lights and candles: faint by day, full once the lamp is on. */
export const evening = (env: FrameEnv) => Math.max(0.22, env.lamp, env.night * 0.8);

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: RGB, a: number) {
  if (a < 0.01) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function mug(ctx: CanvasRenderingContext2D, env: FrameEnv, x: number, top: number, s: number, lit: Lit, body: RGB = [212, 204, 192]) {
  ctx.strokeStyle = rgba(lit(scaleRGB(body, 0.95)));
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.arc(x + 17 * s, top - 18 * s, 8 * s, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = rgba(lit(body));
  ctx.beginPath();
  ctx.roundRect(x - 16 * s, top - 34 * s, 32 * s, 34 * s, [2 * s, 2 * s, 6 * s, 6 * s]);
  ctx.fill();
  ctx.fillStyle = rgba(lit([70, 44, 30]));
  ctx.fillRect(x - 14 * s, top - 33 * s, 28 * s, 3 * s);
  // Steam on cold days and in the evening.
  if (env.temp >= 16 && env.lamp < 0.5) return;
  const t = env.t;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.25 + i / 3) % 1;
    ctx.strokeStyle = rgba([255, 255, 255], 0.14 * Math.sin(ph * Math.PI) * (0.4 + 0.6 * Math.max(dayLevel(env), env.lamp)));
    const sx = x - 6 * s + i * 6 * s, sy = top - 38 * s - ph * 30 * s;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 8 * s * Math.sin(t + i), sy - 12 * s, sx - 8 * s * Math.sin(t * 1.3 + i), sy - 22 * s, sx + 3 * s, sy - 34 * s);
    ctx.stroke();
  }
}

/** A cat curled up asleep, breathing slowly. Faces left; `y` is the surface it lies on. */
export function cat(ctx: CanvasRenderingContext2D, env: FrameEnv, x: number, y: number, s: number, lit: Lit, fur: RGB = [214, 130, 66]) {
  const breathe = 1 + 0.04 * Math.sin(env.t * 1.5);
  const body = lit(fur), dark = lit(scaleRGB(fur, 0.68)), light = lit(mixRGB(fur, [250, 236, 220], 0.55));
  // Shadow on the surface.
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y - 1 * s, 58 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tail, wrapped around the front.
  ctx.strokeStyle = rgba(body);
  ctx.lineWidth = 11 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 46 * s, y - 10 * s);
  ctx.quadraticCurveTo(x + 30 * s, y - 2 * s, x - 10 * s, y - 5 * s);
  ctx.quadraticCurveTo(x - 34 * s, y - 7 * s, x - 42 * s, y - 14 * s);
  ctx.stroke();
  // Body.
  const ry = 25 * s * breathe;
  ctx.fillStyle = rgba(body);
  ctx.beginPath();
  ctx.ellipse(x + 6 * s, y - ry - 2 * s, 48 * s, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stripes along the back.
  ctx.strokeStyle = rgba(dark);
  ctx.lineWidth = 4 * s;
  for (const k of [-0.3, 0.05, 0.4]) {
    ctx.beginPath();
    ctx.ellipse(x + 6 * s + k * 60 * s, y - ry - 2 * s, 9 * s, ry * 0.95, 0, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
  }
  // Head, tucked low on the left, with ears and a sleeping eye.
  const hx = x - 34 * s, hy = y - 19 * s;
  ctx.fillStyle = rgba(body);
  ctx.beginPath();
  ctx.moveTo(hx - 15 * s, hy - 10 * s);
  ctx.lineTo(hx - 12 * s, hy - 29 * s);
  ctx.lineTo(hx - 1 * s, hy - 16 * s);
  ctx.lineTo(hx + 8 * s, hy - 28 * s);
  ctx.lineTo(hx + 14 * s, hy - 9 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx, hy - 4 * s, 17 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(light);
  ctx.beginPath();
  ctx.ellipse(hx - 4 * s, hy + 4 * s, 10 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(lit([60, 36, 26]));
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  ctx.arc(hx - 7 * s, hy - 7 * s, 4 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

/** A potted plant with long leaves, swaying just slightly. */
export function plant(ctx: CanvasRenderingContext2D, env: FrameEnv, x: number, top: number, s: number, lit: Lit, leaves: { a: number; len: number; w: number; p: number }[], pot: RGB = [138, 86, 64]) {
  const bx = x, by = top - 48 * s;
  for (const lf of leaves) {
    const a = lf.a + Math.sin(env.t * 0.4 + lf.p) * 0.02;
    const tx = bx + Math.sin(a) * lf.len * s, ty = by - Math.cos(a) * lf.len * s;
    const nx = Math.cos(a) * lf.w * s, ny = Math.sin(a) * lf.w * s;
    ctx.fillStyle = rgba(lit(mixRGB([52, 88, 58], [86, 122, 70], (lf.p % 1 + 1) % 1)));
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + tx) / 2 + nx, (by + ty) / 2 + ny, tx, ty);
    ctx.quadraticCurveTo((bx + tx) / 2 - nx, (by + ty) / 2 - ny, bx, by);
    ctx.fill();
  }
  ctx.fillStyle = rgba(lit(pot));
  ctx.beginPath();
  ctx.moveTo(x - 28 * s, top - 50 * s);
  ctx.lineTo(x + 28 * s, top - 50 * s);
  ctx.lineTo(x + 21 * s, top);
  ctx.lineTo(x - 21 * s, top);
  ctx.fill();
  ctx.fillStyle = rgba(lit(scaleRGB(pot, 0.85)));
  ctx.fillRect(x - 30 * s, top - 54 * s, 60 * s, 8 * s);
}

export const leavesFor = (rng: Rng, n = 9) =>
  Array.from({ length: n }, (_, i) => ({ a: -1.2 + (i / (n - 1)) * 2.4 + (rng() - 0.5) * 0.2, len: 50 + rng() * 45, w: 8 + rng() * 6, p: rng() * 6 }));

/** Fairy lights hung in swags: a thin wire and warm bulbs that twinkle out of step. */
export type Bulb = { x: number; y: number; ph: number; hue: number };
export function stringLightPoints(rng: Rng, x0: number, x1: number, y: number, sag: number, swags = 2, perSwag = 11): Bulb[] {
  const out: Bulb[] = [];
  for (let sw = 0; sw < swags; sw++) {
    for (let i = 0; i <= perSwag; i++) {
      if (sw > 0 && i === 0) continue;
      const u = i / perSwag, x = x0 + ((sw + u) / swags) * (x1 - x0);
      out.push({ x, y: y + sag * 4 * u * (1 - u), ph: rng() * 6.28, hue: rng() });
    }
  }
  return out;
}
export function stringLights(ctx: CanvasRenderingContext2D, env: FrameEnv, bulbs: Bulb[], s: number) {
  const on = evening(env);
  ctx.strokeStyle = "rgba(30,24,20,0.85)";
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  bulbs.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x, b.y)));
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bulbs) {
    const tw = 0.82 + 0.18 * Math.sin(env.t * (0.8 + b.hue) + b.ph);
    const col = mixRGB([255, 196, 120], [255, 228, 170], b.hue);
    glow(ctx, b.x, b.y + 5 * s, 22 * s, col, 0.3 * on * tw);
  }
  ctx.restore();
  for (const b of bulbs) {
    const tw = 0.82 + 0.18 * Math.sin(env.t * (0.8 + b.hue) + b.ph);
    ctx.fillStyle = rgba(mixRGB([120, 100, 80], [255, 222, 160], on * tw));
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 5 * s, 2.6 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Book spines for a shelf: widths, heights, colours and the odd lean. */
export type Book = { x: number; w: number; h: number; c: RGB; lean: number };
const SPINES: RGB[] = [[150, 58, 50], [196, 150, 70], [58, 96, 104], [222, 210, 186], [46, 58, 92], [104, 112, 66], [128, 70, 92], [176, 110, 70]];
export function shelfBooks(rng: Rng, x0: number, x1: number, s: number): Book[] {
  const out: Book[] = [];
  let x = x0 + 6 * s;
  while (x < x1 - 14 * s) {
    if (rng() < 0.08) {
      x += 30 * s;
      continue;
    }
    const w = (8 + rng() * 9) * s, lean = rng() < 0.08 ? -0.18 : 0;
    out.push({ x, w, h: (46 + rng() * 26) * s, c: SPINES[(rng() * SPINES.length) | 0]!, lean });
    x += w + (lean ? 8 * s : 1.2 * s);
  }
  return out;
}
export function books(ctx: CanvasRenderingContext2D, list: Book[], base: number, s: number, lit: Lit) {
  for (const b of list) {
    ctx.save();
    ctx.translate(b.x, base);
    ctx.rotate(b.lean);
    ctx.fillStyle = rgba(lit(b.c));
    ctx.fillRect(0, -b.h, b.w, b.h);
    ctx.fillStyle = rgba(lit(scaleRGB(b.c, 1.25)), 0.5);
    ctx.fillRect(1 * s, -b.h + 8 * s, b.w - 2 * s, 2 * s);
    ctx.fillRect(1 * s, -14 * s, b.w - 2 * s, 2 * s);
    ctx.restore();
  }
}
