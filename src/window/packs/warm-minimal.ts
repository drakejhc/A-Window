/** "Warm minimal": a deep window set into cream plaster, with sheer linen curtains, a cushioned window seat, a vase
 *  of dried branches, candles and a paper lantern. Sunlight falls on the wall in the window's shape. */
import type { FrameEnv, RoomPack } from "../types";
import { clamp, mapRGB, mixRGB, rgba, scaleRGB, type RGB } from "../util";
import { dayLevel, evening, glow, lighter, type Lit } from "./props";

export type MinimalData = {
  depth: number;
  seatY: number;
  blotches: { x: number; y: number; r: number; k: number }[];
  sheers: { x0: number; x1: number; ph: number }[];
  lantern: { x: number; y: number; r: number } | null;
  branches: { a: number; len: number; bend: number; seeds: number[] }[];
  candles: { x: number; h: number; ph: number }[];
  lamp: { x: number; y: number };
  turntable: { x: number; y: number };
};

const PLASTER: RGB = [228, 214, 194];
const LINEN: RGB = [214, 200, 178];
const OAK: RGB = [170, 128, 88];

/** A bright room: daylight carries further on pale plaster than in the darker rooms. */
function roomLit(env: FrameEnv): Lit {
  const base = lighter(env, 0.9), k = 1 + 0.32 * dayLevel(env);
  return (c) => mapRGB(base(c), (v) => Math.min(255, v * k));
}

