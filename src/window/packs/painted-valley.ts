/** "Painted valley": snow-capped peaks, forested ridges and a valley with a village's warm lights, framed by tall
 *  pines near the window. Painted in green and snowy versions (by day and night) and blended for the season and
 *  the weather, so it's a winter valley when it's cold and a green one in summer. */
import type { FrameEnv, Geom, ViewPack } from "../types";
import { clamp, makeRng, mixRGB, rgba, type RGB, type Rng } from "../util";
import { brush, free, layer, wobble, type Pt } from "./paint";

type Band = { night: HTMLCanvasElement; day: HTMLCanvasElement; snowNight: HTMLCanvasElement; snowDay: HTMLCanvasElement; lights: HTMLCanvasElement | null; depth: number };
export type PaintedValleyData = { bands: Band[]; box: { x: number; y: number; w: number; h: number } };

type Shape = { pts: Pt[]; kind: "ground" | "cap" | "tree"; angle: number };
type Colors = { ground: RGB; tree: RGB; cap: RGB };
type BandSpec = { depth: number; blur: number; night: Colors; day: Colors; snowNight: Colors; snowDay: Colors; shapes: (g: Geom, rng: Rng) => Shape[]; lights?: (g: Geom, rng: Rng) => Pt[] };

/** A pine: tiers of drooping branches, wider toward the bottom, a little uneven. */
const pine = (x: number, base: number, h: number, w: number, rng?: Rng): Pt[] => {
  const n = rng ? 7 : 4, j = () => (rng ? 0.85 + rng() * 0.3 : 1);
  const tiers = Array.from({ length: n }, (_, k) => ({ y: base - h + (h * (k + 1)) / (n + 0.4), ww: ((w * (k + 1)) / n) * j() }));
  const pts: Pt[] = [[x, base - h]];
  for (const t of tiers) pts.push([x + t.ww, t.y], [x + t.ww * 0.4, t.y - h * 0.03]);
  pts.push([x + w * 0.08, base], [x - w * 0.08, base]);
  for (const t of [...tiers].reverse()) pts.push([x - t.ww * 0.4, t.y - h * 0.03], [x - t.ww, t.y]);
  return pts;
};

const ridge = (g: Geom, rng: Rng, base: number, amp: number, rough: number, margin: number): Pt[] => {
  const pts: Pt[] = [[g.x - margin, g.y + g.h + 30]];
  const n = 40;
  let y = base;
  for (let i = 0; i <= n; i++) {
    y += (rng() - 0.5) * amp * rough;
    y = Math.min(base + amp * 0.5, Math.max(base - amp, y));
    pts.push([g.x - margin + ((g.w + margin * 2) * i) / n, g.y + g.h * y]);
  }
  pts.push([g.x + g.w + margin, g.y + g.h + 30]);
  return pts;
};

