/** "Attic Room": an upstairs window over rooftops, a wooded ridge and far hills, with a branch close to the
 *  glass and a lamp, a plant and a mug on the sill. */
import type { FrameEnv, Geom, Painter, WindowPack } from "../types";
import { clamp, lerp, makeNoise1D, mapRGB, mixRGB, rgba, type RGB, type Rng } from "../util";

type Point = [number, number];
type House = {
  x: number;
  w: number;
  top: number;
  gable: boolean;
  roofH: number;
  wall: RGB;
  roofC: RGB;
  windows: { x: number; y: number; w: number; h: number; thr: number; warm: number }[];
  chimney: {
    x: number;
    w: number;
    top: number;
    puffs: { x: number; y: number; age: number }[];
    acc: number;
  } | null;
};
type Tip = {
  x: number;
  y: number;
  blobs: { dx: number; dy: number; r: number; c: number; keep: number }[];
};
type Seg = { x1: number; y1: number; x2: number; y2: number; w: number };
export type AtticData = {
  far: Point[];
  near: Point[];
  back: House[];
  front: House[];
  posts: number[];
  branch: { root: { x: number; y: number }; segs: Seg[]; tips: Tip[] };
  sillY: number;
  plant: { x: number; leaves: { a: number; len: number; w: number; p: number }[] };
  mug: { x: number };
  lamp: { x: number; y: number };
};

const SNOW: RGB = [236, 240, 248];

function ridge(rng: Rng, g: Geom, base: number, amp: number, trees: boolean): Point[] {
  const n1 = makeNoise1D(rng, 4),
    n2 = makeNoise1D(rng, 3);
  return Array.from({ length: 91 }, (_, i) => {
    const u = i / 90;
    let y = g.y + g.h * base - n1(u * 1.3 + 0.2) * g.h * amp;
    if (trees) y -= (0.5 + 0.5 * n2(u * 14)) * g.h * 0.022;
    return [lerp(g.x - 70, g.x + g.w + 70, u), y];
  });
}

function houseRow(rng: Rng, g: Geom, front: boolean): House[] {
  const s = g.s,
    list: House[] = [],
    baseY = g.y + g.h + 6;
  let x = g.x - 60;
  while (x < g.x + g.w + 60) {
    const w = (front ? 95 + rng() * 90 : 62 + rng() * 60) * s;
    const top = g.y + g.h * (front ? 0.8 + rng() * 0.08 : 0.7 + rng() * 0.06);
    const gable = rng() < (front ? 0.75 : 0.6);
    const roofH = gable ? w * (0.22 + rng() * 0.2) : 4 * s;
    const wall = front
      ? mixRGB([150, 128, 108], [112, 118, 128], rng())
      : mixRGB([128, 120, 116], [100, 108, 122], rng());
    const roofC: RGB = front ? mixRGB([74, 58, 54], [52, 62, 72], rng()) : [72, 72, 82];
    const size = (front ? 13 : 9) * s,
      gapX = size * 2.2,
      gapY = size * 2.4;
    const cols = Math.max(1, Math.floor((w - size) / gapX)),
      rows = Math.max(1, Math.floor((baseY - top - size) / gapY));
    const ox = x + (w - (cols - 1) * gapX - size) / 2;
    const windows: House["windows"] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++)
        windows.push({
          x: ox + c * gapX,
          y: top + size * 0.9 + r * gapY,
          w: size,
          h: size * 1.25,
          thr: rng(),
          warm: rng(),
        });
    }
    let chimney: House["chimney"] = null;
    if (gable && rng() < 0.55) {
      const cx = x + w * (0.22 + rng() * 0.5);
      const roofY = top - roofH * (1 - Math.abs(cx - (x + w / 2)) / (w / 2));
      chimney = { x: cx, w: 8 * s, top: roofY - 12 * s - roofH * 0.25, puffs: [], acc: rng() };
    }
    list.push({ x, w, top, gable, roofH, wall, roofC, windows, chimney });
    x += w + (front ? rng() * 16 : rng() * 8) * s;
  }
  return list;
}