export const warmMinimal: RoomPack<MinimalData> = {
  id: "minimal",
  name: "Warm minimal",
  ambience: { rain: 1, wind: 0.8, city: 0.8, fire: 0.3, crickets: 1, birds: 1 },

  build(g, rng) {
    const s = g.s, f = g.frame, depth = 34 * s;
    const seatY = g.y + g.h + f + depth * 0.9;
    const lx = g.x - f - depth - g.w * 0.2;
    const lantern = lx > 70 * s ? { x: lx, y: g.y + g.h * 0.12, r: 52 * s } : null;
    const span = g.w * 0.16;
    return {
      depth,
      seatY,
      blotches: Array.from({ length: 9 }, () => ({ x: rng() * g.W, y: rng() * g.H, r: (160 + rng() * 260) * s, k: rng() < 0.5 ? -1 : 1 })),
      sheers: [
        { x0: g.x - f - depth - span * 0.55, x1: g.x + span * 0.5, ph: rng() * 6 },
        { x0: g.x + g.w - span * 0.5, x1: g.x + g.w + f + depth + span * 0.55, ph: rng() * 6 },
      ],
      lantern,
      branches: Array.from({ length: 6 }, (_, i) => ({
        a: -0.45 + (i / 5) * 0.9 + (rng() - 0.5) * 0.15,
        len: 110 + rng() * 70,
        bend: (rng() - 0.5) * 0.5,
        seeds: Array.from({ length: 5 }, () => 0.45 + rng() * 0.55),
      })),
      candles: [0, 1, 2].map((i) => ({ x: g.x + g.w * 0.7 + i * 22 * s, h: [44, 30, 56][i]! * s, ph: rng() * 6 })),
      lamp: lantern ?? { x: g.x + g.w * 0.5, y: g.y - 60 * s },
      turntable: { x: g.x + g.w * 0.48, y: seatY },
    };
  },

  drawRoom(ctx, env, g, d) {
    const { W, H } = g;
    const lit = roomLit(env);
    ctx.fillStyle = rgba(lit(PLASTER));
    ctx.fillRect(0, 0, W, H);
    // Soft plaster blotches.
    for (const b of d.blotches) glow(ctx, b.x, b.y, b.r, b.k > 0 ? lit(scaleRGB(PLASTER, 1.08)) : lit(scaleRGB(PLASTER, 0.86)), 0.35);
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    glow(ctx, cx, cy, Math.max(W, H) * 0.65, mixRGB(env.sky.bottom, [255, 255, 255], 0.5), 0.25 * Math.min(1, env.dayness));

    // Sunlight on the wall: the window's shape, thrown away from the sun and sheared by its height.
    const sun = clamp(env.sunAlt / 10) * clamp(1 - env.cloud * 1.1) * (1 - env.rain) * (1 - env.fog);
    if (sun > 0.02) {
      const rel = (env.sunAz - 180) / 90, side = rel > 0 ? -1 : 1;
      const dx = side * g.w * (0.3 + 0.15 * Math.min(1, Math.abs(rel))), dy = g.h * (0.12 + 0.2 * (1 - clamp(env.sunAlt / 60)));
      const shear = side * 0.3;
      ctx.save();
      ctx.transform(1, 0, shear, 1, dx - shear * (g.y + g.h), dy);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(mixRGB([255, 206, 150], [255, 232, 200], env.dayness), 0.05 * sun);
      // Three passes, each inset a little, for a soft edge.
      for (const k of [0, 5, 10]) for (const p of g.panes) ctx.fillRect(p.x + k * g.s, p.y + k * g.s, p.w - 2 * k * g.s, p.h - 2 * k * g.s);
      ctx.restore();
    }
    // The lantern's warm light at night.
    glow(ctx, d.lamp.x, d.lamp.y, Math.max(W, H) * 0.6, env.lampColor, 0.32 * env.lamp);
    glow(ctx, cx, d.seatY, g.w * 0.8, [255, 196, 130], 0.12 * evening(env) * env.night);
    const v = ctx.createRadialGradient(cx, H / 2, Math.min(W, H) * 0.4, cx, H / 2, Math.max(W, H) * 0.85);
    v.addColorStop(0, "rgba(20,14,8,0)");
    v.addColorStop(1, "rgba(20,14,8,0.4)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  },

  drawInterior(ctx, env, g, d) {
    const { H } = g, s = g.s, f = g.frame, t = env.t, r = d.depth;
    const lit = roomLit(env);
    const ox = g.x - f - r, oy = g.y - f - r, ow = g.w + 2 * (f + r), oh = g.h + 2 * (f + r);
    const ix = g.x - f, iy = g.y - f, iw = g.w + 2 * f, ih = g.h + 2 * f;

    // The recess: four bevelled faces of the deep wall, lit from inside.
    const face = (pts: number[], c: RGB) => {
      ctx.fillStyle = rgba(lit(c));
      ctx.beginPath();
      ctx.moveTo(pts[0]!, pts[1]!);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
      ctx.fill();
    };
    face([ox, oy, ox + ow, oy, ix + iw, iy, ix, iy], scaleRGB(PLASTER, 0.72));
    face([ox, oy, ix, iy, ix, iy + ih, ox, oy + oh], scaleRGB(PLASTER, 0.86));
    face([ox + ow, oy, ix + iw, iy, ix + iw, iy + ih, ox + ow, oy + oh], scaleRGB(PLASTER, 0.82));
    face([ox, oy + oh, ix, iy + ih, ix + iw, iy + ih, ox + ow, oy + oh], scaleRGB(PLASTER, 1.04));
    const spill = mixRGB(env.sky.bottom, [255, 255, 255], 0.4);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba(spill, 0.08 * Math.min(1, env.dayness));
    ctx.fillRect(ox, oy, ow, oh);
    ctx.restore();

    // A thin off-white frame.
    ctx.fillStyle = rgba(lit([236, 230, 220]));
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.fill("evenodd");
    ctx.fillRect(g.mx - g.mull / 2, g.y, g.mull, g.h);
    ctx.fillRect(g.x, g.my - g.mull / 2, g.w, g.mull);
    ctx.strokeStyle = "rgba(0,0,0,.18)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(g.x - 1, g.y - 1, g.w + 2, g.h + 2);

    // Sheer linen curtains, swaying a little and letting the view through.
    const rodY = oy - 18 * s, bottom = d.seatY - 4 * s;
    ctx.fillStyle = rgba(lit([150, 120, 90]));
    ctx.fillRect(d.sheers[0]!.x0 - 16 * s, rodY - 3 * s, d.sheers[1]!.x1 - d.sheers[0]!.x0 + 32 * s, 4 * s);
    for (const sh of d.sheers) {
      const sway = Math.sin(t * 0.6 + sh.ph) * (3 + env.wind * 10) * s;
      const w = sh.x1 - sh.x0, n = Math.max(6, Math.round(w / (22 * s)));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sh.x0, rodY);
      ctx.lineTo(sh.x1, rodY);
      ctx.bezierCurveTo(sh.x1 + sway * 0.4, rodY + (bottom - rodY) * 0.4, sh.x1 + sway, bottom - 60 * s, sh.x1 + sway, bottom);
      for (let i = n; i >= 0; i--) ctx.lineTo(sh.x0 + (w * i) / n + sway * (i / n), bottom + (i % 2 ? 4 : 0) * s);
      ctx.closePath();
      ctx.clip();
      const gr = ctx.createLinearGradient(sh.x0, 0, sh.x1 + sway, 0);
      for (let i = 0; i < n; i++) {
        const u = i / n, k = 0.88 + 0.12 * Math.sin(i * 2.1 + sh.ph + t * 0.3);
        gr.addColorStop(u, rgba(lit(scaleRGB([250, 246, 238], k)), 0.34));
        gr.addColorStop(u + 0.5 / n, rgba(lit(scaleRGB([250, 246, 238], k * 0.92)), 0.22));
      }
      ctx.fillStyle = gr;
      ctx.fillRect(sh.x0 - 20 * s, rodY, w + 60 * s, bottom - rodY + 10 * s);
      glow(ctx, (sh.x0 + sh.x1) / 2, (rodY + bottom) / 2, w, mixRGB(env.sky.bottom, [255, 240, 220], 0.5), 0.2 * Math.min(1, env.dayness));
      ctx.restore();
    }

    // Window seat: a long cushion on an oak bench, wall to wall below the window.
    const top = d.seatY, x0 = ox - 60 * s, x1 = ox + ow + 60 * s;
    ctx.fillStyle = rgba(lit(OAK));
    ctx.fillRect(x0 - 20 * s, top + 22 * s, x1 - x0 + 40 * s, 12 * s);
    ctx.fillStyle = rgba(lit(scaleRGB(PLASTER, 0.9)));
    ctx.fillRect(x0 - 10 * s, top + 34 * s, x1 - x0 + 20 * s, H - top);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(x0 - 10 * s, top + 34 * s, x1 - x0 + 20 * s, 18 * s);
    ctx.fillStyle = rgba(lit(LINEN));
    ctx.beginPath();
    ctx.roundRect(x0, top - 2 * s, x1 - x0, 26 * s, 12 * s);
    ctx.fill();
    ctx.strokeStyle = rgba(lit(scaleRGB(LINEN, 0.85)));
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x0 + 10 * s, top + 11 * s);
    ctx.lineTo(x1 - 10 * s, top + 11 * s);
    ctx.stroke();

    // Pillows at either end.
    const pillow = (x: number, rot: number, c: RGB, w: number) => {
      ctx.save();
      ctx.translate(x, top);
      ctx.rotate(rot);
      ctx.fillStyle = rgba(lit(c));
      ctx.beginPath();
      ctx.roundRect(-w / 2, -w * 0.85, w, w * 0.85, 16 * s);
      ctx.fill();
      ctx.strokeStyle = rgba(lit(scaleRGB(c, 0.8)));
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 8 * s, -w * 0.42);
      ctx.lineTo(w / 2 - 8 * s, -w * 0.42);
      ctx.stroke();
      ctx.restore();
    };
    pillow(ox + 30 * s, -0.12, [192, 116, 82], 92 * s);
    pillow(ox + 100 * s, 0.06, [226, 210, 182], 80 * s);
    pillow(ox + ow - 120 * s, 0.1, [146, 128, 96], 88 * s);

    // A knit throw over the front edge.
    const tx = ox + ow - 10 * s;
    ctx.fillStyle = rgba(lit([186, 132, 104]));
    ctx.beginPath();
    ctx.moveTo(tx - 70 * s, top);
    ctx.quadraticCurveTo(tx, top - 10 * s, tx + 70 * s, top);
    ctx.lineTo(tx + 62 * s, top + 120 * s);
    ctx.quadraticCurveTo(tx, top + 130 * s, tx - 66 * s, top + 118 * s);
    ctx.fill();
    ctx.strokeStyle = rgba(lit([156, 106, 82]));
    ctx.lineWidth = 2 * s;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(tx + i * 12 * s, top);
      ctx.lineTo(tx + i * 11 * s, top + 122 * s);
      ctx.stroke();
    }

    // A vase of dried branches.
    const vx = g.x + g.w * 0.17, vb = top;
    ctx.strokeStyle = rgba(lit([110, 84, 60]));
    ctx.lineWidth = 2 * s;
    ctx.lineCap = "round";
    for (const b of d.branches) {
      const a = b.a + Math.sin(t * 0.3 + b.len) * 0.008;
      const ex = vx + Math.sin(a) * b.len * s, ey = vb - 70 * s - Math.cos(a) * b.len * s;
      const mx = vx + Math.sin(a + b.bend) * b.len * 0.5 * s, my = vb - 70 * s - Math.cos(a + b.bend) * b.len * 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(vx, vb - 60 * s);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      ctx.fillStyle = rgba(lit([196, 162, 112]));
      for (const u of b.seeds) {
        const px = (1 - u) * (1 - u) * vx + 2 * (1 - u) * u * mx + u * u * ex;
        const py = (1 - u) * (1 - u) * (vb - 60 * s) + 2 * (1 - u) * u * my + u * u * ey;
        ctx.beginPath();
        ctx.ellipse(px + 4 * s, py, 4 * s, 2.2 * s, a + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = rgba(lit([214, 200, 182]));
    ctx.beginPath();
    ctx.moveTo(vx - 10 * s, vb - 70 * s);
    ctx.quadraticCurveTo(vx - 34 * s, vb - 30 * s, vx - 20 * s, vb);
    ctx.lineTo(vx + 20 * s, vb);
    ctx.quadraticCurveTo(vx + 34 * s, vb - 30 * s, vx + 10 * s, vb - 70 * s);
    ctx.fill();

    // A short stack of books.
    let by = top;
    for (const [w, c] of [[110, [196, 182, 160]], [96, [92, 104, 96]], [100, [168, 110, 84]]] as [number, RGB][]) {
      ctx.fillStyle = rgba(lit(c));
      ctx.fillRect(g.x + g.w * 0.3 - (w * s) / 2, by - 13 * s, w * s, 13 * s);
      by -= 13 * s;
    }

    // Candles, lit in the evening.
    const on = clamp((evening(env) - 0.25) * 2);
    for (const c of d.candles) {
      ctx.fillStyle = rgba(lit([240, 232, 216]));
      ctx.beginPath();
      ctx.roundRect(c.x - 9 * s, top - c.h, 18 * s, c.h, 2 * s);
      ctx.fill();
      if (on > 0.02) {
        const fl = 1 + 0.12 * Math.sin(t * 9 + c.ph) + 0.06 * Math.sin(t * 17 + c.ph);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, c.x, top - c.h - 8 * s, 70 * s * fl, [255, 180, 100], 0.3 * on);
        ctx.restore();
        ctx.fillStyle = rgba([255, 220, 150], on);
        ctx.beginPath();
        ctx.ellipse(c.x, top - c.h - 8 * s, 3.5 * s, 8 * s * fl, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Paper lantern pendant.
    if (d.lantern) {
      const L = d.lantern;
      ctx.strokeStyle = rgba(lit([60, 50, 44]));
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(L.x, 0);
      ctx.lineTo(L.x, L.y - L.r);
      ctx.stroke();
      const paper = mixRGB(lit([240, 232, 218]), [255, 214, 160], clamp(env.lamp * 1.1));
      ctx.fillStyle = rgba(paper);
      ctx.beginPath();
      ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(scaleRGB(paper, 0.86));
      ctx.lineWidth = 1 * s;
      for (let k = -3; k <= 3; k++) {
        const yy = L.y + (k / 4) * L.r, hw = Math.sqrt(Math.max(0, L.r * L.r - (yy - L.y) ** 2));
        ctx.beginPath();
        ctx.moveTo(L.x - hw, yy);
        ctx.lineTo(L.x + hw, yy);
        ctx.stroke();
      }
      if (env.lamp > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, L.x, L.y, L.r * 3.2, env.lampColor, 0.3 * env.lamp);
        ctx.restore();
      }
    }

    // Candle and lantern reflections in the dark glass.
    if (env.night > 0.2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      for (const c of d.candles) glow(ctx, c.x, g.y + g.h - 30 * s, 16 * s, [255, 190, 120], 0.12 * on * env.night);
      ctx.restore();
    }
  },
};
