/** A painted room, built from a description: the marks to paint behind and in front of the window, a palette for
 *  each light (night, day and the warm interior light), where the interior lights are, and what moves. The room is
 *  painted once per resize in each palette; each frame blends the paintings for the real daylight and lamp level,
 *  then draws the live details, a vignette and grain. (painted-study.ts predates this and keeps its own copy.) */
import type { AmbienceWeights, FrameEnv, Geom, RoomPack } from "../types";
import { clamp, makeRng, mixRGB, rgba, scaleRGB, type RGB, type Rng } from "../util";
import { brush, free, grain, layer, trace, type Pt } from "./paint";
import { dayLevel, glow } from "./props";

export type Palette = Record<string, RGB>;
/** A shape to paint: a brushed fill, or a painted line. */
export type Mark =
  | { kind: "fill"; pts: Pt[]; key: string; angle?: number; density?: number; edge?: number; spread?: number; len?: [number, number] }
  | { kind: "line"; pts: Pt[]; key: string; width: number; alpha?: number };
/** A pool of interior light: where the warm palette shows through. */
export type Light = { x: number; y: number; r: number; a?: number };

export type PaintedSpec<L> = {
  id: string;
  name: string;
  ambience: AmbienceWeights;
  palettes: { night: Palette; day: Palette; lamp: Palette };
  /** Positions shared by the marks and the live details. */
  layout(g: Geom): L;
  back(g: Geom, rng: Rng, l: L): Mark[];
  front(g: Geom, rng: Rng, l: L): Mark[];
  lights(g: Geom, l: L): { back: Light[]; front: Light[] };
  /** How bright the interior lights are (0..1). Defaults to the lamp, nearly always on after dark. */
  level?(env: FrameEnv): number;
  /** Live details drawn over the painting each frame. `on` is the interior light level. */
  overlay(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, l: L, on: number): void;
  /** Where a record player stands while music plays. */
  player?(g: Geom, l: L): { x: number; y: number };
  /** Background blur in pixels (the room behind the window is a little out of focus). */
  soften?: number;
  /** The panes of the painted window (top row first), so frost and settled snow sit in them. */
  panes?(g: Geom): Geom["panes"];
};

type Layers = { night: HTMLCanvasElement; day: HTMLCanvasElement; lamp: HTMLCanvasElement };
export type PaintedRoomData<L> = { l: L; back: Layers; front: Layers; player: { x: number; y: number } | null; panes?: Geom["panes"] };

export const defaultLevel = (env: FrameEnv) => clamp(Math.max(env.lamp * 1.1, 0.6 * (1 - dayLevel(env))) + 0.15);

function paint(g: Geom, marks: Mark[], pal: Palette, seed: number, soften: number) {
  const L = layer(g.W, g.H, soften ? 1 : 1.5), x = L.x, rng = makeRng(seed);
  for (const mk of marks) {
    const col = pal[mk.key] ?? [255, 0, 255];
    if (mk.kind === "fill") brush(x, mk.pts, col, rng, { s: g.s, angle: mk.angle ?? 0, density: mk.density ?? 160, spread: mk.spread ?? 0.14, edge: mk.edge ?? 0, ...(mk.len ? { len: mk.len } : {}) });
    else {
      x.strokeStyle = rgba(col, mk.alpha ?? 1);
      x.lineWidth = mk.width;
      x.lineCap = x.lineJoin = "round";
      x.beginPath();
      mk.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.stroke();
    }
  }
  if (!soften) return L.c;
  const out = layer(g.W, g.H, 1);
  out.x.filter = `blur(${soften}px)`;
  out.x.drawImage(L.c, 0, 0, g.W, g.H);
  out.x.filter = "none";
  free(L.c);
  return out.c;
}

