/** "Fjord Cabin": a log cabin above a fjord, with jagged mountains, pine slopes, still water that mirrors the
 *  sky, a red boathouse on the shore, icicles on cold days, and candles on a white-painted sill. */
import type { FrameEnv, Geom, Painter, WindowPack } from "../types";
import { clamp, lerp, makeNoise1D, mapRGB, mixRGB, rgba, scaleRGB, type RGB, type Rng } from "../util";

type Point = [number, number];
type Pine = { x: number; y: number; h: number };
export type CabinData = {
  far: Point[]; mid: Point[]; shore: Point[]; waterY: number;
  midPines: Pine[]; shorePines: Pine[];
  boathouse: { x: number; y: number; w: number; h: number };
  glints: { x: number; y: number; len: number; ph: number }[];
  icicles: { x: number; y: number; len: number; w: number }[];
  sillY: number;
  candles: { x: number; h: number; p: number }[];
  books: { x: number };
  lamp: { x: number; y: number };
  turntable: { x: number; y: number };
};

const SNOW: RGB = [236, 240, 248];

function ridge(rng: Rng, g: Geom, base: number, amp: number, jagged: boolean): Point[] {
  const n1 = makeNoise1D(rng, 4), n2 = makeNoise1D(rng, 3);
  return Array.from({ length: 91 }, (_, i) => {
    const u = i / 90;
    let lift = n1(u * 1.2 + 0.3);
    if (jagged) lift += 0.7 * Math.abs(n2(u * 3.2)) - 0.2;
    return [lerp(g.x - 70, g.x + g.w + 70, u), g.y + g.h * base - lift * g.h * amp];
  });
}

function ridgeY(pts: Point[], x: number) {
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]!;
    if (x1 >= x) {
      const [x0, y0] = pts[i - 1]!;
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return pts[pts.length - 1]![1];
}

function pinesAlong(rng: Rng, pts: Point[], x0: number, x1: number, spacing: number, hMin: number, hMax: number, s: number) {
  const out: Pine[] = [];
  for (let x = x0; x < x1; x += spacing * (0.6 + rng() * 0.8) * s) out.push({ x, y: ridgeY(pts, x) + 3 * s, h: (hMin + rng() * (hMax - hMin)) * s });
  return out;
}

/** Two-tier pine silhouettes added to the current path; `caps` draws only the snowy tips. */
function pinePath(ctx: CanvasRenderingContext2D, list: Pine[], off: { x: number; y: number }, caps: boolean) {
  for (const p of list) {
    const x = p.x + off.x, y = p.y + off.y, w = p.h * 0.42, k = caps ? 0.32 : 1;
    ctx.moveTo(x, y - p.h);
    ctx.lineTo(x + (w / 2) * k * 0.7, y - p.h + p.h * 0.6 * k);
    ctx.lineTo(x - (w / 2) * k * 0.7, y - p.h + p.h * 0.6 * k);
    ctx.closePath();
    if (caps) continue;
    ctx.moveTo(x, y - p.h * 0.62);
    ctx.lineTo(x + w * 0.62, y);
    ctx.lineTo(x - w * 0.62, y);
    ctx.closePath();
  }
}

function fillRidge(ctx: CanvasRenderingContext2D, pts: Point[], off: { x: number; y: number }, col: RGB, bottom: number) {
  ctx.fillStyle = rgba(col);
  ctx.beginPath();
  ctx.moveTo(pts[0]![0] + off.x, bottom);
  for (const [x, y] of pts) ctx.lineTo(x + off.x, y + off.y);
  ctx.lineTo(pts[pts.length - 1]![0] + off.x, bottom);
  ctx.fill();
}

