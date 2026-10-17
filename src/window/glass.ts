/** The window glass as a surface of its own: frost that grows in ferns from the corners on cold nights and
 *  mornings, condensation that fogs it when it's cold and damp outside (wipe it with the pointer; it slowly fogs
 *  again), and at night a faint reflection of the lit room. Textures are painted once per resize; each frame only
 *  blends them. */
import type { FrameEnv, Geom } from "./types";
import { clamp, makeRng, smooth, type Rng } from "./util";

type Pane = { x: number; y: number; w: number; h: number };

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** Frost coverages painted, from a light rime at the corners to most of the pane. */
const FROST_LEVELS = [0.35, 0.65, 1];
/** The glass textures are painted at this fraction of CSS pixels: they're soft, so half is plenty. */
const K = 0.5;

/** A fern of ice: a stem with side branches that branch again, thinning as they go. */
function fern(x: CanvasRenderingContext2D, rng: Rng, px: number, py: number, a: number, len: number, depth: number) {
  if (depth <= 0 || len < 2) return;
  const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len;
  x.lineWidth = Math.max(0.4, depth * 0.35);
  x.beginPath();
  x.moveTo(px, py);
  x.lineTo(ex, ey);
  x.stroke();
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1), bx = px + (ex - px) * u, by = py + (ey - py) * u, side = i % 2 ? 1 : -1;
    fern(x, rng, bx, by, a + side * (0.6 + rng() * 0.5), len * (0.35 + rng() * 0.2), depth - 1);
  }
  fern(x, rng, ex, ey, a + (rng() - 0.5) * 0.5, len * 0.62, depth - 1);
}

function paintFrost(g: Geom, panes: Pane[], coverage: number, seed: number) {
  const c = canvas(g.w * K, g.h * K), x = c.getContext("2d")!, rng = makeRng(seed);
  x.scale(K, K);
  x.translate(-g.x, -g.y);
  for (const p of panes) {
    x.save();
    x.beginPath();
    x.rect(p.x, p.y, p.w, p.h);
    x.clip();
    // A soft white rime, thickest at the bottom edge and the corners.
    const depth = Math.min(p.w, p.h) * 0.5 * coverage;
    const rime = x.createLinearGradient(0, p.y + p.h, 0, p.y + p.h - depth * 1.2);
    rime.addColorStop(0, "rgba(232,240,252,0.55)");
    rime.addColorStop(1, "rgba(232,240,252,0)");
    x.fillStyle = rime;
    x.fillRect(p.x, p.y, p.w, p.h);
    for (const [cx, cy] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]] as const) {
      const grd = x.createRadialGradient(cx, cy, 0, cx, cy, depth * 1.1);
      grd.addColorStop(0, "rgba(232,240,252,0.5)");
      grd.addColorStop(1, "rgba(232,240,252,0)");
      x.fillStyle = grd;
      x.fillRect(p.x, p.y, p.w, p.h);
    }
    // Ferns growing in from the corners and up from the bottom edge.
    x.strokeStyle = "rgba(240,246,255,0.4)";
    x.lineCap = "round";
    const seeds: [number, number, number][] = [
      [p.x, p.y + p.h, -Math.PI / 4],
      [p.x + p.w, p.y + p.h, (-3 * Math.PI) / 4],
      [p.x, p.y, Math.PI / 4],
      [p.x + p.w, p.y, (3 * Math.PI) / 4],
    ];
    for (let i = 0, n = Math.round(3 + 6 * coverage); i < n; i++) seeds.push([p.x + rng() * p.w, p.y + p.h, -Math.PI / 2 + (rng() - 0.5) * 1.2]);
    for (const [sx, sy, a] of seeds) fern(x, rng, sx, sy, a + (rng() - 0.5) * 0.4, depth * (0.45 + rng() * 0.35), 5);
    x.restore();
  }
  return c;
}

