/** "Midnight study (painted)": a quiet study at night, painted rather than modelled. A desk lamp pools warm light
 *  on a few books and an open notebook; a small black cat sits on the desk watching the city; the rest of the room
 *  falls away into cool, soft shadow. The room is painted once in night, day and lamplight colours, and each
 *  frame blends those paintings for the real time of day, then adds the few things that move. */
import type { FrameEnv, Geom, RoomPack } from "../types";
import { clamp, makeRng, rgba, type RGB, type Rng } from "../util";
import { brush, fadeOut, free, grain, layer, rect, trace, wobble, type Pt } from "./paint";
import { dayLevel, glow } from "./props";

type Key =
  | "wall" | "wallDeep" | "reveal" | "revealDeep" | "shelf" | "frame" | "sill" | "deskTop" | "deskFront" | "deskEdge"
  | "lamp" | "lampInner" | "b1" | "b2" | "b3" | "b4" | "b5" | "pages" | "ink" | "mug" | "plant" | "plant2" | "chair"
  | "picture" | "pictureArt";
type Palette = Record<Key, RGB>;

const NIGHT: Palette = {
  wall: [44, 50, 88], wallDeep: [20, 22, 46], reveal: [30, 34, 64], revealDeep: [18, 20, 40], shelf: [34, 30, 48],
  frame: [22, 22, 38], sill: [46, 42, 64], deskTop: [74, 56, 70], deskFront: [28, 22, 36], deskEdge: [98, 74, 86],
  lamp: [36, 30, 46], lampInner: [96, 64, 54], b1: [70, 58, 96], b2: [96, 58, 72], b3: [56, 74, 104], b4: [112, 82, 72],
  b5: [82, 90, 112], pages: [128, 128, 160], ink: [74, 74, 112], mug: [86, 80, 110], plant: [14, 22, 34], plant2: [22, 34, 48],
  chair: [24, 18, 32], picture: [26, 24, 40], pictureArt: [62, 66, 104],
};
const DAY: Palette = {
  wall: [112, 120, 150], wallDeep: [70, 76, 108], reveal: [92, 98, 128], revealDeep: [64, 68, 96], shelf: [96, 84, 90],
  frame: [58, 60, 84], sill: [140, 130, 140], deskTop: [150, 120, 110], deskFront: [74, 60, 72], deskEdge: [176, 146, 130],
  lamp: [80, 60, 72], lampInner: [150, 110, 90], b1: [130, 110, 150], b2: [170, 110, 110], b3: [100, 130, 160], b4: [190, 150, 120],
  b5: [140, 150, 170], pages: [226, 222, 214], ink: [150, 150, 172], mug: [170, 160, 180], plant: [40, 60, 70], plant2: [56, 80, 86],
  chair: [70, 50, 64], picture: [60, 56, 74], pictureArt: [150, 150, 182],
};
/** Everything as the lamp lights it; faded out with distance from the lamp before use. */
const LAMP: Palette = {
  wall: [150, 96, 84], wallDeep: [92, 56, 58], reveal: [170, 110, 90], revealDeep: [120, 76, 70], shelf: [140, 90, 70],
  frame: [100, 62, 56], sill: [204, 142, 110], deskTop: [222, 150, 98], deskFront: [128, 72, 58], deskEdge: [250, 192, 132],
  lamp: [150, 70, 52], lampInner: [255, 222, 160], b1: [190, 120, 110], b2: [232, 140, 96], b3: [150, 130, 140], b4: [252, 192, 130],
  b5: [204, 170, 150], pages: [255, 228, 182], ink: [182, 130, 110], mug: [232, 180, 150], plant: [70, 50, 44], plant2: [100, 70, 56],
  chair: [110, 60, 50], picture: [110, 70, 60], pictureArt: [222, 160, 120],
};

/** A shape to paint: a brushed fill, or a painted line. */
type Mark =
  | { kind: "fill"; pts: Pt[]; key: Key; angle?: number; density?: number; edge?: number; spread?: number }
  | { kind: "line"; pts: Pt[]; key: Key; width: number; alpha?: number };