/** Keeps the warm layer only within the pools of interior light. */
function mask(g: Geom, c: HTMLCanvasElement, lights: Light[]) {
  const m = layer(g.W, g.H, 1);
  m.x.globalCompositeOperation = "lighter";
  for (const L of lights) {
    const grd = m.x.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
    const a = L.a ?? 1;
    grd.addColorStop(0, `rgba(0,0,0,${a})`);
    grd.addColorStop(0.35, `rgba(0,0,0,${0.7 * a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    m.x.fillStyle = grd;
    m.x.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  const x = c.getContext("2d")!;
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = "destination-in";
  x.drawImage(m.c, 0, 0, c.width, c.height);
  x.restore();
  free(m.c);
}

function blend(ctx: CanvasRenderingContext2D, g: Geom, l: Layers, day: number, on: number) {
  ctx.drawImage(l.night, 0, 0, g.W, g.H);
  if (day > 0.01) {
    ctx.globalAlpha = day;
    ctx.drawImage(l.day, 0, 0, g.W, g.H);
  }
  ctx.globalAlpha = on * (1 - 0.55 * day);
  ctx.drawImage(l.lamp, 0, 0, g.W, g.H);
  ctx.globalAlpha = 1;
}

export function paintedRoom<L>(spec: PaintedSpec<L>): RoomPack<PaintedRoomData<L>> {
  const level = spec.level ?? defaultLevel;
  return {
    id: spec.id,
    name: spec.name,
    ambience: spec.ambience,

    build(g, rng) {
      const l = spec.layout(g);
      const bm = spec.back(g, rng, l), fm = spec.front(g, rng, l), lights = spec.lights(g, l), soft = spec.soften ?? 1.6;
      const { night, day, lamp } = spec.palettes;
      const back = { night: paint(g, bm, night, 11, soft), day: paint(g, bm, day, 11, soft), lamp: paint(g, bm, lamp, 11, soft) };
      const front = { night: paint(g, fm, night, 23, 0), day: paint(g, fm, day, 23, 0), lamp: paint(g, fm, lamp, 23, 0) };
      mask(g, back.lamp, lights.back);
      mask(g, front.lamp, lights.front);
      const panes = spec.panes?.(g);
      return { l, back, front, player: spec.player?.(g, l) ?? null, ...(panes ? { panes } : {}) };
    },

    drawRoom(ctx, env, g, d) {
      blend(ctx, g, d.back, dayLevel(env), level(env));
    },

    drawInterior(ctx, env, g, d) {
      const { W, H } = g, on = level(env);
      blend(ctx, g, d.front, dayLevel(env), on);
      spec.overlay(ctx, env, g, d.l, on);
      if (d.player) recordPlayer(ctx, env, d.player.x, d.player.y, g.s, on);
      const v = ctx.createRadialGradient(W / 2, g.y + g.h * 0.6, Math.min(W, H) * 0.32, W / 2, g.y + g.h * 0.6, Math.max(W, H) * 0.8);
      v.addColorStop(0, "rgba(8,8,22,0)");
      v.addColorStop(1, "rgba(8,8,22,0.5)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = ctx.createPattern(grain(), "repeat")!;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
  };
}

/** A small record player in painted, simplified shapes, with the album art turning on the label. Drawn only while
 *  music plays. (x, y) is the middle of its base. */
export function recordPlayer(ctx: CanvasRenderingContext2D, env: FrameEnv, x: number, y: number, s: number, on: number) {
  const m = env.music;
  if (m.on < 0.02) return;
  const day = dayLevel(env), lit = (c: RGB) => mixRGB(scaleRGB(c, 0.35 + 0.5 * day), [255, 180, 120], 0.25 * on);
  ctx.save();
  ctx.globalAlpha = m.on;
  const w = 150 * s, h = 22 * s;
  ctx.fillStyle = "rgba(6,4,14,0.4)";
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * s, w * 0.56, 7 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(lit([120, 84, 64]));
  trace(ctx, [[x - w / 2, y], [x + w / 2, y], [x + w / 2 - 4 * s, y - h], [x - w / 2 + 4 * s, y - h]]);
  ctx.fill();
  ctx.fillStyle = rgba(lit([150, 110, 84]));
  ctx.fillRect(x - w / 2 + 4 * s, y - h, w - 8 * s, 3 * s);
  // The record, seen from just above, and its label with the album art.
  const cx = x - 14 * s, cy = y - h - 2 * s, R = 56 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.28);
  ctx.fillStyle = "rgb(14,12,18)";
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let r = R * 0.45; r < R; r += 5 * s) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(m.spin);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2);
  ctx.clip();
  if (m.art) ctx.drawImage(m.art, -R * 0.34, -R * 0.34, R * 0.68, R * 0.68);
  else {
    ctx.fillStyle = "rgb(190,120,80)";
    ctx.fillRect(-R, -R, R * 2, R * 2);
  }
  ctx.restore();
  // A warm sheen across the record from the room's light.
  glow(ctx, cx - R * 0.3, cy - 3 * s, R * 0.8, [255, 190, 130], 0.12 * on);
  // Tonearm.
  const px = x + w / 2 - 16 * s, py = y - h - 4 * s, a = -0.2 - 0.55 * m.arm;
  ctx.strokeStyle = rgba(lit([200, 196, 190]));
  ctx.lineWidth = 3 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(a) * 70 * s, py + Math.cos(a) * 18 * s);
  ctx.stroke();
  ctx.fillStyle = rgba(lit([60, 56, 60]));
  ctx.beginPath();
  ctx.arc(px, py, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  hologram(ctx, env, cx, cy, s);
}

/** A small hologram projected up from the record: a beam of light, and the album art with the song's name floating
 *  in it, flickering and scanned like an old projector. */
export function hologram(ctx: CanvasRenderingContext2D, env: FrameEnv, x: number, y: number, s: number) {
  const m = env.music, k = m.on * (0.4 + 0.6 * m.arm);
  if (k < 0.02) return;
  const t = env.t, flicker = 0.88 + 0.08 * Math.sin(t * 13) + 0.04 * Math.sin(t * 31.7) - (Math.sin(t * 0.7) > 0.985 ? 0.3 : 0);
  const a = k * flicker, cyan: RGB = [140, 225, 255];
  const size = 104 * s, bob = Math.sin(t * 1.3) * 3 * s, top = y - 60 * s - size + bob, left = x - size / 2;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // The beam, widening from the spindle up to the picture.
  const beam = ctx.createLinearGradient(0, y, 0, top);
  beam.addColorStop(0, rgba(cyan, 0.35 * a));
  beam.addColorStop(1, rgba(cyan, 0.04 * a));
  ctx.fillStyle = beam;
  trace(ctx, [[x - 3 * s, y], [x + 3 * s, y], [left + size, top + size], [left, top + size]]);
  ctx.fill();
  glow(ctx, x, y, 14 * s, cyan, 0.5 * a);
  // The album art, tinted blue and slightly see-through.
  ctx.globalAlpha = 0.55 * a;
  if (m.art) ctx.drawImage(m.art, left, top, size, size);
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgba(cyan, 0.16 * a);
  ctx.fillRect(left, top, size, size);
  ctx.strokeStyle = rgba(cyan, 0.6 * a);
  ctx.lineWidth = Math.max(1, s);
  ctx.strokeRect(left, top, size, size);
  // Scanlines rolling slowly down through it.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,10,24,0.28)";
  for (let ly = top + ((t * 12 * s) % (3 * s)); ly < top + size; ly += 3 * s) ctx.fillRect(left, ly, size, Math.max(1, s));
  ctx.globalCompositeOperation = "lighter";
  // The song and artist, above the picture.
  const fit = (text: string, px: number) => {
    ctx.font = `600 ${px}px Inter, system-ui, sans-serif`;
    let out = text;
    while (out.length > 1 && ctx.measureText(out).width > size * 1.6) out = out.slice(0, -2) + "…";
    return out;
  };
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = rgba(cyan, 0.9 * a);
  ctx.shadowBlur = 8 * s;
  ctx.fillStyle = rgba([220, 246, 255], 0.9 * a);
  if (m.title) ctx.fillText(fit(m.title, Math.round(15 * s)), x, top - 18 * s);
  ctx.fillStyle = rgba([180, 232, 255], 0.65 * a);
  if (m.artist) ctx.fillText(fit(m.artist, Math.round(11 * s)), x, top - 4 * s);
  ctx.restore();
}