/** Fogged glass: an even mist, blotchy where it's thicker, with a few clearer runs where droplets slid down. */
function paintHaze(g: Geom, seed: number) {
  const c = canvas(g.w * K, g.h * K), x = c.getContext("2d")!, rng = makeRng(seed), s = g.s;
  x.scale(K, K);
  x.fillStyle = "rgba(214,222,236,0.55)";
  x.fillRect(0, 0, g.w, g.h);
  for (let i = 0; i < 260; i++) {
    const px = rng() * g.w, py = rng() * g.h, r = (10 + rng() * 40) * s;
    const grd = x.createRadialGradient(px, py, 0, px, py, r);
    grd.addColorStop(0, `rgba(236,240,248,${0.08 + rng() * 0.18})`);
    grd.addColorStop(1, "rgba(236,240,248,0)");
    x.fillStyle = grd;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  x.globalCompositeOperation = "destination-out";
  x.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    let px = rng() * g.w, py = rng() * g.h * 0.6;
    const len = (60 + rng() * 200) * s;
    x.lineWidth = (2 + rng() * 3) * s;
    x.strokeStyle = `rgba(0,0,0,${0.5 + rng() * 0.4})`;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 12; k++) {
      px += (rng() - 0.5) * 4 * s;
      py += len / 12;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  return c;
}

export class Glass {
  private frost: HTMLCanvasElement[] = [];
  private haze: HTMLCanvasElement | null = null;
  /** Where the pointer has wiped the mist away; fades back to nothing as the glass fogs again. */
  private wiped: HTMLCanvasElement | null = null;
  private scratch: HTMLCanvasElement | null = null;
  private reflection: HTMLCanvasElement | null = null;
  private reflectedAt = -1;
  private wipedAny = false;
  private mist = -1;
  private geom: Geom | null = null;

  build(g: Geom, panes: Pane[]) {
    this.geom = g;
    this.frost = FROST_LEVELS.map((c, i) => paintFrost(g, panes, c, 300 + i));
    this.haze = paintHaze(g, 410);
    this.wiped = canvas(g.w * K, g.h * K);
    this.scratch = canvas(g.w * K, g.h * K);
    this.reflection = canvas(g.w / 4, g.h / 8);
    this.reflectedAt = -1;
    this.wipedAny = false;
    this.mist = -1;
  }

  /** Wipes the mist at a point (CSS pixels on the scene's canvas). */
  wipe(px: number, py: number) {
    const g = this.geom;
    if (!g || !this.wiped || this.mist < 0.05) return;
    if (px < g.x || px > g.x + g.w || py < g.y || py > g.y + g.h) return;
    const x = this.wiped.getContext("2d")!, cx = (px - g.x) * K, cy = (py - g.y) * K, r = 34 * g.s * K;
    const grd = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, "rgba(0,0,0,1)");
    grd.addColorStop(0.6, "rgba(0,0,0,0.85)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = grd;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
    this.wipedAny = true;
  }

  /** How cold the glass is, frost-wise: from cold nights and before the sun warms it in the morning. */
  static frostLevel(env: FrameEnv) {
    return clamp((1 - env.temp) / 9) * (1 - 0.6 * smooth(10, 30, env.sunAlt));
  }

  /** How misted the glass is: cold outside, and damp (rain, fog) or a cold night. */
  static mistLevel(env: FrameEnv) {
    const cold = clamp((10 - env.temp) / 10), damp = clamp(env.rain * 1.2 + env.fog + (env.night > 0.5 && env.temp < 5 ? 0.4 : 0));
    return cold * damp;
  }

  /** A faint reflection of the lit room in the lower glass after dark, drawn before the room so the room's own
   *  shapes stay in front of it. */
  drawReflection(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom) {
    const a = 0.2 * (1 - env.dayness) * clamp(env.lamp + 0.3);
    if (!this.reflection || this.reflectedAt < 0 || a < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = a;
    ctx.translate(0, g.y + g.h);
    ctx.scale(1, -1);
    ctx.drawImage(this.reflection, g.x, 0, g.w, g.h * 0.32);
    ctx.restore();
  }

  /** Mist and frost over the glass, after the rain on it. */
  drawSurface(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom) {
    if (!this.haze || !this.wiped || !this.scratch) return;
    // Mist comes and goes over a minute or so, but a fresh window starts as misted as the weather says.
    const target = Glass.mistLevel(env);
    this.mist = this.mist < 0 ? target : this.mist + (target - this.mist) * Math.min(1, env.dt / 20);
    if (this.wipedAny) {
      // The wiped patches mist over again in a minute or two.
      const x = this.wiped.getContext("2d")!;
      x.globalCompositeOperation = "destination-out";
      x.fillStyle = `rgba(0,0,0,${Math.min(1, env.dt / 90)})`;
      x.fillRect(0, 0, this.wiped.width, this.wiped.height);
      x.globalCompositeOperation = "source-over";
    }
    if (this.mist > 0.02) {
      const x = this.scratch.getContext("2d")!;
      x.clearRect(0, 0, this.scratch.width, this.scratch.height);
      x.drawImage(this.haze, 0, 0);
      if (this.wipedAny) {
        x.globalCompositeOperation = "destination-out";
        x.drawImage(this.wiped, 0, 0);
        x.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = this.mist * 0.85;
      ctx.drawImage(this.scratch, g.x, g.y, g.w, g.h);
      ctx.globalAlpha = 1;
    }
    const f = Glass.frostLevel(env) * FROST_LEVELS.length;
    if (f > 0.02) {
      const i = Math.min(FROST_LEVELS.length - 1, Math.floor(f)), t = Math.min(1, f - i);
      if (i > 0) ctx.drawImage(this.frost[i - 1]!, g.x, g.y, g.w, g.h);
      ctx.globalAlpha = t;
      ctx.drawImage(this.frost[i]!, g.x, g.y, g.w, g.h);
      ctx.globalAlpha = 1;
    }
  }

  /** Keeps the reflection current: a small copy of the room just below the window, taken from the finished frame a
   *  few times a second (small enough to come out blurred). */
  capture(source: HTMLCanvasElement, dpr: number, env: FrameEnv, g: Geom) {
    if (!this.reflection || env.dayness > 0.7 || (this.reflectedAt >= 0 && env.t - this.reflectedAt < 0.25)) return;
    this.reflectedAt = env.t;
    const x = this.reflection.getContext("2d")!;
    x.clearRect(0, 0, this.reflection.width, this.reflection.height);
    x.globalCompositeOperation = "source-over";
    x.drawImage(source, g.x * dpr, (g.y + g.h) * dpr, g.w * dpr, g.h * 0.32 * dpr, 0, 0, this.reflection.width, this.reflection.height);
    // Strongest right by the sill, fading out further up the glass.
    const fade = x.createLinearGradient(0, 0, 0, this.reflection.height);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    x.globalCompositeOperation = "destination-in";
    x.fillStyle = fade;
    x.fillRect(0, 0, this.reflection.width, this.reflection.height);
    x.globalCompositeOperation = "source-over";
  }
}
