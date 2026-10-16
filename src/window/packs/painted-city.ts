/** "Painted city": a dense skyline in three hazy layers of brushed silhouettes, scattered with tiny amber lights
 *  that glow softly, over a warm haze at street level. Painted once; each frame only blends day and night and
 *  fades the lights. Made for the painted study, but any room can look out on it. */
import type { Geom, ViewPack } from "../types";
import { clamp, makeRng, mixRGB, rgba, type RGB, type Rng } from "../util";
import { brush, free, layer, wobble, type Pt } from "./paint";

type Band = { night: HTMLCanvasElement; day: HTMLCanvasElement; lights: HTMLCanvasElement; depth: number };
/** Each band is painted only over the glass (plus a margin for parallax), at `box` on the canvas. */
export type PaintedCityData = { bands: Band[]; box: { x: number; y: number; w: number; h: number } };

const BANDS = [
  { depth: 0.9, minH: 0.36, maxH: 0.62, minW: 30, maxW: 70, night: [46, 54, 96] as RGB, day: [150, 162, 190] as RGB, light: 1.4, blur: 2.2 },
  { depth: 0.55, minH: 0.24, maxH: 0.5, minW: 50, maxW: 110, night: [30, 34, 66] as RGB, day: [118, 128, 160] as RGB, light: 2.2, blur: 1.2 },
  { depth: 0.2, minH: 0.1, maxH: 0.3, minW: 80, maxW: 160, night: [18, 20, 40] as RGB, day: [84, 92, 120] as RGB, light: 3, blur: 0 },
];

function skyline(g: Geom, rng: Rng, b: (typeof BANDS)[number], margin: number) {
  const s = g.s, towers: { pts: Pt[]; x: number; w: number; top: number }[] = [];
  let x = g.x - margin;
  const ground = g.y + g.h + 20;
  while (x < g.x + g.w + margin) {
    const w = (b.minW + rng() * (b.maxW - b.minW)) * s, top = g.y + g.h * (1 - (b.minH + rng() * (b.maxH - b.minH)));
    const pts: Pt[] = [[x, ground], [x, top]];
    const r = rng();
    if (r < 0.15) pts.push([x + w * 0.3, top], [x + w * 0.45, top - w * 0.5], [x + w * 0.55, top - w * 0.5], [x + w * 0.7, top]);
    else if (r < 0.35) pts.push([x + w * 0.2, top], [x + w * 0.2, top - w * 0.22], [x + w * 0.8, top - w * 0.22], [x + w * 0.8, top]);
    else if (r < 0.45) pts.push([x + w * 0.6, top], [x + w * 0.62, top - w * 0.9], [x + w * 0.66, top]);
    pts.push([x + w, top], [x + w, ground]);
    towers.push({ pts: wobble(pts, rng, 1.6 * s, 14 * s), x, w, top });
    x += w * (0.7 + rng() * 0.35);
  }
  return towers;
}

export const paintedCity: ViewPack<PaintedCityData> = {
  id: "painted-city",
  name: "Painted city",
  ambience: { rain: 1, wind: 0.5, city: 1, fire: 0, crickets: 0.1, birds: 0.3 },

  build(g, rng) {
    const margin = 40 * g.s;
    const box = { x: g.x - margin, y: g.y - margin, w: g.w + margin * 2, h: g.h + margin * 2 };
    const region = () => {
      const L = layer(box.w, box.h, 1);
      L.x.translate(-box.x, -box.y);
      return L;
    };
    const bands: Band[] = BANDS.map((b, i) => {
      const towers = skyline(g, rng, b, margin);
      const paintBand = (col: RGB, seed: number) => {
        const L = region(), r = makeRng(seed);
        for (const t of towers) brush(L.x, t.pts, mixRGB(col, [0, 0, 0], r() * 0.12), r, { s: g.s, angle: Math.PI / 2, density: 90, spread: 0.12, len: [6, 20] });
        if (!b.blur) return L.c;
        const out = layer(box.w, box.h, 1);
        out.x.filter = `blur(${b.blur}px)`;
        out.x.drawImage(L.c, 0, 0, box.w, box.h);
        free(L.c);
        return out.c;
      };
      // Tiny window lights: mostly amber and orange, a few cool, each with a soft glow.
      const lights = region(), lr = makeRng(100 + i), s = g.s;
      for (const t of towers) {
        const n = Math.round(((t.w * (g.y + g.h - t.top)) / (s * s * 900)) * (0.6 + lr()));
        for (let k = 0; k < n; k++) {
          if (lr() < 0.35) continue;
          const lx = t.x + 4 * s + lr() * (t.w - 8 * s), ly = t.top + 8 * s + lr() * (g.y + g.h - t.top);
          const col: RGB = lr() < 0.85 ? mixRGB([255, 180, 90], [255, 220, 150], lr()) : [190, 210, 255];
          const sz = b.light * s * (0.6 + lr() * 0.6);
          const grd = lights.x.createRadialGradient(lx, ly, 0, lx, ly, sz * 4);
          grd.addColorStop(0, rgba(col, 0.35));
          grd.addColorStop(1, rgba(col, 0));
          lights.x.fillStyle = grd;
          lights.x.fillRect(lx - sz * 4, ly - sz * 4, sz * 8, sz * 8);
          lights.x.fillStyle = rgba(col, 0.95);
          lights.x.fillRect(lx - sz / 2, ly - sz / 2, sz, sz * 1.2);
        }
      }
      return { night: paintBand(b.night, 30 + i), day: paintBand(b.day, 30 + i), lights: lights.c, depth: b.depth };
    });
    return { bands, box };
  },

  drawLandscape(ctx, env, g, d, P) {
    const day = clamp(env.dayness), { x: bx, y: by, w: W, h: H } = d.box;
    const late = env.localHour >= 1 && env.localHour < 5.5;
    const lit = clamp((env.night - 0.15) * 1.5 + env.rain * 0.2 + env.cloud * 0.15) * (late ? 0.6 : 1);
    // A soft wash over the sky, so it sits with the painting.
    const wash = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
    wash.addColorStop(0, rgba(mixRGB([14, 18, 46], [150, 168, 200], day), 0.4));
    wash.addColorStop(1, rgba(mixRGB([60, 50, 90], [200, 196, 210], day), 0.25));
    ctx.fillStyle = wash;
    ctx.fillRect(g.x, g.y, g.w, g.h);
    for (const b of d.bands) {
      const p = P.par(1 - b.depth);
      ctx.drawImage(b.night, bx + p.x, by + p.y, W, H);
      if (day > 0.01) {
        ctx.globalAlpha = day;
        ctx.drawImage(b.day, bx + p.x, by + p.y, W, H);
        ctx.globalAlpha = 1;
      }
      if (lit > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = lit;
        ctx.drawImage(b.lights, bx + p.x, by + p.y, W, H);
        ctx.restore();
      }
      // Haze between the layers, warm at street level after dark.
      const haze = ctx.createLinearGradient(0, g.y + g.h * 0.45, 0, g.y + g.h);
      haze.addColorStop(0, rgba(mixRGB([30, 34, 70], [170, 180, 205], day), 0));
      haze.addColorStop(1, rgba(mixRGB([150, 90, 80], [190, 196, 214], day), 0.22 * b.depth + 0.04));
      ctx.fillStyle = haze;
      ctx.fillRect(g.x, g.y + g.h * 0.45, g.w, g.h * 0.55);
    }
  },

  drawForeground() {},
};