function branch(rng: Rng, g: Geom): AtticData["branch"] {
  const s = g.s,
    segs: Seg[] = [],
    tips: Tip[] = [];
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    const x2 = x + Math.cos(ang) * len,
      y2 = y + Math.sin(ang) * len;
    segs.push({ x1: x, y1: y, x2, y2, w });
    if (depth <= 2)
      tips.push({
        x: x2,
        y: y2,
        blobs: Array.from({ length: 7 }, () => ({
          dx: (rng() - 0.5) * 26 * s,
          dy: (rng() - 0.5) * 20 * s,
          r: (5 + rng() * 6) * s,
          c: rng(),
          keep: rng(),
        })),
      });
    if (depth <= 0) return;
    grow(x2, y2, ang + (rng() - 0.5) * 0.5, len * 0.82, w * 0.72, depth - 1);
    if (rng() < 0.75)
      grow(
        x2,
        y2,
        ang + (rng() < 0.5 ? -1 : 1) * (0.45 + rng() * 0.5),
        len * 0.62,
        w * 0.6,
        depth - 2,
      );
  };
  const root = { x: g.x + g.w + 30 * s, y: g.y + g.h * 0.06 };
  grow(root.x, root.y, Math.PI + 0.32, 120 * s, 10 * s, 6);
  return { root, segs, tips };
}