const BANDS: BandSpec[] = [
  {
    depth: 0.92,
    blur: 1.8,
    night: { ground: [56, 64, 104], tree: [48, 56, 94], cap: [104, 114, 156] },
    day: { ground: [128, 144, 178], tree: [112, 128, 160], cap: [226, 232, 244] },
    snowNight: { ground: [96, 106, 148], tree: [80, 90, 130], cap: [120, 130, 172] },
    snowDay: { ground: [206, 214, 232], tree: [170, 180, 204], cap: [240, 244, 250] },
    shapes(g, rng) {
      // Peaks: a jagged range with snow on the tops.
      // Peaks and saddles left to right, so the outline never doubles back on itself.
      const foot = g.y + g.h * 0.56, caps: Shape[] = [];
      const pts: Pt[] = [[g.x - 60, g.y + g.h + 30], [g.x - 60, foot]];
      let x = g.x - 60;
      while (x < g.x + g.w + 60) {
        const w = g.w * (0.12 + rng() * 0.14), top = g.y + g.h * (0.3 + rng() * 0.14), px = x + w * (0.4 + rng() * 0.2);
        const sad = foot - g.h * (0.02 + rng() * 0.06);
        pts.push([px - w * 0.12, top + (foot - top) * 0.28], [px, top], [px + w * 0.1, top + (foot - top) * 0.22], [x + w, sad]);
        const ch = (foot - top) * 0.32;
        caps.push({ kind: "cap", angle: Math.PI / 2, pts: [[px, top], [px + w * 0.1, top + ch * 0.7], [px + w * 0.05, top + ch * 0.85], [px - w * 0.02, top + ch], [px - w * 0.08, top + ch * 0.75], [px - w * 0.12, top + ch * 0.85]] });
        x += w;
      }
      pts.push([g.x + g.w + 60, g.y + g.h + 30]);
      return [{ kind: "ground", angle: Math.PI / 2, pts: wobble(pts, rng, 3, 14) }, ...caps.map((c) => ({ ...c, pts: wobble(c.pts, rng, 2, 8) }))];
    },
  },
  {
    depth: 0.6,
    blur: 0.8,
    night: { ground: [34, 44, 70], tree: [24, 32, 54], cap: [60, 70, 100] },
    day: { ground: [74, 100, 104], tree: [52, 76, 82], cap: [140, 160, 170] },
    snowNight: { ground: [84, 94, 132], tree: [34, 42, 66], cap: [100, 110, 150] },
    snowDay: { ground: [208, 216, 232], tree: [70, 90, 104], cap: [230, 236, 246] },
    shapes(g, rng) {
      const out: Shape[] = [{ kind: "ground", angle: 0, pts: wobble(ridge(g, rng, 0.66, 0.08, 0.6, 50), rng, 2, 12) }];
      // A forest along the ridge.
      for (let x = g.x - 40; x < g.x + g.w + 40; x += g.w * (0.012 + rng() * 0.012)) {
        const base = g.y + g.h * (0.66 + (rng() - 0.5) * 0.06), h = g.h * (0.04 + rng() * 0.05);
        out.push({ kind: "tree", angle: Math.PI / 2, pts: pine(x, base + h * 0.4, h, h * 0.4) });
      }
      return out;
    },
    lights(g, rng) {
      return Array.from({ length: 7 }, () => [g.x + rng() * g.w, g.y + g.h * (0.66 + rng() * 0.08)] as Pt);
    },
  },
  {
    depth: 0.35,
    blur: 0,
    night: { ground: [30, 36, 62], tree: [18, 24, 42], cap: [52, 44, 56] },
    day: { ground: [96, 122, 102], tree: [44, 66, 66], cap: [118, 92, 84] },
    snowNight: { ground: [100, 108, 146], tree: [22, 28, 48], cap: [64, 56, 70] },
    snowDay: { ground: [226, 232, 242], tree: [52, 74, 82], cap: [128, 100, 92] },
    shapes(g, rng) {
      const out: Shape[] = [{ kind: "ground", angle: 0, pts: wobble(ridge(g, rng, 0.8, 0.04, 0.4, 50), rng, 2, 12) }];
      // The village: little houses with pitched roofs in the middle of the valley.
      const cx = g.x + g.w * (0.35 + rng() * 0.3);
      for (let i = 0; i < 16; i++) {
        const x = cx + (rng() - 0.5) * g.w * 0.36, base = g.y + g.h * (0.8 + rng() * 0.05), w = g.w * (0.009 + rng() * 0.007), h = w * 0.7;
        out.push({ kind: "cap", angle: 0, pts: [[x - w / 2, base], [x - w / 2, base - h], [x, base - h - w * 0.45], [x + w / 2, base - h], [x + w / 2, base]] });
      }
      return out;
    },
    lights(g, rng) {
      const cx = g.x + g.w * 0.5;
      return Array.from({ length: 40 }, () => [cx + (rng() - 0.5) * g.w * 0.42, g.y + g.h * (0.78 + rng() * 0.07)] as Pt);
    },
  },
  {
    depth: 0.1,
    blur: 0,
    night: { ground: [16, 22, 38], tree: [12, 18, 32], cap: [16, 22, 38] },
    day: { ground: [40, 62, 60], tree: [30, 50, 52], cap: [40, 62, 60] },
    snowNight: { ground: [70, 78, 112], tree: [14, 20, 36], cap: [96, 104, 140] },
    snowDay: { ground: [220, 226, 238], tree: [36, 56, 60], cap: [236, 240, 248] },
    shapes(g, rng) {
      // Tall pines near the window on both sides, and a snowy bank below.
      const out: Shape[] = [{ kind: "ground", angle: 0, pts: wobble([[g.x - 60, g.y + g.h * 0.93], [g.x + g.w * 0.3, g.y + g.h * 0.9], [g.x + g.w * 0.7, g.y + g.h * 0.94], [g.x + g.w + 60, g.y + g.h * 0.9], [g.x + g.w + 60, g.y + g.h + 40], [g.x - 60, g.y + g.h + 40]], rng, 2, 12) }];
      for (const [u, k] of [[-0.02, 0.62], [0.07, 0.42], [0.95, 0.56], [1.02, 0.4]] as const) {
        const h = g.h * k, x = g.x + g.w * u;
        out.push({ kind: "tree", angle: Math.PI / 2, pts: wobble(pine(x, g.y + g.h * 0.97, h, h * 0.34, rng), rng, 2, 8) });
      }
      return out;
    },
  },
];

