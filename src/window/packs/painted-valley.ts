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
type BandSpec = { depth: number; blur: number; /** Caps that stay all year (high snow, roofs), not only when snowy. */ keepCaps?: boolean; night: Colors; day: Colors; snowNight: Colors; snowDay: Colors; shapes: (g: Geom, rng: Rng) => Shape[]; lights?: (g: Geom, rng: Rng) => Pt[] };

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

/** A natural ridgeline through the given points, by midpoint displacement: each pass halves every segment and
 *  nudges the new point up or down, less with each pass. Points only move vertically, so the line never doubles
 *  back on itself. */
const ridgeline = (skeleton: Pt[], rng: Rng, rough: number, passes: number): Pt[] => {
  let pts = skeleton;
  let amp = rough;
  for (let k = 0; k < passes; k++) {
    const next: Pt[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!;
      next.push([(ax + bx) / 2, (ay + by) / 2 + (rng() - 0.5) * amp * Math.abs(bx - ax)], [bx, by]);
    }
    pts = next;
    amp *= 0.7;
  }
  return pts;
};

/** Snow above a snowline: each stretch of the ridge that rises above it, closed underneath by a ragged edge that
 *  reaches further down in places, like snow lying longer in the gullies. */
const snowCaps = (line: Pt[], snowY: number, foot: number, g: Geom, rng: Rng, reach: number): Pt[][] => {
  const caps: Pt[][] = [];
  let run: Pt[] = [];
  const close = () => {
    if (run.length > 2) {
      const x0 = run[0]![0], x1 = run[run.length - 1]![0], under: Pt[] = [];
      const n = Math.max(3, Math.round((x1 - x0) / (6 * g.s)));
      // Two out-of-step waves and some noise, so the gullies come at irregular intervals and depths.
      const a = rng() * 9, b = rng() * 9, f1 = (0.02 + rng() * 0.015) / g.s, f2 = (0.055 + rng() * 0.03) / g.s;
      for (let i = n; i >= 0; i--) {
        const x = x0 + ((x1 - x0) * i) / n;
        const gully = 0.6 * Math.pow(Math.abs(Math.sin(x * f1 + a)), 4) + 0.4 * Math.pow(Math.abs(Math.sin(x * f2 + b)), 6);
        under.push([x, Math.min(foot - g.h * 0.04, snowY + g.h * (0.005 + gully * reach + rng() * 0.015))]);
      }
      caps.push([...run, ...under]);
    }
    run = [];
  };
  for (const p of line) {
    if (p[1] < snowY) run.push(p);
    else close();
  }
  close();
  return caps;
};

