/** "Lofi study": a desk under a big window at dusk-pink walls, with deep red curtains, fairy lights, a shelf of
 *  books, a sleeping cat, a mug and an angled desk lamp. Any view can sit outside it. */
import type { Geom, RoomPack } from "../types";
import { clamp, mixRGB, rgba, scaleRGB, type RGB } from "../util";
import { books, cat, glow, leavesFor, lighter, mug, plant, shelfBooks, stringLightPoints, stringLights, type Book, type Bulb } from "./props";

type Curtain = { outer: number; inner: number; tie: number; folds: number[] };
type Frame = { x: number; y: number; w: number; h: number; c: RGB };
export type LofiData = {
  deskY: number;
  rodY: number;
  curtains: [Curtain, Curtain];
  bulbs: Bulb[];
  shelf: { x0: number; x1: number; rows: { y: number; books: Book[] }[] } | null;
  frames: Frame[];
  leaves: ReturnType<typeof leavesFor>;
  hanging: { x: number; y: number; leaves: { a: number; len: number; p: number }[] } | null;
  notebook: { x: number };
  mug: { x: number };
  cat: { x: number };
  lamp: { x: number; y: number; base: number; elbow: { x: number; y: number } };
  turntable: { x: number; y: number };
};

const WALL: RGB = [122, 76, 96];
const CURTAIN: RGB = [128, 34, 40];
const WOOD: RGB = [74, 46, 34];

function curtain(g: Geom, side: -1 | 1, folds: number[]): Curtain {
  const f = g.frame, cw = g.w * 0.17;
  const edge = side < 0 ? g.x - f : g.x + g.w + f;
  return { outer: edge + side * cw * 0.85, inner: edge - side * cw * 0.3, tie: g.y + g.h * 0.6, folds };
}