export const paintedValley: ViewPack<PaintedValleyData> & { painted: true } = {
  id: "painted-valley",
  name: "Painted valley",
  painted: true,
  ambience: { rain: 1, wind: 0.9, city: 0.1, fire: 0, crickets: 0.6, birds: 0.8 },

  build(g, rng) {
    const margin = 40 * g.s;
    const box = { x: g.x - margin, y: g.y - margin, w: g.w + margin * 2, h: g.h + margin * 2 };
    const region = () => {
      const L = layer(box.w, box.h, 1);
      L.x.translate(-box.x, -box.y);
      return L;
    };
    const bands = BANDS.map((b, i) => {
      const shapes = b.shapes(g, rng);
      const paintBand = (cols: Colors, seed: number, snowy: boolean) => {
        const L = region(), r = makeRng(seed);
        for (const sh of shapes) {
          // Snow caps belong to the snowy versions, except on the high peaks, which keep theirs all year.
          if (sh.kind === "cap" && !snowy && i !== 0 && i !== 2) continue;
          brush(L.x, sh.pts, cols[sh.kind], r, { s: g.s, angle: sh.angle, density: 70, spread: 0.12, len: [6, 22] });
        }
        if (!b.blur) return L.c;
        const out = layer(box.w, box.h, 1);
        out.x.filter = `blur(${b.blur}px)`;
        out.x.drawImage(L.c, 0, 0, box.w, box.h);
        free(L.c);
        return out.c;
      };
      let lights: HTMLCanvasElement | null = null;
      if (b.lights) {
        const L = region(), lr = makeRng(200 + i), s = g.s;
        for (const [lx, ly] of b.lights(g, rng)) {
          const col = mixRGB([255, 176, 90], [255, 214, 150], lr()), sz = (1.4 + lr() * 1.4) * s * (1 - b.depth * 0.5);
          const grd = L.x.createRadialGradient(lx, ly, 0, lx, ly, sz * 5);
          grd.addColorStop(0, rgba(col, 0.4));
          grd.addColorStop(1, rgba(col, 0));
          L.x.fillStyle = grd;
          L.x.fillRect(lx - sz * 5, ly - sz * 5, sz * 10, sz * 10);
          L.x.fillStyle = rgba(col);
          L.x.fillRect(lx - sz / 2, ly - sz / 2, sz, sz);
        }
        lights = L.c;
      }
      return {
        night: paintBand(b.night, 40 + i, false),
        day: paintBand(b.day, 40 + i, false),
        snowNight: paintBand(b.snowNight, 40 + i, true),
        snowDay: paintBand(b.snowDay, 40 + i, true),
        lights,
        depth: b.depth,
      };
    });
    return { bands, box };
  },

  drawLandscape(ctx, env, g, d, P) {
    const day = clamp(env.dayness), { x: bx, y: by, w: W, h: H } = d.box;
    const snow = snowAmount(env);
    const lit = clamp((env.night - 0.1) * 1.6 + env.rain * 0.2 + env.snow * 0.2) * (env.localHour >= 1 && env.localHour < 5.5 ? 0.5 : 1);
    const wash = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
    // Night skies over snow glow faintly near the horizon.
    wash.addColorStop(0, rgba(mixRGB([14, 18, 46], [150, 168, 200], day), 0.3));
    wash.addColorStop(0.75, rgba(mixRGB([84, 86, 124], [210, 210, 222], day), 0.25 + 0.25 * snow * (1 - day)));
    ctx.fillStyle = wash;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    for (const b of d.bands) {
      const p = P.par(1 - b.depth), x = bx + p.x, y = by + p.y;
      ctx.drawImage(b.night, x, y, W, H);
      if (day > 0.01) layerAt(ctx, b.day, x, y, W, H, day);
      if (snow > 0.01) {
        layerAt(ctx, b.snowNight, x, y, W, H, snow);
        if (day > 0.01) layerAt(ctx, b.snowDay, x, y, W, H, snow * day);
      }
      if (b.lights && lit > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        layerAt(ctx, b.lights, x, y, W, H, lit);
        ctx.restore();
      }
      // Mist between the layers: cool by night, pale by day, thicker in fog and snow.
      const haze = ctx.createLinearGradient(0, g.y + g.h * 0.4, 0, g.y + g.h);
      const mist = mixRGB([48, 54, 92], [196, 204, 222], day);
      haze.addColorStop(0, rgba(mist, 0));
      haze.addColorStop(1, rgba(mist, (0.12 + env.fog * 0.3 + env.snow * 0.15) * b.depth));
      ctx.fillStyle = haze;
      ctx.fillRect(g.x, g.y + g.h * 0.4, g.w, g.h * 0.6);
    }
  },

  drawForeground() {},
};

function layerAt(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number, w: number, h: number, a: number) {
  ctx.globalAlpha = a;
  ctx.drawImage(c, x, y, w, h);
  ctx.globalAlpha = 1;
}

/** Snow on the ground: settled snow, or winter, or a cold spell. */
function snowAmount(env: FrameEnv) {
  return clamp(Math.max(env.snowCover * 1.2, env.season === "winter" ? 0.85 : 0, env.temp < 1 ? 0.7 : 0, env.snow));
}
