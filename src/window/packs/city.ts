/** "City": a skyline of towers in three layers, their windows lighting up at dusk, with water tanks on the near roofs
 *  and red lights blinking on the tallest towers. A view only; any room can look out on it. */
import type { FrameEnv, Geom, Painter, ViewPack } from "../types";
import { clamp, mixRGB, rgba, type RGB, type Rng } from "../util";

type Tower = {
  x: number;
  w: number;
  top: number;
  c: RGB;
  /** Window grid: columns, rows, and a per-window threshold for when it lights. */
  cols: number;
  rows: number;
  cell: number;
  thr: Float32Array;
  warm: Float32Array;
  crown: "flat" | "step" | "spire" | "tank";
  beacon: number;
};
export type CityData = { layers: { towers: Tower[]; depth: number; dark: number }[] };

function towers(rng: Rng, g: Geom, depth: number, minH: number, maxH: number, minW: number, maxW: number, cell: number): Tower[] {
  const s = g.s, out: Tower[] = [];
  let x = g.x - 40 * s;
  while (x < g.x + g.w + 40 * s) {
    const w = (minW + rng() * (maxW - minW)) * s;
    const top = g.y + g.h * (1 - (minH + rng() * (maxH - minH)));
    const cs = cell * s, cols = Math.max(2, Math.floor((w - cs) / (cs * 1.9))), rows = Math.max(3, Math.floor((g.y + g.h - top) / (cs * 2.1)));
    const r = rng();
    out.push({
      x,
      w,
      top,
      c: mixRGB([64, 72, 96], [96, 90, 104], rng()),
      cols,
      rows,
      cell: cs,
      thr: Float32Array.from({ length: cols * rows }, () => rng()),
      warm: Float32Array.from({ length: cols * rows }, () => rng()),
      crown: r < 0.12 ? "spire" : r < 0.3 ? "step" : depth < 0.35 && r < 0.6 ? "tank" : "flat",
      beacon: rng() < 0.35 ? rng() * 6 : -1,
    });
    x += w + (rng() < 0.3 ? rng() * 30 * s : 2 * s);
  }
  return out;
}

export const cityView: ViewPack<CityData> = {
  id: "city",
  name: "City",
  ambience: { rain: 1, wind: 0.6, city: 1, fire: 0, crickets: 0.15, birds: 0.4 },

  build(g, rng) {
    return {
      layers: [
        { towers: towers(rng, g, 0.85, 0.42, 0.7, 50, 90, 4), depth: 0.85, dark: 0.55 },
        { towers: towers(rng, g, 0.55, 0.3, 0.58, 70, 120, 6), depth: 0.55, dark: 0.3 },
        { towers: towers(rng, g, 0.25, 0.14, 0.32, 110, 170, 9), depth: 0.25, dark: 0.1 },
      ],
    };
  },

  drawLandscape(ctx, env, g, d, P) {
    const bottom = g.y + g.h + 20;
    const late = env.localHour >= 1 && env.localHour < 5.5;
    const lit = clamp((env.night - 0.2) * 1.6 + env.rain * 0.2 + env.cloud * 0.1) * (late ? 0.45 : 1);
    for (const layer of d.layers) {
      const p = P.par(1 - layer.depth), haze = layer.depth;
      for (const t of layer.towers) {
        const x = t.x + p.x, top = t.top + p.y;
        const body = P.shade(mixRGB(t.c, [20, 22, 34], layer.dark * env.night), env, haze);
        ctx.fillStyle = rgba(body);
        ctx.fillRect(x, top, t.w, bottom - top);
        // Crowns: setbacks, spires and water tanks.
        if (t.crown === "step") ctx.fillRect(x + t.w * 0.2, top - t.w * 0.25, t.w * 0.6, t.w * 0.25 + 1);
        if (t.crown === "spire") {
          ctx.fillRect(x + t.w * 0.3, top - t.w * 0.2, t.w * 0.4, t.w * 0.2 + 1);
          ctx.fillRect(x + t.w * 0.48, top - t.w * 0.75, t.w * 0.04 + 1, t.w * 0.55);
        }
        if (t.crown === "tank") {
          const tx = x + t.w * 0.65, tw = t.w * 0.16;
          ctx.fillStyle = rgba(P.shade([70, 52, 44], env, haze));
          ctx.fillRect(tx, top - tw * 1.1, tw, tw * 0.9);
          ctx.beginPath();
          ctx.moveTo(tx - 2, top - tw * 1.1);
          ctx.lineTo(tx + tw / 2, top - tw * 1.5);
          ctx.lineTo(tx + tw + 2, top - tw * 1.1);
          ctx.fill();
          ctx.fillRect(tx + 2, top - tw * 0.2, 2, tw * 0.2);
          ctx.fillRect(tx + tw - 4, top - tw * 0.2, 2, tw * 0.2);
        }
        // A lighter edge where the sky catches the building.
        ctx.fillStyle = rgba(mixRGB(body, env.sky.bottom, 0.25), 0.6);
        ctx.fillRect(x, top, Math.max(1, t.w * 0.05), bottom - top);
        // Windows: dim reflections by day, lights coming on at dusk.
        const ox = x + (t.w - (t.cols - 1) * t.cell * 1.9 - t.cell) / 2;
        const dayGlass = mixRGB(body, env.sky.top, 0.35);
        for (let r = 0; r < t.rows; r++) {
          const wy = top + t.cell * 1.2 + r * t.cell * 2.1;
          if (wy > g.y + g.h) break;
          for (let c = 0; c < t.cols; c++) {
            const i = r * t.cols + c, on = t.thr[i]! < lit;
            const warm = t.warm[i]!;
            if (on) ctx.fillStyle = rgba(mixRGB(warm < 0.75 ? [255, 206, 130] : [196, 220, 255], body, haze * 0.45));
            else if (env.night > 0.6) continue;
            else ctx.fillStyle = rgba(dayGlass, 0.5);
            ctx.fillRect(ox + c * t.cell * 1.9, wy, t.cell, t.cell * 1.15);
          }
        }
        if (t.beacon >= 0 && env.night > 0.3) {
          const blink = Math.sin(env.t * 2 + t.beacon) > 0.6 ? 1 : 0.15;
          const by = t.crown === "spire" ? top - t.w * 0.75 : top - 3;
          const grd = ctx.createRadialGradient(x + t.w / 2, by, 0, x + t.w / 2, by, 10 * g.s);
          grd.addColorStop(0, rgba([255, 60, 50], 0.9 * blink));
          grd.addColorStop(1, rgba([255, 60, 50], 0));
          ctx.fillStyle = grd;
          ctx.fillRect(x + t.w / 2 - 10 * g.s, by - 10 * g.s, 20 * g.s, 20 * g.s);
        }
      }
      // City glow at street level, under each layer.
      if (env.night > 0.2) {
        const glow = ctx.createLinearGradient(0, g.y + g.h * 0.75, 0, bottom);
        glow.addColorStop(0, rgba([255, 170, 110], 0));
        glow.addColorStop(1, rgba([255, 170, 110], 0.12 * env.night * (1 - haze * 0.5)));
        ctx.fillStyle = glow;
        ctx.fillRect(g.x - 50, g.y + g.h * 0.75, g.w + 100, bottom - g.y - g.h * 0.75);
      }
    }
  },

  drawForeground(_ctx: CanvasRenderingContext2D, _env: FrameEnv, _g: Geom, _d: CityData, _P: Painter) {},
};