function fillRidge(
  ctx: CanvasRenderingContext2D,
  g: Geom,
  pts: Point[],
  off: { x: number; y: number },
  col: RGB,
  cap: number,
  snowCol: RGB,
) {
  ctx.fillStyle = rgba(col);
  ctx.beginPath();
  ctx.moveTo(pts[0]![0] + off.x, g.y + g.h + 20);
  for (const [x, y] of pts) ctx.lineTo(x + off.x, y + off.y);
  ctx.lineTo(pts[pts.length - 1]![0] + off.x, g.y + g.h + 20);
  ctx.fill();
  if (cap <= 0.02) return;
  const th = cap * g.h * 0.03;
  ctx.fillStyle = rgba(snowCol);
  ctx.beginPath();
  for (const [x, y] of pts) ctx.lineTo(x + off.x, y + off.y);
  for (let i = pts.length - 1; i >= 0; i--)
    ctx.lineTo(pts[i]![0] + off.x, pts[i]![1] + off.y + th * (0.6 + 0.4 * Math.sin(i * 1.7)));
  ctx.fill();
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  env: FrameEnv,
  g: Geom,
  row: House[],
  p: { x: number; y: number },
  depth: number,
  lit: number,
  P: Painter,
) {
  const s = g.s,
    bottom = g.y + g.h + 10,
    dt = env.dt;
  const snowC = rgba(P.shade(SNOW, env, depth * 0.5));
  const smoky = env.temp < 10 && env.rain < 0.7;
  const dark = mixRGB(P.shade([46, 54, 70], env, depth), env.sky.top, 0.25 * env.dayness);
  for (const h of row) {
    const x = h.x + p.x,
      top = h.top + p.y;
    if (h.chimney) {
      const c = h.chimney,
        cx = c.x + p.x,
        ct = c.top + p.y;
      ctx.fillStyle = rgba(P.shade(mixRGB(h.roofC, h.wall, 0.4), env, depth));
      ctx.fillRect(cx - c.w / 2, ct, c.w, top - ct);
      if (smoky) {
        c.acc += dt * 1.6;
        if (c.acc >= 1) {
          c.acc -= 1;
          c.puffs.push({ x: 0, y: 0, age: 0 });
        }
      }
      ctx.fillStyle = rgba(P.shade([196, 198, 204], env, depth));
      c.puffs = c.puffs.filter((q) => {
        q.age += dt;
        q.y -= 12 * s * dt;
        q.x += (env.wind * 30 + 4) * s * dt;
        if (q.age > 6) return false;
        ctx.globalAlpha = 0.22 * (1 - q.age / 6);
        ctx.beginPath();
        ctx.arc(cx + q.x, ct + q.y, (3 + q.age * 3) * s, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = rgba(P.shade(h.wall, env, depth));
    ctx.fillRect(x, top, h.w, bottom - top);
    ctx.fillStyle = rgba(P.shade(h.roofC, env, depth));
    ctx.beginPath();
    if (h.gable) {
      ctx.moveTo(x - 3 * s, top);
      ctx.lineTo(x + h.w / 2, top - h.roofH);
      ctx.lineTo(x + h.w + 3 * s, top);
    } else ctx.rect(x - 2 * s, top - h.roofH, h.w + 4 * s, h.roofH + 1);
    ctx.fill();
    if (env.snowCover > 0.02) {
      ctx.fillStyle = snowC;
      ctx.strokeStyle = snowC;
      if (h.gable) {
        ctx.lineWidth = env.snowCover * 5 * s;
        ctx.beginPath();
        ctx.moveTo(x - 3 * s, top - 1);
        ctx.lineTo(x + h.w / 2, top - h.roofH - 1);
        ctx.lineTo(x + h.w + 3 * s, top - 1);
        ctx.stroke();
      } else
        ctx.fillRect(
          x - 2 * s,
          top - h.roofH - env.snowCover * 4 * s,
          h.w + 4 * s,
          env.snowCover * 4 * s,
        );
    }
    const dx = x - h.x,
      dy = top - h.top;
    for (const w of h.windows) {
      if (lit > w.thr) {
        const warm = mixRGB([255, 186, 106], [255, 224, 170], w.warm);
        ctx.fillStyle = rgba(warm, 0.18);
        ctx.fillRect(dx + w.x - w.w * 0.4, dy + w.y - w.h * 0.3, w.w * 1.8, w.h * 1.6);
        ctx.fillStyle = rgba(warm, 0.95);
      } else ctx.fillStyle = rgba(dark);
      ctx.fillRect(dx + w.x, dy + w.y, w.w, w.h);
    }
  }
}

export const atticRoom: WindowPack<AtticData> = {
  id: "attic-room",
  name: "Attic Room",
  ambience: { rain: 1, wind: 0.9, city: 0.8, fire: 1, crickets: 1, birds: 1 },

  build(g, rng) {
    const s = g.s,
      sillY = g.y + g.h + g.frame * 0.7;
    return {
      far: ridge(rng, g, 0.52, 0.1, false),
      near: ridge(rng, g, 0.62, 0.06, true),
      back: houseRow(rng, g, false),
      front: houseRow(rng, g, true),
      posts: [0.18, 0.52, 0.86].map((u) => g.x + g.w * u),
      branch: branch(rng, g),
      sillY,
      plant: {
        x: g.x + g.w * 0.13,
        leaves: Array.from({ length: 9 }, (_, i) => ({
          a: -1.15 + (i / 8) * 2.3 + (rng() - 0.5) * 0.2,
          len: (55 + rng() * 45) * s,
          w: (9 + rng() * 5) * s,
          p: rng() * 6,
        })),
      },
      mug: { x: g.x + g.w * 0.3 },
      lamp: { x: g.x + g.w * 0.85, y: sillY - 150 * s },
    };
  },

  drawRoom(ctx, env, g, d) {
    const { W, H } = g;
    const day = Math.min(1, (env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
    const cool = mixRGB(env.sky.bottom, [255, 255, 255], 0.5);
    const light = 0.1 + 0.5 * day;
    ctx.fillStyle = rgba(
      mapRGB([118, 104, 96], (v, i) => v * light * (0.75 + (0.25 * cool[i as 0]) / 255)),
    );
    ctx.fillRect(0, 0, W, H);

    const cx = g.x + g.w / 2,
      cy = g.y + g.h / 2;
    let grd = ctx.createRadialGradient(cx, cy, g.w * 0.3, cx, cy, Math.max(W, H) * 0.75);
    const spill = mixRGB(env.sky.bottom, [255, 255, 255], 0.3);
    grd.addColorStop(0, rgba(spill, 0.22 * day));
    grd.addColorStop(1, rgba(spill, 0));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    if (env.lamp > 0.01) {
      grd = ctx.createRadialGradient(
        d.lamp.x,
        d.lamp.y,
        0,
        d.lamp.x,
        d.lamp.y,
        Math.max(W, H) * 0.65,
      );
      grd.addColorStop(0, rgba([255, 176, 96], 0.42 * env.lamp));
      grd.addColorStop(0.35, rgba([255, 150, 80], 0.13 * env.lamp));
      grd.addColorStop(1, rgba([255, 150, 80], 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    if (env.fire > 0.01) {
      const t = env.t;
      const flick =
        0.7 + 0.15 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 13.1 + 1) + 0.05 * Math.sin(t * 2.1);
      grd = ctx.createRadialGradient(0, H, 0, 0, H, Math.max(W, H) * 0.6);
      grd.addColorStop(0, rgba([255, 120, 50], 0.22 * env.fire * flick));
      grd.addColorStop(1, rgba([255, 120, 50], 0));
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
    }
    grd = ctx.createRadialGradient(
      cx,
      H / 2,
      Math.min(W, H) * 0.35,
      cx,
      H / 2,
      Math.max(W, H) * 0.8,
    );
    grd.addColorStop(0, "rgba(8,8,12,0)");
    grd.addColorStop(1, "rgba(8,8,12,0.6)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  },

  drawLandscape(ctx, env, g, d, P) {
    const s = g.s,
      snowCol = P.shade(SNOW, env, 0.3);
    const wintry = env.season === "winter" && env.temp < 8 ? 0.6 : 0;
    fillRidge(
      ctx,
      g,
      d.far,
      P.par(0.15),
      P.shade([96, 110, 138], env, 0.85),
      Math.max(env.snowCover, wintry),
      snowCol,
    );
    const nearBase = (
      {
        spring: [70, 96, 62],
        summer: [50, 78, 56],
        autumn: [112, 80, 52],
        winter: [66, 70, 76],
      } as const satisfies Record<string, RGB>
    )[env.season];
    fillRidge(
      ctx,
      g,
      d.near,
      P.par(0.3),
      P.shade([...nearBase], env, 0.55),
      env.snowCover * 0.8,
      snowCol,
    );

    const late = env.localHour >= 0.5 && env.localHour < 5.5;
    const lit = clamp((env.night - 0.25) * 1.6 + env.rain * 0.15) * (late ? 0.3 : 1);
    drawRow(ctx, env, g, d.back, P.par(0.45), 0.35, lit, P);

    // Street lamps between the rows.
    const pp = P.par(0.6),
      glow = clamp((env.night - 0.3) * 2);
    for (const px of d.posts) {
      const x = px + pp.x,
        top = g.y + g.h * 0.83 + pp.y;
      ctx.strokeStyle = rgba(P.shade([40, 40, 46], env, 0.2));
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(x, g.y + g.h + 10);
      ctx.lineTo(x, top);
      ctx.stroke();
      if (glow > 0.01) {
        const grd = ctx.createRadialGradient(x, top, 0, x, top, 46 * s);
        grd.addColorStop(0, rgba([255, 206, 140], 0.8 * glow));
        grd.addColorStop(0.15, rgba([255, 190, 120], 0.35 * glow));
        grd.addColorStop(1, rgba([255, 190, 120], 0));
        ctx.fillStyle = grd;
        ctx.fillRect(x - 46 * s, top - 46 * s, 92 * s, 92 * s);
      }
    }
    drawRow(ctx, env, g, d.front, P.par(0.7), 0.12, lit, P);
  },

  drawForeground(ctx, env, g, d, P) {
    const b = d.branch,
      p = P.par(1.1),
      t = env.t;
    const sway =
      (Math.sin(t * 0.8) * 0.6 + Math.sin(t * 1.9 + 1) * 0.3) * (0.006 + env.wind * 0.03) -
      env.wind * 0.02;
    ctx.save();
    ctx.translate(b.root.x + p.x, b.root.y + p.y);
    ctx.rotate(sway);
    ctx.translate(-b.root.x, -b.root.y);
    ctx.strokeStyle = rgba(mixRGB(P.shade([46, 38, 34], env, 0), [120, 80, 50], env.lamp * 0.12));
    ctx.lineCap = "round";
    for (const sg of b.segs) {
      ctx.lineWidth = sg.w;
      ctx.beginPath();
      ctx.moveTo(sg.x1, sg.y1);
      ctx.lineTo(sg.x2, sg.y2);
      ctx.stroke();
    }
    if (env.snowCover > 0.05) {
      ctx.strokeStyle = rgba(P.shade(SNOW, env, 0));
      for (const sg of b.segs) {
        ctx.lineWidth = sg.w * 0.5 * env.snowCover;
        ctx.beginPath();
        ctx.moveTo(sg.x1, sg.y1 - sg.w * 0.45);
        ctx.lineTo(sg.x2, sg.y2 - sg.w * 0.45);
        ctx.stroke();
      }
    }
    const palette: { keep: number; a: RGB; b: RGB } = {
      spring: { keep: 0.75, a: [246, 200, 214] as RGB, b: [252, 236, 240] as RGB },
      summer: { keep: 1, a: [62, 102, 58] as RGB, b: [92, 132, 70] as RGB },
      autumn: { keep: 0.55, a: [196, 96, 44] as RGB, b: [226, 156, 62] as RGB },
      winter: { keep: 0, a: [0, 0, 0] as RGB, b: [0, 0, 0] as RGB },
    }[env.season];
    if (palette.keep > 0) {
      for (const tip of b.tips) {
        for (const bl of tip.blobs) {
          if (bl.keep > palette.keep) continue;
          ctx.fillStyle = rgba(
            mapRGB(P.shade(mixRGB(palette.a, palette.b, bl.c), env, 0), (v) => v * 0.88),
          );
          ctx.beginPath();
          ctx.arc(tip.x + bl.dx, tip.y + bl.dy, bl.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  },

  drawInterior(ctx, env, g, d) {
    const s = g.s,
      f = g.frame,
      t = env.t;
    const day = Math.min(1, (env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
    const lampAdd: RGB = [70 * env.lamp, 40 * env.lamp, 16 * env.lamp];
    const lightUp = (c: RGB) => mapRGB(c, (v, i) => v * (0.16 + 0.62 * day) + lampAdd[i as 0]);
    const wood = lightUp([86, 62, 46]);

    // Frame and glazing bars.
    ctx.fillStyle = rgba(wood);
    ctx.beginPath();
    ctx.rect(g.x - f, g.y - f, g.w + 2 * f, g.h + 2 * f);
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.fill("evenodd");
    ctx.fillRect(g.mx - g.mull / 2, g.y, g.mull, g.h);
    ctx.fillRect(g.x, g.my - g.mull / 2, g.w, g.mull);
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x - 1, g.y - 1, g.w + 2, g.h + 2);
    ctx.strokeStyle = rgba([255, 240, 220], 0.06 + 0.06 * day);
    ctx.lineWidth = 1;
    ctx.strokeRect(g.x - f + 0.5, g.y - f + 0.5, g.w + 2 * f - 1, g.h + 2 * f - 1);

    // Sill.
    const by = d.sillY,
      sx0 = g.x - f * 1.8,
      sw = g.w + f * 3.6;
    ctx.fillStyle = rgba(lightUp([104, 78, 58]));
    ctx.fillRect(sx0, by, sw, f * 0.55);
    ctx.fillStyle = rgba(lightUp([66, 48, 36]));
    ctx.fillRect(sx0, by + f * 0.55, sw, f * 0.9);
    const sh = ctx.createLinearGradient(0, by + f * 1.45, 0, by + f * 4);
    sh.addColorStop(0, "rgba(0,0,0,.4)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(sx0, by + f * 1.45, sw, f * 2.6);
    const top = by + f * 0.3;

    // Plant.
    const pl = d.plant;
    ctx.fillStyle = rgba(lightUp([60, 94, 64]));
    for (const lf of pl.leaves) {
      const a = lf.a + Math.sin(t * 0.4 + lf.p) * 0.02;
      const bx = pl.x,
        byy = top - 50 * s;
      const tx = bx + Math.sin(a) * lf.len,
        ty = byy - Math.cos(a) * lf.len;
      const nx = Math.cos(a) * lf.w,
        ny = Math.sin(a) * lf.w;
      ctx.beginPath();
      ctx.moveTo(bx, byy);
      ctx.quadraticCurveTo((bx + tx) / 2 + nx, (byy + ty) / 2 + ny, tx, ty);
      ctx.quadraticCurveTo((bx + tx) / 2 - nx, (byy + ty) / 2 - ny, bx, byy);
      ctx.fill();
    }
    ctx.fillStyle = rgba(lightUp([138, 86, 64]));
    ctx.beginPath();
    ctx.moveTo(pl.x - 32 * s, top - 54 * s);
    ctx.lineTo(pl.x + 32 * s, top - 54 * s);
    ctx.lineTo(pl.x + 24 * s, top);
    ctx.lineTo(pl.x - 24 * s, top);
    ctx.fill();
    ctx.fillStyle = rgba(lightUp([118, 72, 54]));
    ctx.fillRect(pl.x - 34 * s, top - 58 * s, 68 * s, 9 * s);

    // Mug, steaming on cold days.
    const mx = d.mug.x;
    ctx.strokeStyle = rgba(lightUp([206, 198, 186]));
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.arc(mx + 17 * s, top - 18 * s, 8 * s, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = rgba(lightUp([212, 204, 192]));
    ctx.fillRect(mx - 16 * s, top - 34 * s, 32 * s, 34 * s);
    ctx.fillStyle = rgba(lightUp([70, 44, 30]));
    ctx.fillRect(mx - 14 * s, top - 33 * s, 28 * s, 3 * s);
    if (env.temp < 14) {
      ctx.lineWidth = 2.5 * s;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.25 + i / 3) % 1;
        ctx.strokeStyle = rgba(
          [255, 255, 255],
          0.13 * Math.sin(ph * Math.PI) * (0.4 + 0.6 * Math.max(day, env.lamp)),
        );
        const sx = mx - 6 * s + i * 6 * s,
          sy = top - 38 * s - ph * 30 * s;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(
          sx + 8 * s * Math.sin(t + i),
          sy - 12 * s,
          sx - 8 * s * Math.sin(t * 1.3 + i),
          sy - 22 * s,
          sx + 3 * s,
          sy - 34 * s,
        );
        ctx.stroke();
      }
    }

    // Lamp.
    const L = d.lamp,
      shadeB = L.y + 26 * s,
      shadeT = L.y - 34 * s;
    if (env.lamp > 0.01) {
      const pool = ctx.createRadialGradient(L.x, top, 0, L.x, top, 130 * s);
      pool.addColorStop(0, rgba([255, 196, 120], 0.35 * env.lamp));
      pool.addColorStop(1, rgba([255, 196, 120], 0));
      ctx.fillStyle = pool;
      ctx.fillRect(L.x - 130 * s, top - 130 * s, 260 * s, 140 * s);
    }
    ctx.fillStyle = rgba(lightUp([58, 52, 50]));
    ctx.beginPath();
    ctx.ellipse(L.x, top - 4 * s, 26 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(L.x - 2.5 * s, shadeB, 5 * s, top - shadeB - 4 * s);
    ctx.fillStyle = rgba(mixRGB(lightUp([170, 150, 124]), [255, 214, 150], env.lamp * 0.9));
    ctx.beginPath();
    ctx.moveTo(L.x - 28 * s, shadeT);
    ctx.lineTo(L.x + 28 * s, shadeT);
    ctx.lineTo(L.x + 48 * s, shadeB);
    ctx.lineTo(L.x - 48 * s, shadeB);
    ctx.fill();
    if (env.lamp > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 140 * s);
      halo.addColorStop(0, rgba([255, 190, 110], 0.28 * env.lamp));
      halo.addColorStop(1, rgba([255, 190, 110], 0));
      ctx.fillStyle = halo;
      ctx.fillRect(L.x - 140 * s, L.y - 140 * s, 280 * s, 280 * s);
      // The lamp's reflection in the dark glass.
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      const rx = L.x - g.w * 0.06,
        ry = L.y - 20 * s;
      const refl = ctx.createRadialGradient(rx, ry, 0, rx, ry, 70 * s);
      refl.addColorStop(0, rgba([255, 196, 130], 0.16 * env.lamp * env.night));
      refl.addColorStop(1, rgba([255, 196, 130], 0));
      ctx.fillStyle = refl;
      ctx.fillRect(rx - 70 * s, ry - 70 * s, 140 * s, 140 * s);
      ctx.restore();
    }
  },
};