export type PaintedData = {
  back: { night: HTMLCanvasElement; day: HTMLCanvasElement; lamp: HTMLCanvasElement };
  front: { night: HTMLCanvasElement; day: HTMLCanvasElement; lamp: HTMLCanvasElement };
  /** Where the lamp's shade opens, which way it points, and the spot it lights. */
  lamp: { x: number; y: number; dx: number; dy: number; r: number; target: Pt };
  cat: { x: number; y: number; u: number };
  mug: { x: number; top: number };
  turntable: { x: number; y: number };
};

/** A thick stroke as a polygon, so it can be brushed like any other shape. */
function bar(a: Pt, b: Pt, w: number): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * (w / 2), ny = (dx / l) * (w / 2);
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
  ];
}

function leaf(cx: number, cy: number, len: number, wid: number, ang: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, w = Math.sin(u * Math.PI) * wid * (1 - u * 0.3);
    pts.push([u * len, w]);
  }
  for (let i = 10; i >= 0; i--) {
    const u = i / 10, w = Math.sin(u * Math.PI) * wid * (1 - u * 0.3);
    pts.push([u * len, -w * 0.8]);
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function backMarks(g: Geom, rng: Rng): Mark[] {
  const { W, H, s } = g, f = g.frame, r = f * 1.5, m: Mark[] = [];
  m.push({ kind: "fill", pts: rect(-10, -10, W + 20, H + 20), key: "wall", angle: Math.PI / 2, density: 320, spread: 0.18 });
  // The window's reveal: the thickness of the wall around the frame, darker at the top.
  const ox = g.x - f, oy = g.y - f, ow = g.w + 2 * f, oh = g.h + 2 * f;
  m.push({ kind: "fill", pts: wobble([[ox - r, oy - r], [ox + ow + r, oy - r], [ox + ow, oy], [ox, oy]], rng, 2 * s), key: "revealDeep", density: 120 });
  m.push({ kind: "fill", pts: wobble([[ox - r, oy - r], [ox, oy], [ox, oy + oh], [ox - r, oy + oh + r * 0.4]], rng, 2 * s), key: "reveal", angle: Math.PI / 2, density: 120 });
  m.push({ kind: "fill", pts: wobble([[ox + ow + r, oy - r], [ox + ow, oy], [ox + ow, oy + oh], [ox + ow + r, oy + oh + r * 0.4]], rng, 2 * s), key: "revealDeep", angle: Math.PI / 2, density: 120 });
  // A shelf of books on the left wall, if there's room.
  const sx1 = ox - r - 40 * s, sx0 = Math.max(16 * s, sx1 - 260 * s);
  if (sx1 - sx0 > 90 * s) {
    const sy = g.y + g.h * 0.3;
    let x = sx0 + 8 * s;
    while (x < sx1 - 20 * s) {
      const w = (10 + rng() * 10) * s, h = (40 + rng() * 34) * s, k = (["b1", "b2", "b3", "b4", "b5"] as const)[(rng() * 5) | 0]!;
      const lean = rng() < 0.12 ? 8 * s : 0;
      m.push({ kind: "fill", pts: wobble([[x, sy], [x + w, sy], [x + w + lean, sy - h], [x + lean, sy - h]], rng, 1.5 * s, 12 * s), key: k, angle: Math.PI / 2, density: 80, edge: 0.4 });
      x += w + (lean ? 12 * s : 2 * s);
    }
    m.push({ kind: "fill", pts: wobble(rect(sx0 - 6 * s, sy, sx1 - sx0 + 12 * s, 9 * s), rng, 1.5 * s), key: "shelf", density: 60, edge: 0.5 });
  }
  // A dim picture on the right wall.
  const px = ox + ow + r + 50 * s, pw = Math.min(150 * s, W - px - 30 * s);
  if (pw > 70 * s) {
    const py = g.y + g.h * 0.08, ph = pw * 1.3;
    m.push({ kind: "fill", pts: wobble(rect(px, py, pw, ph), rng, 2 * s), key: "picture", density: 90, edge: 0.5 });
    m.push({ kind: "fill", pts: wobble(rect(px + 12 * s, py + 12 * s, pw - 24 * s, ph - 24 * s), rng, 2 * s), key: "pictureArt", density: 60, angle: 0.4, spread: 0.3 });
  }
  return m;
}

function frontMarks(g: Geom, rng: Rng, d: Omit<PaintedData, "back" | "front">): Mark[] {
  const { W, H, s } = g, f = g.frame, m: Mark[] = [];
  const wb = (pts: Pt[], amp = 2) => wobble(pts, rng, amp * s, 16 * s);
  // Window frame and glazing bars.
  m.push({ kind: "fill", pts: wb(rect(g.x - f, g.y - f, g.w + 2 * f, f)), key: "frame", density: 80 });
  m.push({ kind: "fill", pts: wb(rect(g.x - f, g.y + g.h, g.w + 2 * f, f)), key: "frame", density: 80 });
  m.push({ kind: "fill", pts: wb(rect(g.x - f, g.y, f, g.h)), key: "frame", angle: Math.PI / 2, density: 80 });
  m.push({ kind: "fill", pts: wb(rect(g.x + g.w, g.y, f, g.h)), key: "frame", angle: Math.PI / 2, density: 80 });
  m.push({ kind: "fill", pts: wb(rect(g.mx - g.mull / 2, g.y, g.mull, g.h), 1.2), key: "frame", angle: Math.PI / 2, density: 80 });
  m.push({ kind: "fill", pts: wb(rect(g.x, g.my - g.mull / 2, g.w, g.mull), 1.2), key: "frame", density: 80 });
  // Sill.
  const sy = g.y + g.h + f;
  m.push({ kind: "fill", pts: wb([[g.x - f * 2.2, sy], [g.x + g.w + f * 2.2, sy], [g.x + g.w + f * 2.6, sy + f * 0.6], [g.x - f * 2.6, sy + f * 0.6]]), key: "sill", density: 60, edge: 0.5 });

  // The desk, its top seen a little from above.
  const by = sy + f * 0.9, fy = Math.min(H - 40 * s, by + Math.max(70 * s, (H - by) * 0.5));
  m.push({ kind: "fill", pts: wb([[g.x - g.w * 0.45, by], [g.x + g.w * 1.45, by], [W + 40, fy], [-40, fy]], 3), key: "deskTop", angle: 0.02, density: 140, spread: 0.2 });
  m.push({ kind: "fill", pts: wb([[-40, fy], [W + 40, fy], [W + 40, H + 20], [-40, H + 20]], 3), key: "deskFront", angle: 0, density: 200 });
  m.push({ kind: "line", pts: [[-40, fy], [W + 40, fy]], key: "deskEdge", width: 3 * s, alpha: 0.8 });
  const at = (u: number, v: number): Pt => [g.x + g.w * u, by + (fy - by) * v];

  // Books standing against the window.
  let x = g.x + g.w * 0.07;
  const base = at(0, 0.18)[1];
  for (let i = 0; i < 9; i++) {
    const w = (12 + rng() * 9) * s, h = g.h * (0.1 + rng() * 0.08), k = (["b1", "b2", "b3", "b4", "b5"] as const)[i % 5]!;
    const lean = i === 8 ? 18 * s : 0;
    m.push({ kind: "fill", pts: wb([[x, base], [x + w, base], [x + w + lean, base - h], [x + lean, base - h]], 1.5), key: k, angle: Math.PI / 2, density: 50, edge: 0.45 });
    m.push({ kind: "line", pts: [[x + 2 * s + lean * 0.8, base - h * 0.8], [x + w - 2 * s + lean * 0.8, base - h * 0.8]], key: "pages", width: 1.5 * s, alpha: 0.35 });
    x += w + (lean ? 20 * s : 1.5 * s);
  }

  // An open notebook under the lamp.
  const [nx, ny] = d.lamp.target, nw = g.w * 0.13, nd = (fy - by) * 0.32;
  for (const side of [-1, 1]) {
    const x0 = nx, x1 = nx + side * nw;
    m.push({ kind: "fill", pts: wb([[x0, ny - nd / 2], [x1, ny - nd / 2 + 3 * s], [x1 + side * 8 * s, ny + nd / 2], [x0, ny + nd / 2 + 2 * s]], 1.2), key: "pages", density: 40, spread: 0.08 });
    for (let k = 1; k < 6; k++) {
      const yy = ny - nd / 2 + (nd * k) / 6;
      m.push({ kind: "line", pts: [[x0 + side * 10 * s, yy], [x1 - side * 8 * s + side * (8 * s * k) / 6, yy + 2 * s]], key: "ink", width: 1.2 * s, alpha: 0.6 });
    }
  }
  m.push({ kind: "line", pts: [[nx + nw * 0.6, ny + nd * 0.7], [nx + nw * 1.35, ny + nd * 0.35]], key: "b4", width: 4 * s });

  // The lamp: a weighted base, two arms and a cone-shaped shade.
  const L = d.lamp, bx = g.x + g.w * 0.02, bY = at(0, 0.5)[1];
  const elbow: Pt = [bx - g.w * 0.05, by - g.h * 0.42], head: Pt = [L.x - L.dx * 46 * s, L.y - L.dy * 46 * s];
  m.push({ kind: "fill", pts: wb(bar([bx, bY], elbow, 9 * s), 1), key: "lamp", density: 40 });
  m.push({ kind: "fill", pts: wb(bar(elbow, head, 8 * s), 1), key: "lamp", density: 40 });
  const ell: Pt[] = Array.from({ length: 20 }, (_, i) => [bx + Math.cos((i / 20) * Math.PI * 2) * 36 * s, bY + Math.sin((i / 20) * Math.PI * 2) * 10 * s]);
  m.push({ kind: "fill", pts: wb(ell, 1), key: "lamp", density: 40, edge: 0.5 });
  const nX = -L.dy, nY = L.dx;
  m.push({
    kind: "fill",
    pts: wb([[head[0] + nX * 12 * s, head[1] + nY * 12 * s], [L.x + nX * L.r, L.y + nY * L.r], [L.x - nX * L.r, L.y - nY * L.r], [head[0] - nX * 12 * s, head[1] - nY * 12 * s]], 1),
    key: "lamp",
    angle: Math.atan2(L.dy, L.dx),
    density: 30,
    edge: 0.6,
  });
  const mouth: Pt[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [L.x + nX * L.r * Math.cos(a) + L.dx * 7 * s * Math.sin(a), L.y + nY * L.r * Math.cos(a) + L.dy * 7 * s * Math.sin(a)];
  });
  m.push({ kind: "fill", pts: mouth, key: "lampInner", density: 30 });

  // A mug.
  const mu = d.mug;
  m.push({ kind: "fill", pts: wb(rect(mu.x - 15 * s, mu.top - 34 * s, 30 * s, 34 * s), 1.2), key: "mug", angle: Math.PI / 2, density: 30, edge: 0.5 });
  m.push({ kind: "line", pts: [[mu.x + 15 * s, mu.top - 26 * s], [mu.x + 24 * s, mu.top - 22 * s], [mu.x + 24 * s, mu.top - 12 * s], [mu.x + 15 * s, mu.top - 8 * s]], key: "mug", width: 4 * s });
  // A stack of books on the right.
  let sy2 = at(0, 0.42)[1];
  for (const [w, h, k] of [[0.16, 16, "b3"], [0.14, 13, "b4"], [0.15, 18, "b2"], [0.12, 12, "b5"]] as const) {
    const cx = g.x + g.w * 0.9 + (rng() - 0.5) * 8 * s;
    m.push({ kind: "fill", pts: wb(rect(cx - (g.w * w) / 2, sy2 - h * s, g.w * w, h * s), 1.2), key: k, density: 40, edge: 0.45 });
    sy2 -= h * s;
  }

  // Foreground silhouettes: a big-leafed plant on the left, a chair back on the right.
  const pbx = Math.max(30 * s, g.x - g.w * 0.25), pby = H + 10;
  for (let i = 0; i < 13; i++) {
    const ang = -Math.PI / 2 - 1.0 + (i / 12) * 1.7 + (rng() - 0.5) * 0.25, len = g.h * (0.22 + rng() * 0.3), bend = (rng() - 0.5) * 0.6;
    // A stem that arches as it grows, then a broad leaf hanging from its tip.
    const stem: Pt[] = Array.from({ length: 7 }, (_, k) => {
      const u = k / 6, a = ang + bend * u * u;
      return [pbx + Math.cos(a) * len * u, pby + Math.sin(a) * len * u + u * u * len * 0.12];
    });
    const tip = stem[6]!;
    m.push({ kind: "line", pts: stem, key: "plant", width: 3.5 * s });
    const la = ang + bend + 0.35 * Math.sign(Math.cos(ang) || 1) + (rng() - 0.5) * 0.5;
    m.push({ kind: "fill", pts: wb(leaf(tip[0], tip[1], g.h * (0.15 + rng() * 0.09), g.h * (0.05 + rng() * 0.02), la), 1.5), key: i % 3 ? "plant" : "plant2", angle: la, density: 50, edge: 0.3 });
  }
  const cx0 = g.x + g.w * 0.98, cw = Math.min(g.w * 0.32, W - cx0 + 40 * s), ctop = fy - g.h * 0.12;
  if (cw > 60 * s) {
    for (const xx of [cx0, cx0 + cw]) m.push({ kind: "fill", pts: wb(rect(xx - 9 * s, ctop, 18 * s, H - ctop + 20)), key: "chair", angle: Math.PI / 2, density: 40 });
    m.push({ kind: "fill", pts: wb(rect(cx0 - 12 * s, ctop - 4 * s, cw + 24 * s, 22 * s)), key: "chair", density: 40 });
    for (let i = 1; i < 4; i++) m.push({ kind: "fill", pts: wb(rect(cx0 + (cw * i) / 4 - 7 * s, ctop + 18 * s, 14 * s, H - ctop)), key: "chair", angle: Math.PI / 2, density: 40 });
  }
  return m;
}

