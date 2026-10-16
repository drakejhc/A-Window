/** "Cozy bedroom (painted)": a bedroom at night seen from the bed. A deep duvet and pillows fill the foreground; a
 *  wide window with fairy lights and candles on its ledge looks out on a snowy valley; a fire burns in a fireplace
 *  on the right wall. Painted in one-point perspective, so the ceiling, floor and side walls recede to the window. */
import type { FrameEnv, Geom } from "../types";
import { rgba, type RGB } from "../util";
import { rect, trace, wobble, type Pt } from "./paint";
import { paintedRoom, type Mark, type Palette } from "./painted-room";
import { glow } from "./props";

const NIGHT: Palette = {
  backWall: [58, 46, 64], sideWall: [50, 40, 56], leftWall: [40, 32, 48], ceiling: [36, 28, 34], ceilingLine: [26, 20, 26],
  floor: [44, 32, 34], floorLine: [30, 22, 26], rug: [96, 92, 108], reveal: [44, 40, 62], frame: [30, 24, 30], sill: [70, 58, 70],
  sillFront: [46, 36, 46], duvet: [118, 122, 150], duvetFold: [78, 80, 106], duvetHi: [150, 156, 184], pillow: [134, 136, 160],
  pillow2: [110, 106, 134], bedFrame: [40, 30, 32], stone: [96, 92, 104], stoneDark: [62, 58, 70], firebox: [16, 12, 14],
  mantel: [60, 44, 42], wax: [150, 146, 160], b1: [92, 64, 72], b2: [70, 80, 104], blanket: [110, 70, 72], plant: [24, 36, 40],
  wire: [20, 16, 18], logs: [40, 28, 26],
};
const DAY: Palette = {
  backWall: [150, 132, 128], sideWall: [134, 118, 116], leftWall: [118, 104, 106], ceiling: [112, 92, 84], ceilingLine: [84, 68, 62],
  floor: [124, 96, 82], floorLine: [96, 72, 62], rug: [214, 206, 196], reveal: [168, 156, 160], frame: [92, 74, 68], sill: [190, 174, 166],
  sillFront: [140, 124, 118], duvet: [226, 224, 228], duvetFold: [176, 176, 192], duvetHi: [244, 242, 240], pillow: [236, 232, 228],
  pillow2: [208, 200, 204], bedFrame: [110, 84, 72], stone: [200, 192, 184], stoneDark: [150, 142, 140], firebox: [40, 30, 30],
  mantel: [140, 104, 86], wax: [236, 230, 220], b1: [176, 112, 110], b2: [120, 140, 170], blanket: [190, 110, 100], plant: [70, 96, 90],
  wire: [60, 50, 50], logs: [90, 66, 56],
};
/** Everything as firelight and candlelight show it. */
const WARM: Palette = {
  backWall: [176, 104, 78], sideWall: [200, 114, 76], leftWall: [140, 82, 66], ceiling: [130, 78, 56], ceilingLine: [90, 52, 40],
  floor: [172, 98, 64], floorLine: [110, 60, 40], rug: [246, 196, 150], reveal: [190, 120, 90], frame: [110, 62, 44], sill: [236, 160, 110],
  sillFront: [170, 100, 70], duvet: [246, 206, 170], duvetFold: [196, 140, 110], duvetHi: [255, 228, 192], pillow: [250, 214, 180],
  pillow2: [226, 170, 140], bedFrame: [140, 80, 54], stone: [240, 186, 140], stoneDark: [180, 120, 90], firebox: [70, 30, 16],
  mantel: [190, 110, 70], wax: [255, 226, 180], b1: [230, 140, 100], b2: [180, 140, 130], blanket: [240, 140, 100], plant: [110, 80, 50],
  wire: [80, 50, 36], logs: [120, 60, 36],
};

type Layout = {
  vp: Pt;
  /** Back-wall corners: left, right, ceiling line, floor line. */
  L: number;
  R: number;
  T: number;
  B: number;
  /** A point on the right wall: `u` from the back corner (0) toward us, `v` from floor (0) to ceiling (1). */
  side: (u: number, v: number) => Pt;
  ledge: number;
  fire: { quad: Pt[]; base: Pt; w: number; h: number };
  candles: { x: number; y: number; h: number }[];
  bulbs: Pt[];
};