const dayLevel = (env: FrameEnv) => Math.min(1, (env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);

function drawWater(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: CabinData, pf: { x: number; y: number }, wy: number, P: Painter) {
  const water = ctx.createLinearGradient(0, wy, 0, g.y + g.h);
  water.addColorStop(0, rgba(scaleRGB(mixRGB(env.sky.bottom, env.sky.top, 0.35), 0.85)));
  water.addColorStop(1, rgba(scaleRGB(env.sky.top, 0.55)));
  ctx.fillStyle = water;
  ctx.fillRect(g.x, wy, g.w, g.y + g.h - wy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(g.x, wy, g.w, g.y + g.h - wy);
  ctx.clip();
  // A dim mirror of the mountains, broken up by wind and rain.
  ctx.globalAlpha = 0.28 * (1 - env.wind * 0.6) * (1 - env.rain * 0.7);
  ctx.fillStyle = rgba(P.shade([70, 82, 100], env, 0.8));
  ctx.beginPath();
  ctx.moveTo(d.far[0]![0] + pf.x, wy);
  for (const [x, y] of d.far) ctx.lineTo(x + pf.x, 2 * wy - (y + pf.y));
  ctx.lineTo(d.far[d.far.length - 1]![0] + pf.x, wy);
  ctx.fill();
  ctx.strokeStyle = rgba(mixRGB(env.sky.bottom, [255, 255, 255], 0.4));
  ctx.lineWidth = Math.max(1, 1.2 * g.s);
  const moonlit = env.moonAlt > 0 ? env.night * 0.4 : 0;
  for (const gl of d.glints) {
    const a = (0.12 + 0.12 * Math.sin(env.t * (0.8 + env.wind * 2) + gl.ph)) * (0.4 + 0.6 * env.dayness + moonlit);
    if (a < 0.03) continue;
    ctx.globalAlpha = a;
    const x = g.x + ((gl.x * g.w + env.t * env.wind * 8) % g.w), y = wy + gl.y * (g.y + g.h - wy);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + gl.len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (env.temp < -4) {
    ctx.fillStyle = rgba(P.shade([214, 224, 236], env, 0.3), clamp((-env.temp - 4) / 8) * 0.75);
    ctx.fillRect(g.x, wy, g.w, g.y + g.h - wy);
  }
  ctx.restore();
}

export const fjordCabin: WindowPack<CabinData> = {
  id: "fjord-cabin",
  name: "Fjord Cabin",
  ambience: { rain: 0.9, wind: 1.2, city: 0.12, fire: 1.3, crickets: 0.3, birds: 0.6 },

  build(g, rng) {
    const s = g.s, sillY = g.y + g.h + g.frame * 0.7;
    const far = ridge(rng, g, 0.44, 0.17, true);
    const mid = ridge(rng, g, 0.6, 0.07, false);
    const shore = ridge(rng, g, 0.84, 0.03, false);
    const ice = makeNoise1D(rng, 3);
    const bx = g.x + g.w * 0.56;
    return {
      far, mid, shore, waterY: g.y + g.h * 0.7,
      midPines: pinesAlong(rng, mid, g.x - 60, g.x + g.w + 60, 9, 14, 30, s),
      shorePines: [
        ...pinesAlong(rng, shore, g.x - 40, g.x + g.w * 0.3, 26, 50, 95, s),
        ...pinesAlong(rng, shore, g.x + g.w * 0.74, g.x + g.w + 40, 26, 50, 95, s),
      ],
      boathouse: { x: bx, y: ridgeY(shore, bx) + 2 * s, w: 54 * s, h: 26 * s },
      glints: Array.from({ length: 40 }, () => ({ x: rng(), y: rng(), len: (8 + rng() * 26) * s, ph: rng() * 6.28 })),
      icicles: g.panes.slice(0, 2).flatMap((pn) =>
        Array.from({ length: Math.round(pn.w / (14 * s)) }, (_, i) => ({
          x: pn.x + (i + 0.5) * 14 * s + (rng() - 0.5) * 6 * s,
          y: pn.y,
          len: (6 + Math.max(0, ice(i * 0.37 + pn.x)) * 34 + rng() * 10) * s,
          w: (2.5 + rng() * 2.5) * s,
        })),
      ),
      sillY,
      candles: [{ x: g.x + g.w * 0.76, h: 46 * s, p: rng() * 6 }, { x: g.x + g.w * 0.83, h: 32 * s, p: rng() * 6 }],
      books: { x: g.x + g.w * 0.18 },
      lamp: { x: g.x + g.w * 0.79, y: sillY - 60 * s },
      turntable: { x: g.x + g.w * 0.5, y: sillY + g.frame * 1.2 * 0.32 },
    };
  },

  drawRoom(ctx, env, g, d) {
    const { W, H } = g, s = g.s;
    const light = 0.09 + 0.45 * dayLevel(env);
    const warm: RGB = scaleRGB([90 * env.lamp + 70 * env.fire, 50 * env.lamp + 36 * env.fire, 18 * env.lamp + 10 * env.fire], 0.35);
    // Horizontal logs, each shaded round.
    const logH = Math.max(26, 54 * s);
    const base = mapRGB([118, 80, 52], (v, i) => v * light + warm[i as 0]);
    for (let y = -((g.y - g.frame) % logH); y < H; y += logH) {
      const grd = ctx.createLinearGradient(0, y, 0, y + logH);
      grd.addColorStop(0, rgba(scaleRGB(base, 0.55)));
      grd.addColorStop(0.35, rgba(base));
      grd.addColorStop(0.8, rgba(scaleRGB(base, 0.8)));
      grd.addColorStop(1, rgba(scaleRGB(base, 0.4)));
      ctx.fillStyle = grd;
      ctx.fillRect(0, y, W, logH);
    }
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    let grd = ctx.createRadialGradient(cx, cy, g.w * 0.3, cx, cy, Math.max(W, H) * 0.7);
    const spill = mixRGB(env.sky.bottom, [255, 255, 255], 0.3);
    grd.addColorStop(0, rgba(spill, 0.18 * dayLevel(env)));
    grd.addColorStop(1, rgba(spill, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    if (env.lamp > 0.01) {
      grd = ctx.createRadialGradient(d.lamp.x, d.lamp.y, 0, d.lamp.x, d.lamp.y, Math.max(W, H) * 0.5);
      grd.addColorStop(0, rgba(env.lampColor, 0.32 * env.lamp));
      grd.addColorStop(1, rgba(env.lampColor, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    if (env.fire > 0.01) {
      const t = env.t;
      const flick = 0.7 + 0.15 * Math.sin(t * 6.1) + 0.1 * Math.sin(t * 11.7 + 2) + 0.05 * Math.sin(t * 1.7);
      grd = ctx.createRadialGradient(W, H, 0, W, H, Math.max(W, H) * 0.75);
      grd.addColorStop(0, rgba([255, 120, 50], 0.3 * env.fire * flick));
      grd.addColorStop(1, rgba([255, 120, 50], 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    grd = ctx.createRadialGradient(cx, H / 2, Math.min(W, H) * 0.35, cx, H / 2, Math.max(W, H) * 0.8);
    grd.addColorStop(0, "rgba(8,6,6,0)");
    grd.addColorStop(1, "rgba(8,6,6,0.65)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  },

  drawLandscape(ctx, env, g, d, P) {
    const s = g.s, bottom = g.y + g.h + 20;
    const snowy = Math.max(env.snowCover, env.season === "winter" ? 0.5 : 0);

    // Mountains, snow-capped most of the year.
    const pf = P.par(0.15);
    fillRidge(ctx, d.far, pf, P.shade(mixRGB([92, 104, 128], SNOW, snowy * 0.25), env, 0.85), bottom);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.w, g.h * (0.4 + 0.07 * snowy) + pf.y);
    ctx.clip();
    fillRidge(ctx, d.far, pf, mixRGB(P.shade(SNOW, env, 0.4), env.sky.bottom, 0.25), bottom);
    ctx.restore();

    // Forested slope.
    const pm = P.par(0.3);
    fillRidge(ctx, d.mid, pm, P.shade(mixRGB([44, 62, 52], SNOW, env.snowCover * 0.75), env, 0.55), bottom);
    ctx.fillStyle = rgba(P.shade([30, 46, 40], env, 0.5));
    ctx.beginPath();
    pinePath(ctx, d.midPines, pm, false);
    ctx.fill();

    drawWater(ctx, env, g, d, pf, d.waterY + pm.y, P);

    // Near shore, boathouse and pines.
    const ps = P.par(0.7);
    fillRidge(ctx, d.shore, ps, P.shade(mixRGB([46, 52, 44], SNOW, env.snowCover * 0.85), env, 0.15), bottom);
    const b = d.boathouse, bx = b.x + ps.x, by = b.y + ps.y;
    ctx.fillStyle = rgba(P.shade([150, 48, 38], env, 0.15));
    ctx.fillRect(bx - b.w / 2, by - b.h, b.w, b.h);
    ctx.fillStyle = rgba(P.shade(env.snowCover > 0.2 ? SNOW : [52, 44, 44], env, 0.15));
    ctx.beginPath();
    ctx.moveTo(bx - b.w / 2 - 4 * s, by - b.h);
    ctx.lineTo(bx, by - b.h - b.w * 0.36);
    ctx.lineTo(bx + b.w / 2 + 4 * s, by - b.h);
    ctx.fill();
    const lit = clamp((env.night - 0.2) * 2) * (env.localHour >= 1 && env.localHour < 6 ? 0 : 1);
    ctx.fillStyle = rgba(lit > 0.05 ? mixRGB([40, 36, 40], [255, 196, 120], lit) : P.shade([40, 44, 56], env, 0.15));
    ctx.fillRect(bx - 5 * s, by - b.h * 0.7, 10 * s, 9 * s);
    if (lit > 0.05) {
      // The boathouse window's light on the water.
      const grd = ctx.createRadialGradient(bx, by + 8 * s, 0, bx, by + 8 * s, 30 * s);
      grd.addColorStop(0, rgba([255, 190, 110], 0.35 * lit));
      grd.addColorStop(1, rgba([255, 190, 110], 0));
      ctx.fillStyle = grd;
      ctx.fillRect(bx - 30 * s, by - 22 * s, 60 * s, 60 * s);
    }
    ctx.fillStyle = rgba(P.shade([22, 34, 30], env, 0.1));
    ctx.beginPath();
    pinePath(ctx, d.shorePines, ps, false);
    ctx.fill();
    if (env.snowCover > 0.1) {
      ctx.fillStyle = rgba(P.shade(SNOW, env, 0.1), env.snowCover);
      ctx.beginPath();
      pinePath(ctx, d.shorePines, ps, true);
      ctx.fill();
    }
  },

  drawForeground(ctx, env, g, d, P) {
    if (!g.framed) return;
    const amount = clamp((1 - env.temp) / 6) * clamp(env.snowCover * 2 + (env.season === "winter" ? 0.5 : 0));
    if (amount < 0.05) return;
    ctx.fillStyle = rgba(P.shade([226, 236, 248], env, 0), 0.85);
    ctx.beginPath();
    for (const ic of d.icicles) {
      ctx.moveTo(ic.x - ic.w / 2, ic.y);
      ctx.lineTo(ic.x + ic.w / 2, ic.y);
      ctx.lineTo(ic.x, ic.y + ic.len * amount);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = rgba(P.shade(SNOW, env, 0));
    for (const pn of g.panes.slice(0, 2)) ctx.fillRect(pn.x, pn.y, pn.w, 3 * g.s * amount);
  },

  drawInterior(ctx, env, g, d) {
    const s = g.s, f = g.frame * 1.2, t = env.t, day = dayLevel(env);
    const lampAdd: RGB = scaleRGB([60, 36, 14], env.lamp);
    const lightUp = (c: RGB) => mapRGB(c, (v, i) => v * (0.16 + 0.62 * day) + lampAdd[i as 0]);

    // White-painted frame.
    ctx.fillStyle = rgba(lightUp([200, 194, 182]));
    ctx.beginPath();
    ctx.rect(g.x - f, g.y - f, g.w + 2 * f, g.h + 2 * f);
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.fill("evenodd");
    ctx.fillRect(g.mx - g.mull / 2, g.y, g.mull, g.h);
    ctx.fillRect(g.x, g.my - g.mull / 2, g.w, g.mull);
    ctx.strokeStyle = "rgba(0,0,0,.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x - 1, g.y - 1, g.w + 2, g.h + 2);
    ctx.strokeRect(g.x - f, g.y - f, g.w + 2 * f, g.h + 2 * f);

    // Deep sill.
    const by = d.sillY, sx0 = g.x - f * 1.6, sw = g.w + f * 3.2;
    ctx.fillStyle = rgba(lightUp([212, 206, 194]));
    ctx.fillRect(sx0, by, sw, f * 0.6);
    ctx.fillStyle = rgba(lightUp([160, 154, 142]));
    ctx.fillRect(sx0, by + f * 0.6, sw, f * 0.8);
    const sh = ctx.createLinearGradient(0, by + f * 1.4, 0, by + f * 4);
    sh.addColorStop(0, "rgba(0,0,0,.4)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(sx0, by + f * 1.4, sw, f * 2.6);
    const top = by + f * 0.32;

    // A stack of books.
    let y = top;
    for (const [i, [col, w, h]] of ([[[120, 52, 44], 72, 13], [[52, 72, 92], 64, 11], [[176, 150, 98], 68, 12]] as [RGB, number, number][]).entries()) {
      ctx.fillStyle = rgba(lightUp(col));
      ctx.fillRect(d.books.x - (w * s) / 2 + i * 3 * s, y - h * s, w * s, h * s);
      y -= h * s;
    }

    // Candles, lit in the evening.
    for (const c of d.candles) {
      ctx.fillStyle = rgba(lightUp([70, 60, 54]));
      ctx.beginPath();
      ctx.ellipse(c.x, top - 2 * s, 15 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(mixRGB(lightUp([226, 216, 196]), [255, 236, 200], env.lamp * 0.4));
      ctx.fillRect(c.x - 7 * s, top - 4 * s - c.h, 14 * s, c.h);
      if (env.lamp <= 0.05) continue;
      const fy = top - 4 * s - c.h, fl = 1 + 0.12 * Math.sin(t * 9 + c.p) + 0.06 * Math.sin(t * 23 + c.p);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(c.x, fy - 8 * s, 0, c.x, fy - 8 * s, 60 * s * fl);
      halo.addColorStop(0, rgba([255, 180, 90], 0.32 * env.lamp));
      halo.addColorStop(1, rgba([255, 180, 90], 0));
      ctx.fillStyle = halo;
      ctx.fillRect(c.x - 60 * s, fy - 70 * s, 120 * s, 120 * s);
      ctx.restore();
      ctx.fillStyle = rgba([255, 214, 140], env.lamp);
      ctx.beginPath();
      ctx.moveTo(c.x, fy - 14 * s * fl);
      ctx.quadraticCurveTo(c.x + 4.5 * s, fy - 4 * s, c.x, fy);
      ctx.quadraticCurveTo(c.x - 4.5 * s, fy - 4 * s, c.x, fy - 14 * s * fl);
      ctx.fill();
    }
    if (env.lamp > 0.01) {
      // Candlelight reflected in the dark glass.
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const rx = d.lamp.x - g.w * 0.05, ry = d.sillY - 90 * s;
      const refl = ctx.createRadialGradient(rx, ry, 0, rx, ry, 50 * s);
      refl.addColorStop(0, rgba([255, 190, 120], 0.14 * env.lamp * env.night));
      refl.addColorStop(1, rgba([255, 190, 120], 0));
      ctx.fillStyle = refl;
      ctx.fillRect(rx - 50 * s, ry - 50 * s, 100 * s, 100 * s);
      ctx.restore();
    }
  },
};