function paint(g: Geom, marks: Mark[], pal: Palette, seed: number, soften: number) {
  // The softened background doesn't need more than one pixel per CSS pixel.
  const L = layer(g.W, g.H, soften ? 1 : 1.5), x = L.x, rng = makeRng(seed);
  for (const mk of marks) {
    if (mk.kind === "fill") brush(x, mk.pts, pal[mk.key], rng, { s: g.s, angle: mk.angle ?? 0, density: mk.density ?? 160, spread: mk.spread ?? 0.14, edge: mk.edge ?? 0 });
    else {
      x.strokeStyle = rgba(pal[mk.key], mk.alpha ?? 1);
      x.lineWidth = mk.width;
      x.lineCap = x.lineJoin = "round";
      x.beginPath();
      mk.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      x.stroke();
    }
  }
  if (!soften) return L;
  // Soften the background: the room behind the desk is out of focus.
  const out = layer(g.W, g.H, 1);
  out.x.filter = `blur(${soften}px)`;
  out.x.drawImage(L.c, 0, 0, g.W, g.H);
  out.x.filter = "none";
  free(L.c);
  return out;
}

/** Deepens the edges and ceiling of a painted wall, so the room falls into shadow away from the light. */
function shadeWall(g: Geom, x: CanvasRenderingContext2D, pal: Palette) {
  const v = x.createRadialGradient(g.x + g.w * 0.45, g.y + g.h * 0.6, g.h * 0.3, g.x + g.w * 0.45, g.y + g.h * 0.6, Math.max(g.W, g.H) * 0.75);
  v.addColorStop(0, rgba(pal.wallDeep, 0));
  v.addColorStop(1, rgba(pal.wallDeep, 0.85));
  x.save();
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = v;
  x.fillRect(0, 0, g.W, g.H);
  x.restore();
}