export const paintedBedroom = paintedRoom<Layout>({
  id: "painted-bedroom",
  name: "Cozy bedroom (painted)",
  ambience: { rain: 1, wind: 0.9, city: 0.2, fire: 1, crickets: 0.4, birds: 0.6 },
  palettes: { night: NIGHT, day: DAY, lamp: WARM },

  layout(g) {
    const f = g.frame, s = g.s;
    const vp: Pt = [g.x + g.w * 0.5, g.y + g.h * 0.6];
    const L = g.x - g.w * 0.16, R = g.x + g.w + g.w * 0.04, T = g.y - g.h * 0.1, B = g.y + g.h + g.h * 0.07;
    const side = (u: number, v: number): Pt => {
      const k = 1 + u * 2, bx = R, by = B + (T - B) * v;
      return [vp[0] + (bx - vp[0]) * k, vp[1] + (by - vp[1]) * k];
    };
    // The fireplace: its opening on the right wall, between depths u0 and u1.
    const u0 = 0.1, u1 = 0.28;
    const quad: Pt[] = [side(u0, 0), side(u0, 0.3), side(u1, 0.3), side(u1, 0)];
    const base = side((u0 + u1) / 2, 0.02);
    const ledge = g.y + g.h + f;
    const candles = [
      { x: g.x + g.w * 0.16, y: ledge, h: 34 * s },
      { x: g.x + g.w * 0.19, y: ledge, h: 22 * s },
      { x: g.x + g.w * 0.135, y: ledge, h: 16 * s },
      { x: g.x + g.w * 0.8, y: ledge, h: 26 * s },
      { x: g.x + g.w * 0.83, y: ledge, h: 16 * s },
    ];
    const bulbs: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      bulbs.push([g.x - f + u * (g.w + 2 * f), g.y - f * 0.4 + Math.abs(Math.sin(u * Math.PI * 3)) * g.h * 0.045]);
    }
    for (let i = 1; i <= 12; i++) bulbs.push([g.x + g.w + f * 1.6 + Math.sin(i * 1.3) * 3 * s, g.y + (g.h * i) / 13]);
    return { vp, L, R, T, B, side, ledge, fire: { quad, base, w: Math.abs(quad[3]![0] - quad[0]![0]), h: Math.abs(quad[1]![1] - quad[0]![1]) }, candles, bulbs };
  },

  back(g, rng, l) {
    const { W, H, s } = g, f = g.frame, m: Mark[] = [];
    const ext = (p: Pt, k = 5): Pt => [l.vp[0] + (p[0] - l.vp[0]) * k, l.vp[1] + (p[1] - l.vp[1]) * k];
    const wb = (pts: Pt[], amp = 2) => wobble(pts, rng, amp * s, 18 * s);
    // The box of the room: back wall, ceiling, floor and the two side walls.
    m.push({ kind: "fill", pts: rect(-10, -10, W + 20, H + 20), key: "leftWall", angle: Math.PI / 2, density: 300 });
    m.push({ kind: "fill", pts: wb([[l.L, l.T], [l.R, l.T], [l.R, l.B], [l.L, l.B]]), key: "backWall", angle: Math.PI / 2, density: 260, spread: 0.16 });
    m.push({ kind: "fill", pts: [[l.L, l.T], [l.R, l.T], ext([l.R, l.T]), ext([l.L, l.T])], key: "ceiling", angle: 0, density: 220 });
    m.push({ kind: "fill", pts: [[l.R, l.T], ext([l.R, l.T]), ext([l.R, l.B]), [l.R, l.B]], key: "sideWall", angle: Math.PI / 2, density: 240 });
    m.push({ kind: "fill", pts: [[l.L, l.B], [l.R, l.B], ext([l.R, l.B]), ext([l.L, l.B])], key: "floor", angle: 0, density: 220 });
    // Ceiling boards and floorboards running toward the window.
    for (let i = 0; i <= 10; i++) {
      const x = l.L + ((l.R - l.L) * i) / 10;
      m.push({ kind: "line", pts: [[x, l.T], ext([x, l.T], 4)], key: "ceilingLine", width: 2 * s, alpha: 0.7 });
      m.push({ kind: "line", pts: [[x, l.B], ext([x, l.B], 4)], key: "floorLine", width: 2 * s, alpha: 0.6 });
    }
    // Corners where the walls meet.
    for (const p of [[l.R, l.T], [l.R, l.B], [l.L, l.T], [l.L, l.B]] as Pt[]) m.push({ kind: "line", pts: [p, ext(p, 4)], key: "ceilingLine", width: 3 * s, alpha: 0.6 });
    m.push({ kind: "line", pts: [[l.R, l.T], [l.R, l.B]], key: "ceilingLine", width: 3 * s, alpha: 0.5 });
    // The window's reveal.
    const ox = g.x - f, oy = g.y - f, ow = g.w + 2 * f, oh = g.h + 2 * f, r = f * 1.3;
    m.push({ kind: "fill", pts: wb([[ox - r, oy - r], [ox + ow + r, oy - r], [ox + ow, oy], [ox, oy]]), key: "reveal", density: 120 });
    m.push({ kind: "fill", pts: wb([[ox - r, oy - r], [ox, oy], [ox, oy + oh], [ox - r, oy + oh + r * 0.4]]), key: "reveal", angle: Math.PI / 2, density: 120 });
    m.push({ kind: "fill", pts: wb([[ox + ow + r, oy - r], [ox + ow, oy], [ox + ow, oy + oh], [ox + ow + r, oy + oh + r * 0.4]]), key: "reveal", angle: Math.PI / 2, density: 120 });

    // The fireplace on the right wall: a stone surround, a chimney breast and a dark opening.
    const S = l.side;
    m.push({ kind: "fill", pts: wb([S(0.03, 0), S(0.03, 0.42), S(0.35, 0.42), S(0.35, 0)], 1.5), key: "stone", angle: Math.PI / 2, density: 90, edge: 0.4 });
    m.push({ kind: "fill", pts: wb([S(0.07, 0.46), S(0.07, 1.05), S(0.31, 1.05), S(0.31, 0.46)], 1.5), key: "stoneDark", angle: Math.PI / 2, density: 120 });
    m.push({ kind: "fill", pts: wb(l.fire.quad, 1.2), key: "firebox", density: 60 });
    const mantel: Pt[] = [S(0.0, 0.42), S(0.0, 0.47), S(0.38, 0.47), S(0.38, 0.42)].map(([x, y]) => [x - 8 * s, y]);
    m.push({ kind: "fill", pts: wb(mantel, 1), key: "mantel", density: 50, edge: 0.5 });
    // Logs in the grate.
    const [fx, fy] = l.fire.base;
    for (const [dx, dy, w] of [[-0.25, 0, 0.55], [0.2, -0.02, 0.5], [0, -0.12, 0.45]] as const)
      m.push({ kind: "fill", pts: wb(rect(fx + dx * l.fire.w - (w * l.fire.w) / 2, fy + dy * l.fire.h - 10 * s, w * l.fire.w, 10 * s), 1), key: "logs", density: 30 });
    // A warm rug on the floor in front of the fire.
    const rc: Pt = [l.R - g.w * 0.02, l.B + (H - l.B) * 0.5];
    const rug: Pt[] = Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2, r = 1 + 0.08 * Math.sin(a * 5);
      return [rc[0] + Math.cos(a) * g.w * 0.2 * r, rc[1] + Math.sin(a) * (H - l.B) * 0.32 * r];
    });
    m.push({ kind: "fill", pts: wb(rug, 4), key: "rug", density: 60, spread: 0.2 });
    return m;
  },

  front(g, rng, l) {
    const { W, H, s } = g, f = g.frame, m: Mark[] = [];
    const wb = (pts: Pt[], amp = 2) => wobble(pts, rng, amp * s, 16 * s);
    // Window frame, with three tall panes and a transom.
    m.push({ kind: "fill", pts: wb(rect(g.x - f, g.y - f, g.w + 2 * f, f)), key: "frame", density: 80 });
    m.push({ kind: "fill", pts: wb(rect(g.x - f, g.y, f, g.h)), key: "frame", angle: Math.PI / 2, density: 80 });
    m.push({ kind: "fill", pts: wb(rect(g.x + g.w, g.y, f, g.h)), key: "frame", angle: Math.PI / 2, density: 80 });
    for (const u of [1 / 3, 2 / 3]) m.push({ kind: "fill", pts: wb(rect(g.x + g.w * u - g.mull / 2, g.y, g.mull, g.h), 1.2), key: "frame", angle: Math.PI / 2, density: 80 });
    m.push({ kind: "fill", pts: wb(rect(g.x, g.y + g.h * 0.22 - g.mull / 2, g.w, g.mull), 1.2), key: "frame", density: 80 });
    // A deep ledge with its front edge.
    const ly = l.ledge;
    m.push({ kind: "fill", pts: wb([[g.x - f * 2, g.y + g.h], [g.x + g.w + f * 2, g.y + g.h], [g.x + g.w + f * 3, ly + f * 0.4], [g.x - f * 3, ly + f * 0.4]]), key: "sill", density: 60 });
    m.push({ kind: "fill", pts: wb(rect(g.x - f * 3, ly + f * 0.4, g.w + f * 6, f * 1.1)), key: "sillFront", density: 60, edge: 0.4 });
    // Things on the ledge: candles, a stack of books, a folded blanket and a small plant.
    for (const c of l.candles) m.push({ kind: "fill", pts: wb(rect(c.x - 7 * s, c.y - c.h, 14 * s, c.h), 0.8), key: "wax", angle: Math.PI / 2, density: 20 });
    let by = ly;
    for (const [w, h, k] of [[90, 14, "b1"], [80, 11, "b2"], [86, 13, "blanket"]] as const) {
      m.push({ kind: "fill", pts: wb(rect(g.x + g.w * 0.62 - (w * s) / 2, by - h * s, w * s, h * s), 1), key: k, density: 30, edge: 0.4 });
      by -= h * s;
    }
    const blanket: Pt[] = [[g.x + g.w * 0.86, ly], [g.x + g.w * 0.97, ly], [g.x + g.w * 0.98, ly + f * 1.6], [g.x + g.w * 0.92, ly + f * 1.9], [g.x + g.w * 0.86, ly + f * 1.5]];
    m.push({ kind: "fill", pts: wb(blanket, 2), key: "blanket", angle: Math.PI / 2, density: 40, edge: 0.4 });
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32, x0 = g.x + g.w * 0.05, y0 = ly - 22 * s;
      const leaf: Pt[] = [[x0, y0], [x0 + Math.cos(a - 0.2) * 40 * s, y0 + Math.sin(a - 0.2) * 40 * s], [x0 + Math.cos(a) * 62 * s, y0 + Math.sin(a) * 62 * s], [x0 + Math.cos(a + 0.2) * 40 * s, y0 + Math.sin(a + 0.2) * 40 * s]];
      m.push({ kind: "fill", pts: leaf, key: "plant", density: 30 });
    }
    m.push({ kind: "fill", pts: wb(rect(g.x + g.w * 0.05 - 16 * s, ly - 26 * s, 32 * s, 26 * s), 1), key: "b1", density: 20, edge: 0.4 });
    // The fairy-light wire.
    m.push({ kind: "line", pts: l.bulbs.slice(0, 31), key: "wire", width: 1.4 * s, alpha: 0.9 });
    m.push({ kind: "line", pts: [l.bulbs[30]!, ...l.bulbs.slice(31)], key: "wire", width: 1.4 * s, alpha: 0.9 });

    // The bed: a deep, soft duvet across the foreground, with pillows near us on the left.
    const top = g.y + g.h + g.h * 0.075, right = g.x + g.w * 0.66;
    const contour: Pt[] = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30, x = -40 + (right + 40) * u;
      // Two or three big soft humps where the duvet bunches.
      contour.push([x, top - Math.sin(u * Math.PI * 2.6 + 0.6) * 14 * s - Math.sin(u * Math.PI) * 18 * s + u * 6 * s]);
    }
    const edge: Pt[] = [[right + 10 * s, top + 4 * s], [right + 34 * s, top + (H - top) * 0.45], [right + 60 * s, H + 20]];
    m.push({ kind: "fill", pts: wb([[-40, top + 30 * s], ...contour, [right + 24 * s, top + 16 * s], [right + 90 * s, H + 20], [-40, H + 20]], 2.5), key: "bedFrame", density: 120 });
    m.push({ kind: "fill", pts: wb([...contour, ...edge, [-40, H + 20]], 3), key: "duvet", angle: 0.1, density: 110, spread: 0.1, len: [24, 70] });
    // Shade low on the duvet, light along its top where it catches the window and the fire.
    m.push({ kind: "fill", pts: wb([[-40, top + (H - top) * 0.55], [right * 0.6, top + (H - top) * 0.7], [right + 50 * s, H + 20], [-40, H + 20]], 6), key: "duvetFold", angle: 0.1, density: 140, spread: 0.08, len: [30, 80] });
    m.push({ kind: "line", pts: contour.map(([x, y]) => [x, y + 7 * s] as Pt), key: "duvetHi", width: 12 * s, alpha: 0.55 });
    // Creases that follow the duvet's form, sweeping down from its humps.
    for (let i = 0; i < 6; i++) {
      const c = contour[3 + i * 4]!, sw = (i % 2 ? 1 : -1) * 30 * s;
      const crease: Pt[] = Array.from({ length: 6 }, (_, k) => {
        const u = k / 5;
        return [c[0] + sw * Math.sin(u * Math.PI) - u * 60 * s, c[1] + 14 * s + u * (H - c[1]) * 0.9];
      });
      m.push({ kind: "line", pts: crease, key: "duvetFold", width: (8 + (i % 3) * 5) * s, alpha: 0.5 });
      m.push({ kind: "line", pts: crease.map(([x, y]) => [x + 9 * s, y] as Pt), key: "duvetHi", width: 5 * s, alpha: 0.35 });
    }
    // Pillows.
    const pillow = (cx: number, cy: number, w: number, h: number, key: string, tilt: number) => {
      const pts: Pt[] = Array.from({ length: 32 }, (_, i) => {
        const a = (i / 32) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        // A squarish cushion shape with pulled-in corners.
        const x = Math.sign(c) * Math.pow(Math.abs(c), 0.6) * w, y = Math.sign(sn) * Math.pow(Math.abs(sn), 0.6) * h * (1 - 0.12 * Math.abs(c));
        return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
      });
      m.push({ kind: "fill", pts: wb(pts, 2), key, angle: tilt, density: 50, edge: 0.5, len: [16, 40] });
      m.push({ kind: "line", pts: pts.slice(18, 30).map(([x, y]) => [x, y + 5 * s] as Pt), key: "duvetHi", width: 6 * s, alpha: 0.4 });
    };
    pillow(g.x - g.w * 0.22, H - g.h * 0.07, g.w * 0.21, g.h * 0.12, "pillow2", -0.12);
    pillow(g.x + g.w * 0.08, H - g.h * 0.03, g.w * 0.18, g.h * 0.1, "pillow", 0.07);
    return m;
  },

  lights(g, l) {
    const [fx, fy] = l.fire.base, r = g.w;
    const candle = l.candles.map((c) => ({ x: c.x, y: c.y - c.h, r: g.w * 0.22, a: 0.7 }));
    const fairy = [0.15, 0.5, 0.85].map((u) => ({ x: g.x + g.w * u, y: g.y, r: g.w * 0.25, a: 0.5 }));
    return {
      back: [{ x: fx, y: fy - 40 * g.s, r: r * 0.75 }, ...candle, ...fairy],
      front: [{ x: fx - 60 * g.s, y: fy, r: r * 0.95, a: 0.9 }, ...candle, ...fairy],
    };
  },

  overlay(ctx, env, g, l, on) {
    const s = g.s, t = env.t, fire = Math.max(on, env.fire);
    drawFire(ctx, env, l, s, fire);
    // Candles.
    for (const [i, c] of l.candles.entries()) {
      const fl = 0.85 + 0.1 * Math.sin(t * 8 + i) + 0.05 * Math.sin(t * 13 + i * 2);
      const fx = c.x + Math.sin(t * 3 + i) * 0.8 * s, fy = c.y - c.h - 7 * s;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, fx, fy, 46 * s * fl, [255, 176, 96], 0.35 * on);
      ctx.restore();
      ctx.fillStyle = rgba([255, 224, 160], 0.6 + 0.4 * on);
      ctx.beginPath();
      ctx.ellipse(fx, fy, 3 * s, 7 * s * fl, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fairy lights, twinkling out of step.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [i, [bx, by]] of l.bulbs.entries()) {
      const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + (i % 5) * 0.17) + i * 1.7);
      glow(ctx, bx, by + 4 * s, 16 * s, [255, 196, 120], 0.35 * tw * Math.max(on, 0.3));
      glow(ctx, bx, by + 4 * s, 3.5 * s, [255, 236, 190], 0.9 * tw * Math.max(on, 0.3));
    }
    ctx.restore();
  },

  panes(g) {
    // Three tall panes under a transom, as painted in front().
    const m = g.mull / 2, cols = [0, 1 / 3, 2 / 3, 1], split = g.y + g.h * 0.22;
    const rows: [number, number][] = [[g.y, split - m], [split + m, g.y + g.h]];
    return rows.flatMap(([y0, y1]) => cols.slice(0, 3).map((u, i) => {
      const x0 = g.x + g.w * u + (i ? m : 0), x1 = g.x + g.w * cols[i + 1]! - (i < 2 ? m : 0);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }));
  },

  player(g, l) {
    return { x: g.x + g.w * 0.4, y: l.ledge };
  },
});