export const lofiStudy: RoomPack<LofiData> = {
  id: "lofi",
  name: "Lofi study",
  ambience: { rain: 1, wind: 0.8, city: 0.9, fire: 0.5, crickets: 0.9, birds: 1 },

  build(g, rng) {
    const s = g.s, f = g.frame;
    const deskY = g.y + g.h + f * 1.7;
    const rodY = g.y - f * 2.6;
    const folds = () => Array.from({ length: 7 }, () => 0.7 + rng() * 0.6);
    const left = curtain(g, -1, folds()), right = curtain(g, 1, folds());
    // A bookshelf on the left wall when there's room beside the curtain.
    const sx1 = left.outer - 30 * s, sx0 = Math.max(g.W * 0.03, sx1 - 300 * s);
    const shelf = sx1 - sx0 > 130 * s
      ? { x0: sx0, x1: sx1, rows: [0.34, 0.62, 0.9].map((u) => ({ y: g.y + g.h * u, books: shelfBooks(rng, sx0, sx1, s) })) }
      : null;
    // Pictures and a hanging plant on the right wall.
    const rx0 = right.outer + 90 * s, room = g.W - rx0 - g.W * 0.03;
    const frames: Frame[] = [];
    if (room > 110 * s) {
      const pal: RGB[] = [[214, 170, 120], [96, 128, 140], [196, 120, 110], [150, 160, 120]];
      frames.push({ x: rx0, y: g.y + g.h * 0.08, w: Math.min(room, 120 * s), h: 150 * s, c: pal[(rng() * 4) | 0]! });
      if (room > 230 * s) frames.push({ x: rx0 + 140 * s, y: g.y + g.h * 0.16, w: 90 * s, h: 90 * s, c: pal[(rng() * 4) | 0]! });
      frames.push({ x: rx0 + 10 * s, y: g.y + g.h * 0.08 + 175 * s, w: 80 * s, h: 100 * s, c: pal[(rng() * 4) | 0]! });
    }
    const hx = right.outer + 20 * s;
    const hanging = hx < g.W - 40 * s
      ? { x: hx, y: g.y + g.h * 0.02, leaves: Array.from({ length: 9 }, (_, i) => ({ a: -0.9 + (i / 8) * 1.8, len: 70 + rng() * 110, p: rng() * 6 })) }
      : null;
    const base = g.x + g.w * 0.92;
    return {
      deskY,
      rodY,
      curtains: [left, right],
      bulbs: stringLightPoints(rng, g.x - f * 2, g.x + g.w + f * 2, rodY + 14 * s, 38 * s, 2, 12),
      shelf,
      frames,
      leaves: leavesFor(rng, 10),
      hanging,
      notebook: { x: g.x + g.w * 0.2 },
      mug: { x: g.x + g.w * 0.6 },
      cat: { x: g.x + g.w * 0.75 },
      lamp: { x: base - 74 * s, y: deskY - 176 * s, base, elbow: { x: base + 22 * s, y: deskY - 112 * s } },
      turntable: { x: g.x + g.w * 0.42, y: deskY },
    };
  },

  drawRoom(ctx, env, g, d) {
    const { W, H } = g, s = g.s;
    const lit = lighter(env, 1.1);
    ctx.fillStyle = rgba(lit(WALL));
    ctx.fillRect(0, 0, W, H);
    // Faint wallpaper stripes.
    ctx.fillStyle = rgba(lit(scaleRGB(WALL, 1.12)), 0.35);
    for (let x = 0; x < W; x += 44 * s) ctx.fillRect(x, 0, 14 * s, H);
    // Daylight spilling in, and the desk lamp's warm glow.
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    glow(ctx, cx, cy, Math.max(W, H) * 0.7, mixRGB(env.sky.bottom, [255, 255, 255], 0.3), 0.2 * Math.min(1, env.dayness));
    glow(ctx, d.lamp.x, d.lamp.y + 60 * s, Math.max(W, H) * 0.7, env.lampColor, 0.36 * env.lamp);
    glow(ctx, cx, d.rodY, g.w * 0.9, [255, 190, 120], 0.12 * Math.max(env.lamp, env.night * 0.6));

    // Bookshelf.
    if (d.shelf) {
      const sh = d.shelf;
      for (const row of sh.rows) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(sh.x0, row.y - 84 * s, sh.x1 - sh.x0, 84 * s);
        books(ctx, row.books, row.y, s, lit);
        ctx.fillStyle = rgba(lit(WOOD));
        ctx.fillRect(sh.x0 - 6 * s, row.y, sh.x1 - sh.x0 + 12 * s, 10 * s);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(sh.x0 - 6 * s, row.y + 10 * s, sh.x1 - sh.x0 + 12 * s, 6 * s);
      }
    }
    // Pictures.
    for (const fr of d.frames) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(fr.x + 4 * s, fr.y + 5 * s, fr.w, fr.h);
      ctx.fillStyle = rgba(lit([46, 32, 28]));
      ctx.fillRect(fr.x, fr.y, fr.w, fr.h);
      ctx.fillStyle = rgba(lit([228, 216, 196]));
      ctx.fillRect(fr.x + 6 * s, fr.y + 6 * s, fr.w - 12 * s, fr.h - 12 * s);
      ctx.fillStyle = rgba(lit(fr.c));
      ctx.beginPath();
      ctx.arc(fr.x + fr.w / 2, fr.y + fr.h * 0.55, Math.min(fr.w, fr.h) * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(lit(scaleRGB(fr.c, 0.6)));
      ctx.fillRect(fr.x + 12 * s, fr.y + fr.h * 0.7, fr.w - 24 * s, fr.h * 0.18);
    }
    // Vignette.
    const v = ctx.createRadialGradient(cx, H / 2, Math.min(W, H) * 0.35, cx, H / 2, Math.max(W, H) * 0.8);
    v.addColorStop(0, "rgba(10,6,10,0)");
    v.addColorStop(1, "rgba(10,6,10,0.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  },

  drawInterior(ctx, env, g, d) {
    const { W, H } = g, s = g.s, f = g.frame, t = env.t;
    const lit = lighter(env, 1.2);

    // Lamp and fairy-light reflections in the dark glass.
    if (env.night > 0.2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, d.lamp.x - g.w * 0.05, d.lamp.y - 30 * s, 80 * s, env.lampColor, 0.14 * env.lamp * env.night);
      for (const b of d.bulbs) if (b.y > g.y) glow(ctx, b.x, b.y + 40 * s, 10 * s, [255, 200, 130], 0.06 * env.night);
      ctx.restore();
    }

    // Frame.
    ctx.fillStyle = rgba(lit([58, 38, 30]));
    ctx.beginPath();
    ctx.rect(g.x - f, g.y - f, g.w + 2 * f, g.h + 2 * f);
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.fill("evenodd");
    ctx.fillRect(g.mx - g.mull / 2, g.y, g.mull, g.h);
    ctx.fillRect(g.x, g.my - g.mull / 2, g.w, g.mull);
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(g.x - 1, g.y - 1, g.w + 2, g.h + 2);

    // Curtains on a rod, tied back.
    for (const c of d.curtains) {
      const side = c.outer < c.inner ? -1 : 1;
      const bottom = d.deskY + 6 * s, sway = Math.sin(t * 0.5) * 2 * s * env.wind;
      const pinch = c.outer - side * (Math.abs(c.inner - c.outer) * 0.32);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.outer, d.rodY);
      ctx.lineTo(c.inner, d.rodY);
      ctx.quadraticCurveTo(c.inner + sway, (d.rodY + c.tie) / 2, pinch, c.tie);
      ctx.quadraticCurveTo(c.inner - side * 6 * s, (c.tie + bottom) / 2, c.inner - side * 4 * s, bottom);
      ctx.lineTo(c.outer + side * 8 * s, bottom);
      ctx.quadraticCurveTo(c.outer - side * 4 * s, (d.rodY + bottom) / 2, c.outer, d.rodY);
      ctx.closePath();
      ctx.clip();
      const x0 = Math.min(c.outer, c.inner) - 10 * s, x1 = Math.max(c.outer, c.inner) + 10 * s;
      const gr = ctx.createLinearGradient(x0, 0, x1, 0);
      const n = c.folds.length;
      c.folds.forEach((k, i) => {
        gr.addColorStop(i / n, rgba(lit(scaleRGB(CURTAIN, 0.62 * k))));
        gr.addColorStop((i + 0.5) / n, rgba(lit(scaleRGB(CURTAIN, 1.05 * k))));
      });
      gr.addColorStop(1, rgba(lit(scaleRGB(CURTAIN, 0.6))));
      ctx.fillStyle = gr;
      ctx.fillRect(x0, d.rodY, x1 - x0, bottom - d.rodY);
      glow(ctx, (c.outer + c.inner) / 2, d.rodY + 30 * s, 160 * s, [255, 190, 120], 0.12 * Math.max(env.lamp, env.night * 0.5));
      ctx.restore();
      // Tie-back.
      ctx.fillStyle = rgba(lit([200, 160, 96]));
      ctx.beginPath();
      ctx.ellipse((pinch + c.outer) / 2, c.tie, Math.abs(pinch - c.outer) / 2 + 5 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const [L, R] = d.curtains;
    ctx.fillStyle = rgba(lit([40, 28, 22]));
    ctx.fillRect(L.outer - 18 * s, d.rodY - 5 * s, R.outer - L.outer + 36 * s, 7 * s);
    for (const x of [L.outer - 18 * s, R.outer + 18 * s]) {
      ctx.beginPath();
      ctx.arc(x, d.rodY - 1.5 * s, 8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    stringLights(ctx, env, d.bulbs, s);

    // Hanging plant in a macramé sling.
    if (d.hanging) {
      const hp = d.hanging, py = hp.y + 120 * s;
      ctx.strokeStyle = rgba(lit([196, 176, 140]));
      ctx.lineWidth = 1.5 * s;
      for (const dx of [-22, 0, 22]) {
        ctx.beginPath();
        ctx.moveTo(hp.x, 0);
        ctx.lineTo(hp.x + dx * s, py);
        ctx.stroke();
      }
      for (const lf of hp.leaves) {
        const a = lf.a + Math.sin(t * 0.35 + lf.p) * 0.03;
        ctx.strokeStyle = rgba(lit(mixRGB([48, 86, 52], [92, 130, 72], (lf.p / 6) % 1)));
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(hp.x, py);
        ctx.quadraticCurveTo(hp.x + Math.sin(a) * 50 * s, py + 10 * s, hp.x + Math.sin(a) * 40 * s, py + lf.len * s);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        for (let k = 0.3; k < 1; k += 0.2) {
          ctx.beginPath();
          ctx.ellipse(hp.x + Math.sin(a) * (44 - 6 * k) * s, py + lf.len * s * k, 6 * s, 4 * s, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = rgba(lit([170, 110, 82]));
      ctx.beginPath();
      ctx.ellipse(hp.x, py, 28 * s, 22 * s, 0, 0, Math.PI);
      ctx.fill();
    }

    // The desk, wall to wall.
    const top = d.deskY;
    ctx.fillStyle = rgba(lit([112, 74, 52]));
    ctx.fillRect(0, top, W, 12 * s);
    ctx.fillStyle = rgba(lit([78, 50, 36]));
    ctx.fillRect(0, top + 12 * s, W, H - top);
    const sh = ctx.createLinearGradient(0, top + 12 * s, 0, top + 70 * s);
    sh.addColorStop(0, "rgba(0,0,0,.35)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, top + 12 * s, W, 58 * s);
    // Lamp light pooled on the desk.
    const pool = d.lamp.x - 30 * s;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.rect(0, top - 2 * s, W, 16 * s);
    ctx.clip();
    glow(ctx, pool, top, 300 * s, env.lampColor, 0.4 * env.lamp);
    ctx.restore();

    plant(ctx, env, g.x + g.w * 0.04, top, s, lit, d.leaves, [186, 120, 88]);

    // An open notebook and a pencil.
    const nx = d.notebook.x;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(nx - 66 * s, top - 2 * s, 136 * s, 4 * s);
    for (const side of [-1, 1]) {
      ctx.fillStyle = rgba(lit(side < 0 ? [236, 228, 212] : [244, 236, 222]));
      ctx.beginPath();
      ctx.moveTo(nx, top - 4 * s);
      ctx.lineTo(nx + side * 66 * s, top - 2 * s);
      ctx.lineTo(nx + side * 60 * s, top - 12 * s);
      ctx.quadraticCurveTo(nx + side * 30 * s, top - 16 * s, nx, top - 10 * s);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(lit([60, 80, 120]), 0.5);
    ctx.lineWidth = 1 * s;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(nx + 10 * s, top - (6 + i * 2.5) * s);
      ctx.lineTo(nx + 50 * s, top - (5 + i * 2.5) * s);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(lit([214, 168, 60]));
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(nx - 50 * s, top - 4 * s);
    ctx.lineTo(nx - 10 * s, top - 9 * s);
    ctx.stroke();
    // A small stack of books beside it.
    let by = top;
    for (const [w, c] of [[86, [58, 92, 104]], [78, [150, 58, 50]], [70, [222, 210, 186]]] as [number, RGB][]) {
      ctx.fillStyle = rgba(lit(c));
      ctx.fillRect(nx - 160 * s - (w * s) / 2, by - 14 * s, w * s, 14 * s);
      by -= 14 * s;
    }

    mug(ctx, env, d.mug.x, top, s, lit, [236, 196, 178]);
    cat(ctx, env, d.cat.x, top, s, lit);

    // Angled desk lamp.
    const lp = d.lamp, metal = lit([44, 54, 58]);
    ctx.strokeStyle = rgba(metal);
    ctx.lineWidth = 6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lp.base, top - 10 * s);
    ctx.lineTo(lp.elbow.x, lp.elbow.y);
    ctx.lineTo(lp.x + 22 * s, lp.y - 8 * s);
    ctx.stroke();
    ctx.fillStyle = rgba(metal);
    ctx.beginPath();
    ctx.ellipse(lp.base, top - 5 * s, 34 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lp.elbow.x, lp.elbow.y, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(lp.x, lp.y);
    ctx.rotate(0.5);
    ctx.fillStyle = rgba(lit([60, 74, 72]));
    ctx.beginPath();
    ctx.moveTo(-12 * s, -24 * s);
    ctx.lineTo(16 * s, -24 * s);
    ctx.lineTo(38 * s, 18 * s);
    ctx.lineTo(-34 * s, 18 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(mixRGB(lit([200, 190, 170]), [255, 232, 190], clamp(env.lamp * 1.2)));
    ctx.beginPath();
    ctx.ellipse(2 * s, 18 * s, 36 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (env.lamp > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, lp.x - 8 * s, lp.y + 22 * s, 120 * s, env.lampColor, 0.3 * env.lamp);
      ctx.restore();
    }
  },
};