export const paintedStudy: RoomPack<PaintedData> = {
  id: "painted",
  name: "Midnight study (painted)",
  ambience: { rain: 1, wind: 0.6, city: 1, fire: 0, crickets: 0.3, birds: 0.6 },

  build(g, rng) {
    const s = g.s, f = g.frame;
    const by = g.y + g.h + f * 1.9, fy = Math.min(g.H - 40 * s, by + Math.max(70 * s, (g.H - by) * 0.5));
    const target: Pt = [g.x + g.w * 0.3, by + (fy - by) * 0.55];
    const dir = { x: 0.62, y: 0.78 };
    const d = {
      lamp: { x: g.x + g.w * 0.19, y: by - g.h * 0.2, dx: dir.x, dy: dir.y, r: 30 * s, target },
      cat: { x: g.x + g.w * 0.66, y: by + (fy - by) * 0.3, u: (g.h / 576) * 1.25 },
      mug: { x: g.x + g.w * 0.5, top: by + (fy - by) * 0.42 },
      turntable: { x: g.x + g.w * 1.05, y: by + (fy - by) * 0.6 },
    };
    const bm = backMarks(g, rng), fm = frontMarks(g, rng, d);
    const lit = { x: target[0], y: target[1] - g.h * 0.12 };
    const back = { night: paint(g, bm, NIGHT, 11, 1.6), day: paint(g, bm, DAY, 11, 1.6), lamp: paint(g, bm, LAMP, 11, 1.6) };
    shadeWall(g, back.night.x, NIGHT);
    shadeWall(g, back.day.x, DAY);
    fadeOut(back.lamp.x, lit.x, lit.y - g.h * 0.1, g.w * 0.6, g.W, g.H);
    const front = { night: paint(g, fm, NIGHT, 23, 0), day: paint(g, fm, DAY, 23, 0), lamp: paint(g, fm, LAMP, 23, 0) };
    fadeOut(front.lamp.x, lit.x, lit.y, g.w * 0.44, g.W, g.H);
    return {
      ...d,
      back: { night: back.night.c, day: back.day.c, lamp: back.lamp.c },
      front: { night: front.night.c, day: front.day.c, lamp: front.lamp.c },
    };
  },

  drawRoom(ctx, env, g, d) {
    blend(ctx, env, g, d.back);
  },

  drawInterior(ctx, env, g, d) {
    const { W, H, s } = g, t = env.t, on = lampLevel(env);
    blend(ctx, env, g, d.front);
    const L = d.lamp;

    // A faint cone of light from the shade, and the glow at its mouth.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const [tx, ty] = L.target, nX = -L.dy, nY = L.dx;
    const cone = ctx.createLinearGradient(L.x, L.y, tx, ty);
    cone.addColorStop(0, rgba([255, 196, 130], 0.14 * on));
    cone.addColorStop(1, rgba([255, 196, 130], 0));
    ctx.fillStyle = cone;
    trace(ctx, [[L.x + nX * L.r, L.y + nY * L.r], [tx + g.w * 0.16, ty + 10 * s], [tx - g.w * 0.16, ty + 10 * s], [L.x - nX * L.r, L.y - nY * L.r]]);
    ctx.fill();
    glow(ctx, L.x + L.dx * 4 * s, L.y + L.dy * 4 * s, 70 * s, [255, 210, 150], 0.5 * on);
    glow(ctx, tx, ty, g.w * 0.22, [255, 170, 100], 0.12 * on);
    // The lamp, reflected faintly in the glass.
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.clip();
    glow(ctx, L.x + g.w * 0.04, L.y - g.h * 0.12, 60 * s, [255, 190, 130], 0.12 * on * env.night);
    ctx.restore();

    drawCat(ctx, env, d.cat, on);

    // Steam from the mug.
    const mu = d.mug;
    ctx.lineCap = "round";
    ctx.lineWidth = 3 * s;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.22 + i / 3) % 1, sx = mu.x - 5 * s + i * 5 * s, sy = mu.top - 40 * s - ph * 34 * s;
      ctx.strokeStyle = rgba([255, 236, 220], 0.1 * Math.sin(ph * Math.PI) * (0.4 + on));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + 8 * s * Math.sin(t + i), sy - 12 * s, sx - 8 * s * Math.sin(t * 1.3 + i), sy - 22 * s, sx + 3 * s, sy - 34 * s);
      ctx.stroke();
    }

    // Vignette and grain over the whole picture.
    const v = ctx.createRadialGradient(g.x + g.w * 0.42, g.y + g.h * 0.7, Math.min(W, H) * 0.3, g.x + g.w * 0.42, g.y + g.h * 0.7, Math.max(W, H) * 0.8);
    v.addColorStop(0, "rgba(8,8,22,0)");
    v.addColorStop(1, "rgba(8,8,22,0.55)");
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