/** Flames in the fireplace, flickering, with their glow spilling into the room. */
function drawFire(ctx: CanvasRenderingContext2D, env: FrameEnv, l: Layout, s: number, level: number) {
  if (level < 0.02) return;
  const t = env.t, [bx, by] = l.fire.base, w = l.fire.w, h = l.fire.h;
  ctx.save();
  trace(ctx, l.fire.quad);
  ctx.clip();
  // A soft bed of embers, then layered tongues of flame: wide and orange outside, small and yellow within.
  glow(ctx, bx, by - 4 * s, w * 0.5, [255, 110, 40], 0.7 * level);
  const tongues: { n: number; spread: number; wk: number; hk: number; cols: [RGB, RGB] }[] = [
    { n: 4, spread: 0.7, wk: 0.16, hk: 0.85, cols: [[255, 120, 40], [220, 60, 20]] },
    { n: 3, spread: 0.45, wk: 0.1, hk: 0.6, cols: [[255, 214, 130], [255, 150, 60]] },
  ];
  for (const [layer, { n, spread, wk, hk, cols }] of tongues.entries()) {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, ph = i * 2.3 + layer * 5;
      const fh = h * hk * (0.6 + 0.4 * Math.abs(Math.sin(t * (1.7 + i * 0.31) + ph))) * (1 - Math.abs(u) * 0.6);
      const x = bx + u * w * spread, y = by - 4 * s, sway = Math.sin(t * 2.7 + ph) * w * 0.04, hw = w * wk;
      const grd = ctx.createLinearGradient(x, y, x, y - fh);
      grd.addColorStop(0, rgba(cols[0], 0.95 * level));
      grd.addColorStop(0.6, rgba(cols[1], 0.75 * level));
      grd.addColorStop(1, rgba(cols[1], 0));
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(x - hw, y);
      ctx.bezierCurveTo(x - hw * 1.1, y - fh * 0.45, x + sway - hw * 0.3, y - fh * 0.75, x + sway, y - fh);
      ctx.bezierCurveTo(x + sway + hw * 0.4, y - fh * 0.7, x + hw * 1.1, y - fh * 0.4, x + hw, y);
      ctx.fill();
    }
  }
  ctx.restore();
  const fl = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 12.7);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, bx, by - h * 0.3, w * 1.4 * fl, [255, 140, 60], 0.35 * level);
  glow(ctx, bx - w * 1.5, by + 20 * s, w * 3 * fl, [255, 120, 50], 0.08 * level * fl);
  ctx.restore();
}