const BANDS: BandSpec[] = [
  {
    // A far range, pale with distance and softer, so the main peaks stand in front of something.
    depth: 0.97,
    blur: 2.6,
    keepCaps: true,
    night: { ground: [64, 72, 112], tree: [60, 68, 106], cap: [92, 102, 144] },
    day: { ground: [158, 172, 202], tree: [148, 162, 194], cap: [222, 230, 244] },
    snowNight: { ground: [100, 110, 150], tree: [96, 106, 146], cap: [118, 128, 170] },
    snowDay: { ground: [212, 220, 236], tree: [204, 212, 230], cap: [236, 240, 248] },
    shapes(g, rng) {
      const foot = g.y + g.h * 0.56;
      const skeleton: Pt[] = [];
      for (let x = g.x - 60, i = 0; x < g.x + g.w + 120; x += g.w * (0.14 + rng() * 0.1), i++)
        skeleton.push([x, g.y + g.h * (i % 2 ? 0.44 + rng() * 0.05 : 0.35 + rng() * 0.06)]);
      const line = ridgeline(skeleton, rng, 0.16, 5);
      return [
        { kind: "ground", angle: Math.PI / 2, pts: [[g.x - 60, g.y + g.h + 30], ...line, [skeleton[skeleton.length - 1]![0], g.y + g.h + 30]] },
        ...snowCaps(line, g.y + g.h * 0.39, foot, g, rng, 0.04).map((pts): Shape => ({ kind: "cap", angle: Math.PI / 2, pts })),
      ];
    },
  },
  {
    // The main range: one big mountain off centre with smaller peaks around it, rugged ridgelines, a shadowed
    // face on each high peak, and snow down to a shared snowline, reaching lower in the gullies.
    depth: 0.92,
    blur: 1.8,
    keepCaps: true,
    night: { ground: [56, 64, 104], tree: [42, 48, 84], cap: [104, 114, 156] },
    day: { ground: [128, 144, 178], tree: [100, 112, 148], cap: [226, 232, 244] },
    snowNight: { ground: [96, 106, 148], tree: [74, 82, 120], cap: [120, 130, 172] },
    snowDay: { ground: [206, 214, 232], tree: [168, 178, 204], cap: [240, 244, 250] },
    shapes(g, rng) {
      const foot = g.y + g.h * 0.58;
      // Peaks as (x, top, width), the tallest a little off centre, the rest stepping down toward the edges.
      const main = g.x + g.w * (rng() < 0.5 ? 0.3 + rng() * 0.08 : 0.62 + rng() * 0.08);
      const peaks: { x: number; top: number }[] = [{ x: main, top: g.y + g.h * (0.17 + rng() * 0.04) }];
      for (const dir of [-1, 1]) {
        let x = main, k = 0;
        while ((dir < 0 ? x > g.x - 40 : x < g.x + g.w + 40) && k < 6) {
          x += dir * g.w * (0.13 + rng() * 0.12);
          k++;
          peaks.push({ x, top: g.y + g.h * Math.min(0.46, 0.25 + k * 0.035 + rng() * 0.08) });
        }
      }
      peaks.sort((a, b) => a.x - b.x);
      const skeleton: Pt[] = [];
      peaks.forEach((p, i) => {
        if (i) {
          // The saddle between two peaks sits lower the further apart they are.
          const prev = peaks[i - 1]!, gap = p.x - prev.x;
          skeleton.push([prev.x + gap * (0.4 + rng() * 0.2), Math.max(prev.top, p.top) + gap * (0.25 + rng() * 0.2)]);
        }
        skeleton.push([p.x, p.top]);
      });
      skeleton.unshift([g.x - 80, skeleton[0]![1] + g.h * 0.08]);
      skeleton.push([g.x + g.w + 80, skeleton[skeleton.length - 1]![1] + g.h * 0.08]);
      const line = ridgeline(skeleton, rng, 0.3, 6);
      const shapes: Shape[] = [{ kind: "ground", angle: Math.PI / 2, pts: [[g.x - 80, g.y + g.h + 30], ...line, [g.x + g.w + 80, g.y + g.h + 30]] }];
      // The shadowed face of each high peak: from the summit down its right-hand ridge, then back up a spur.
      for (const p of peaks.filter((q) => q.top < g.y + g.h * 0.36)) {
        const right = line.filter(([x]) => x >= p.x && x <= p.x + g.w * 0.16);
        if (right.length < 3) continue;
        // Down the right-hand ridge, then back up to the summit along a spur that leaves the lower slopes lit.
        const end = right[right.length - 1]!, low: Pt = [p.x + (end[0] - p.x) * 0.35, end[1] + (foot - end[1]) * 0.55];
        const spur = ridgeline([low, [p.x, p.top]], rng, 0.12, 4);
        shapes.push({ kind: "tree", angle: Math.PI / 2 + 0.35, pts: [...right, ...spur] });
      }
      for (const pts of snowCaps(line, g.y + g.h * 0.33, foot, g, rng, 0.07)) shapes.push({ kind: "cap", angle: Math.PI / 2, pts });
      return shapes;
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
    keepCaps: true,
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
          // Snow caps belong to the snowy versions, except on the high peaks (and the roofs), which keep theirs.
          if (sh.kind === "cap" && !snowy && !b.keepCaps) continue;
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