/** The lamp is nearly always on in this room: brightest at night, still glowing on a grey day. */
const lampLevel = (env: FrameEnv) => clamp(Math.max(env.lamp * 1.1, 0.6 * (1 - dayLevel(env))) + 0.2);

function blend(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, l: { night: HTMLCanvasElement; day: HTMLCanvasElement; lamp: HTMLCanvasElement }) {
  const day = dayLevel(env), on = lampLevel(env);
  ctx.drawImage(l.night, 0, 0, g.W, g.H);
  if (day > 0.01) {
    ctx.globalAlpha = day;
    ctx.drawImage(l.day, 0, 0, g.W, g.H);
  }
  ctx.globalAlpha = on * (1 - 0.55 * day);
  ctx.drawImage(l.lamp, 0, 0, g.W, g.H);
  ctx.globalAlpha = 1;
}

/** A small black cat sitting on the desk with its back to us, lit warm on the lamp side and cool from the window.
 *  Its tail sways and an ear twitches now and then. */
function drawCat(ctx: CanvasRenderingContext2D, env: FrameEnv, c: PaintedData["cat"], on: number) {
  const { x, y, u } = c, t = env.t;
  const twitch = Math.max(0, Math.sin(t * 0.7)) ** 40 * 4 * u;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(x - 32 * u, y);
    ctx.bezierCurveTo(x - 42 * u, y - 38 * u, x - 24 * u, y - 70 * u, x - 13 * u, y - 76 * u);
    ctx.bezierCurveTo(x - 25 * u, y - 84 * u, x - 23 * u, y - 100 * u, x - 16 * u, y - 106 * u);
    ctx.lineTo(x - 19 * u - twitch, y - 124 * u);
    ctx.lineTo(x - 6 * u, y - 111 * u);
    ctx.quadraticCurveTo(x, y - 114 * u, x + 6 * u, y - 111 * u);
    ctx.lineTo(x + 19 * u, y - 124 * u);
    ctx.lineTo(x + 16 * u, y - 106 * u);
    ctx.bezierCurveTo(x + 23 * u, y - 100 * u, x + 25 * u, y - 84 * u, x + 13 * u, y - 76 * u);
    ctx.bezierCurveTo(x + 24 * u, y - 70 * u, x + 42 * u, y - 38 * u, x + 32 * u, y);
    ctx.closePath();
  };
  // Shadow on the desk.
  ctx.fillStyle = "rgba(6,4,14,0.45)";
  ctx.beginPath();
  ctx.ellipse(x + 10 * u, y + 2 * u, 46 * u, 7 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  const fur: RGB = [16, 15, 26];
  // Tail, curled along the desk with its tip swaying.
  const sway = Math.sin(t * 0.9) * 7 * u * (0.5 + 0.5 * Math.sin(t * 0.23));
  ctx.strokeStyle = rgba(fur);
  ctx.lineWidth = 10 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 26 * u, y - 5 * u);
  ctx.quadraticCurveTo(x + 66 * u, y + 2 * u, x + 78 * u + sway * 0.4, y - 10 * u);
  ctx.quadraticCurveTo(x + 86 * u + sway, y - 22 * u, x + 78 * u + sway, y - 30 * u);
  ctx.stroke();
  body();
  ctx.fillStyle = rgba(fur);
  ctx.fill();
  // Rim light: warm from the lamp on its left, a cool sheen from the window on its head and back.
  ctx.save();
  body();
  ctx.clip();
  const warm = ctx.createLinearGradient(x - 40 * u, y, x - 10 * u, y);
  warm.addColorStop(0, rgba([255, 168, 110], 0.55 * on));
  warm.addColorStop(1, rgba([255, 168, 110], 0));
  ctx.fillStyle = warm;
  ctx.fillRect(x - 45 * u, y - 130 * u, 40 * u, 130 * u);
  const cool = ctx.createLinearGradient(x, y - 124 * u, x, y - 80 * u);
  cool.addColorStop(0, rgba([120, 150, 230], 0.35));
  cool.addColorStop(1, rgba([120, 150, 230], 0));
  ctx.fillStyle = cool;
  ctx.fillRect(x - 30 * u, y - 130 * u, 60 * u, 50 * u);
  ctx.restore();
}
