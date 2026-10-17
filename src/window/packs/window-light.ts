/** Sunlight (or moonlight) through a painted room's window: patches the shape of the panes on the surfaces it
 *  reaches, skewed by where the sun really is, longer when it's low, with the window bars' shadows between them
 *  and dust turning in the beam. Warm white by day, amber at golden hour (which also warms the whole room), a
 *  faint cool patch under a bright moon. Drawn at half size into a scratch canvas, then laid over the room. */
import type { FrameEnv, Geom } from "../types";
import { clamp, mixRGB, rgba, smooth, type RGB } from "../util";
import { freshCanvas, trace, type Pt } from "./paint";

/** A level surface the light can land on, `drop` window-heights below the sill, from `z0` to `z1` window-heights
 *  out from the wall. `at(x, v)` is where a point appears: `x` is the point it lines up with along the sill (in
 *  screen pixels), `v` how far across the surface it is (0 at z0, 1 at z1). */
export type LightPlane = { drop: number; z0: number; z1: number; at(x: number, v: number): Pt };

/** The window's glass: column spans in screen x, and row spans as fractions of the window height above the sill. */
export type Glazing = { cols: [number, number][]; rows: [number, number][] };

export type LightCanvases = { scratch: HTMLCanvasElement; mask: HTMLCanvasElement | null };

/** Shapes nearer than the lit surfaces (a foreground plant), so the light can be kept off them. */
export type Occluder = { kind: "fill"; pts: Pt[] } | { kind: "line"; pts: Pt[]; width: number };

/** The half-size canvases window light draws with, and a mask of anything that must stay unlit. */
export function lightCanvases(g: Geom, occluders: Occluder[] = []): LightCanvases {
  let mask: HTMLCanvasElement | null = null;
  if (occluders.length) {
    mask = freshCanvas(g.W / 2, g.H / 2);
    const x = mask.getContext("2d")!;
    x.scale(0.5, 0.5);
    x.fillStyle = x.strokeStyle = "#000";
    x.lineCap = x.lineJoin = "round";
    for (const o of occluders) {
      x.beginPath();
      o.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      if (o.kind === "fill") x.fill();
      else {
        x.lineWidth = o.width * 1.5;
        x.stroke();
      }
    }
  }
  return { scratch: freshCanvas(g.W / 2, g.H / 2), mask };
}

const motes = Array.from({ length: 26 }, (_, i) => ({ u: (i * 0.618) % 1, v: (i * 0.371) % 1, h: (i * 0.437) % 1, ph: i * 1.7 }));

export function windowLight(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, glazing: Glazing, planes: LightPlane[], c: LightCanvases) {
  const facing = env.city.lat >= 0 ? 180 : 0;
  const clear = Math.pow(clamp(1 - env.cloud * 1.1), 1.5) * (1 - env.fog) * (1 - env.rain * 0.8);
  const moonFull = 1 - Math.abs(env.moonPhase - 0.5) * 2;
  const sources = [
    { alt: env.sunAlt, az: env.sunAz, k: smooth(0.5, 6, env.sunAlt) * clear, color: mixRGB([255, 232, 196], [255, 160, 80], env.golden) },
    { alt: env.moonAlt, az: env.moonAz, k: smooth(2, 10, env.moonAlt) * moonFull * env.night * clear * 0.45, color: [170, 190, 255] as RGB },
  ];
  const lx = c.scratch.getContext("2d")!;
  let lit = false;
  for (const src of sources) {
    const rel = ((src.az - facing + 540) % 360) - 180;
    const k = src.k * (1 - smooth(70, 85, Math.abs(rel)));
    if (k < 0.02) continue;
    const tanAlt = Math.tan((Math.max(src.alt, 1) * Math.PI) / 180);
    // Sideways drift per window-height of depth, in pixels: the light slides away from the sun's side.
    const drift = -Math.tan((rel * Math.PI) / 180) * g.h;
    if (!lit) {
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.clearRect(0, 0, c.scratch.width, c.scratch.height);
      lx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      lit = true;
    }
    for (const p of planes) {
      const span = p.z1 - p.z0;
      for (const [h0, h1] of glazing.rows) {
        // Light through glass h0..h1 above the sill lands this far out on a surface `drop` below it.
        const v0 = ((h0 + p.drop) / tanAlt - p.z0) / span, v1 = ((h1 + p.drop) / tanAlt - p.z0) / span;
        const a = clamp(v0), b = clamp(v1);
        if (b - a < 0.005) continue;
        for (const [x0, x1] of glazing.cols) {
          const corner = (x: number, v: number) => p.at(x + drift * (p.z0 + v * span), v);
          const [, ya] = corner(x0, a), [, yb] = corner(x0, b);
          const grd = lx.createLinearGradient(0, ya, 0, yb);
          grd.addColorStop(0, rgba(src.color, k));
          grd.addColorStop(1, rgba(src.color, k * 0.6));
          lx.fillStyle = grd;
          // Two passes, one slightly larger and fainter, for a soft edge.
          for (const [grow, alpha] of [[3 * g.s, 0.45], [0, 1]] as const) {
            lx.globalAlpha = alpha;
            trace(lx, [corner(x0 - grow, a), corner(x1 + grow, a), corner(x1 + grow, b), corner(x0 - grow, b)]);
            lx.fill();
          }
        }
      }
    }
    lx.globalAlpha = 1;
    // Dust turning slowly in the beam, over the first surface the light reaches.
    const p = planes[0]!, x0 = glazing.cols[0]![0], x1 = glazing.cols[glazing.cols.length - 1]![1];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of motes) {
      const x = x0 + ((m.u + Math.sin(env.t * 0.05 + m.ph) * 0.02 + 1) % 1) * (x1 - x0);
      const [px, py] = p.at(x + drift * (p.z0 + m.v * (p.z1 - p.z0)), m.v);
      const y = py - (0.05 + m.h * 0.3) * g.h + Math.sin(env.t * 0.13 + m.ph) * 6 * g.s;
      const tw = 0.5 + 0.5 * Math.sin(env.t * 0.9 + m.ph * 3);
      ctx.fillStyle = rgba(src.color, 0.35 * k * tw);
      ctx.fillRect(px, y, 1.6 * g.s, 1.6 * g.s);
    }
    ctx.restore();
  }
  if (lit) {
    // Keep it off anything nearer than the surfaces, then lay it over the room: overlay for colour, a little screen
    // for brightness.
    lx.setTransform(1, 0, 0, 1, 0, 0);
    if (c.mask) {
      lx.globalCompositeOperation = "destination-out";
      lx.drawImage(c.mask, 0, 0);
      lx.globalCompositeOperation = "source-over";
    }
    ctx.save();
    for (const [mode, alpha] of [["overlay", 0.5], ["screen", 0.1]] as const) {
      ctx.globalCompositeOperation = mode;
      ctx.globalAlpha = alpha;
      ctx.drawImage(c.scratch, 0, 0, g.W, g.H);
    }
    ctx.restore();
  }
  // Golden hour warms the whole room, not only the patches.
  const warm = env.golden * clear * smooth(-2, 2, env.sunAlt);
  if (warm > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = rgba([255, 150, 70], 0.35 * warm);
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
  }
}
