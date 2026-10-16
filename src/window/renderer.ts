/** Owns one canvas and draws the parts every window shares: sky, stars, sun and moon, clouds, falling weather,
 *  lightning and the glass. A window pack draws the room and the view. */
import type { Environment } from "./environment";
import type { AnyPack, FrameEnv, Geom, Painter } from "./types";
import { clamp, makeRng, mixRGB, rgba, smooth, type RGB, type Rng } from "./util";

export type RendererOptions = {
  /** true: the room with a window in it. false: the view fills the canvas, as if the screen were the glass. */
  framed: boolean;
  /** Horizontal centre of the window as a fraction of the width (framed mode). */
  align?: number;
  /** Parallax strength; 0 turns it off. */
  parallax?: number;
  /** Frame-rate cap, to keep a background canvas cheap. */
  maxFps?: number;
  maxDpr?: number;
};

function computeGeom(W: number, H: number, opts: RendererOptions): Geom {
  if (!opts.framed) {
    return {
      W,
      H,
      x: 0,
      y: 0,
      w: W,
      h: H,
      frame: 0,
      mull: 0,
      mx: W / 2,
      my: H / 2,
      panes: [{ x: 0, y: 0, w: W, h: H }],
      s: Math.min(W, H * 1.3) / 1100,
      horizon: H * 0.62,
      framed: false,
    };
  }
  const portrait = W / H < 0.85;
  let w: number, h: number;
  if (portrait) {
    w = Math.min(W * 0.78, 520);
    h = Math.min(H * 0.56, w * 1.45);
  } else {
    h = Math.min(H * 0.6, 720);
    w = Math.min(W * 0.56, h * 1.32);
  }
  w = Math.round(w);
  h = Math.round(h);
  const align = portrait ? 0.5 : (opts.align ?? 0.5);
  const x = Math.round(Math.min(Math.max(W * align - w / 2, W * 0.04), W - w - W * 0.04));
  // Low enough to clear the city readout in the top-left corner.
  const y = Math.round(portrait ? Math.max(H * 0.12, 90) : Math.max(H * 0.18, 162));
  const frame = Math.max(10, Math.round(w * 0.032));
  const mull = Math.max(6, Math.round(frame * 0.55));
  const mx = x + w / 2,
    my = y + h * 0.44;
  const left = mx - mull / 2 - x,
    right = x + w - mx - mull / 2;
  const panes = [
    { x, y, w: left, h: my - mull / 2 - y },
    { x: mx + mull / 2, y, w: right, h: my - mull / 2 - y },
    { x, y: my + mull / 2, w: left, h: y + h - my - mull / 2 },
    { x: mx + mull / 2, y: my + mull / 2, w: right, h: y + h - my - mull / 2 },
  ];
  return {
    W,
    H,
    x,
    y,
    w,
    h,
    frame,
    mull,
    mx,
    my,
    panes,
    s: Math.min(w, h * 1.3) / 900,
    horizon: y + h * 0.62,
    framed: true,
  };
}

function makeSprite(snow: boolean) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d")!;
  if (snow) {
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,.95)");
    g.addColorStop(0.5, "rgba(240,246,255,.6)");
    g.addColorStop(1, "rgba(240,246,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return c;
  }
  const g = x.createRadialGradient(13, 12, 1, 16, 16, 15);
  g.addColorStop(0, "rgba(255,255,255,.5)");
  g.addColorStop(0.35, "rgba(220,230,240,.14)");
  g.addColorStop(0.8, "rgba(20,24,34,.24)");
  g.addColorStop(1, "rgba(20,24,34,0)");
  x.fillStyle = g;
  x.beginPath();
  x.arc(16, 16, 15, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = "rgba(255,255,255,.75)";
  x.beginPath();
  x.arc(12, 11, 2.2, 0, Math.PI * 2);
  x.fill();
  return c;
}

type Drop = { x: number; y: number; z: number };
type Flake = Drop & { p: number };
type Drifter = { x: number; y: number; z: number; rot: number; vr: number; p: number; hue: number };
type Bead = { x: number; y: number; r: number; snow: boolean; life: number; decay: number };
type Slider = { x: number; y: number; r: number; v: number; pause: number; lx: number; ly: number };
type Cloud = {
  x: number;
  y: number;
  sc: number;
  thr: number;
  speed: number;
  puffs: { dx: number; dy: number; r: number }[];
};
type Star = { x: number; y: number; r: number; p: number; s: number };

const AURORA_BANDS = [
  { y: 0.12, h: 0.32, x0: -0.1, x1: 0.75, ph: 0, sp: 0.05 },
  { y: 0.22, h: 0.24, x0: 0.25, x1: 1.1, ph: 2.1, sp: 0.035 },
  { y: 0.06, h: 0.2, x0: 0.1, x1: 0.9, ph: 4.2, sp: 0.06 },
];

export class Renderer {
  readonly reduced: boolean;
  private ctx: CanvasRenderingContext2D;
  private geom!: Geom;
  private data: unknown;
  private dpr = 1;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private dropSprite = makeSprite(false);
  private flakeSprite = makeSprite(true);
  private stars: Star[] = [];
  private clouds: Cloud[] = [];
  private rain: Drop[] = [];
  private snow: Flake[] = [];
  private drifters: Drifter[] = [];
  private beads: Bead[] = [];
  private sliders: Slider[] = [];
  private trails: { x: number; y: number; r: number; born: number }[] = [];
  private beadAcc = 0;
  private flakeAcc = 0;
  private slideAcc = 0;
  private pending = 0;
  private P: Painter;

  constructor(
    private canvas: HTMLCanvasElement,
    private pack: AnyPack,
    private opts: RendererOptions,
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.P = { par: (d) => this.par(d), shade: (c, env, depth) => this.shade(c, env, depth) };
    this.resize();
  }

  /** Swaps the scene; the sky, weather and glass carry on. */
  setPack(pack: AnyPack) {
    if (pack === this.pack) return;
    this.pack = pack;
    this.resize();
  }

  /** Moves the window sideways, e.g. to make room for a panel beside it. */
  setAlign(align: number) {
    if (align === this.opts.align) return;
    this.opts = { ...this.opts, align };
    this.resize();
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  private par(depth: number) {
    const k = 24 * this.geom.s * depth * (this.opts.parallax ?? 1);
    return { x: -this.pointer.x * k, y: -this.pointer.y * k * 0.5 };
  }

  private shade(c: RGB, env: FrameEnv, depth: number): RGB {
    const a = env.ambient;
    const lit: RGB = [c[0] * a[0], c[1] * a[1], c[2] * a[2]];
    return mixRGB(
      lit,
      env.sky.bottom,
      clamp(depth * (0.22 + 0.65 * env.fog + 0.25 * env.rain + 0.1 * env.cloud)),
    );
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const W = Math.max(1, rect.width),
      H = Math.max(1, rect.height);
    this.dpr = Math.min(this.opts.maxDpr ?? 2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    const g = (this.geom = computeGeom(W, H, this.opts));
    const rng = makeRng(20261015);
    this.stars = Array.from({ length: 160 }, () => ({
      x: rng(),
      y: rng() * 0.75,
      r: 0.5 + rng() * rng() * 1.6,
      p: rng() * 6.28,
      s: 0.5 + rng() * 2,
    }));
    this.clouds = Array.from({ length: 16 }, (_, i) => {
      const n = 4 + ((rng() * 5) | 0);
      return {
        x: rng() * 1.4 - 0.2,
        y: 0.04 + rng() * 0.48,
        sc: 0.6 + rng() * 0.9,
        thr: (i + 0.5) / 16,
        speed: 0.6 + rng() * 0.8,
        puffs: Array.from({ length: n }, (_, j) => ({
          dx: (j - n / 2) * (0.55 + rng() * 0.3),
          dy: (rng() - 0.5) * 0.5 - (Math.abs(j - n / 2) < 1.5 ? 0.4 : 0),
          r: 0.55 + rng() * 0.6,
        })),
      };
    });
    const area = Math.max(1, (g.w * g.h) / (700 * 540));
    this.rain = Array.from({ length: Math.round(520 * Math.min(area, 2.5)) }, () =>
      this.spawnRain(true, rng),
    );
    this.snow = Array.from({ length: Math.round(420 * Math.min(area, 2.5)) }, () =>
      this.spawnSnow(true, rng),
    );
    this.drifters = Array.from({ length: 9 }, () => this.spawnDrifter(true));
    this.beads = [];
    this.sliders = [];
    this.trails = [];
    this.data = this.pack.build(g, makeRng(7));
  }

  private spawnRain(initial: boolean, rng: Rng = Math.random): Drop {
    const g = this.geom;
    return {
      x: rng() * (g.w + 240) - 160,
      y: initial ? rng() * g.h : -rng() * 40 - 20,
      z: 0.25 + rng() * 0.75,
    };
  }

  private spawnSnow(initial: boolean, rng: Rng = Math.random): Flake {
    const g = this.geom;
    return {
      x: rng() * (g.w + 240) - 160,
      y: initial ? rng() * g.h : -rng() * 20 - 5,
      z: 0.2 + rng() * 0.8,
      p: rng() * 6.28,
    };
  }

  private spawnDrifter(initial: boolean): Drifter {
    const g = this.geom;
    return {
      x: Math.random() * g.w - g.w * 0.2,
      y: initial ? Math.random() * g.h : -12,
      z: 0.4 + Math.random() * 0.6,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 4,
      p: Math.random() * 6.28,
      hue: Math.random(),
    };
  }

  /** Advances by dt and draws, unless the frame-rate cap says to wait for the next tick. */
  tick(env: Environment, dt: number) {
    this.pending += dt;
    const min = this.opts.maxFps ? 1 / this.opts.maxFps : 0;
    if (this.pending < min) return;
    const step = Math.min(0.1, this.pending);
    this.pending = 0;
    const fe = Object.assign(Object.create(env) as Environment, { dt: step }) as FrameEnv;
    this.frame(fe);
  }

  private frame(env: FrameEnv) {
    const { ctx, geom: g } = this,
      dt = env.dt;
    const k = 1 - Math.exp(-dt * 2);
    this.pointer.x += (this.pointer.tx - this.pointer.x) * k;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * k;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (g.framed) this.pack.drawRoom(ctx, env, g, this.data, this.P);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.clip();
    this.drawSky(env);
    this.drawStars(env);
    this.drawAurora(env);
    this.drawCelestial(env);
    this.drawClouds(env);
    this.pack.drawLandscape(ctx, env, g, this.data, this.P);
    this.drawFog(env);
    this.drawDrifters(env);
    this.drawPrecip(env);
    this.pack.drawForeground(ctx, env, g, this.data, this.P);
    if (env.flash > 0.01) {
      ctx.fillStyle = rgba([225, 230, 255], env.flash * 0.55);
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
    if (g.framed) this.drawSettledSnow(env);
    this.drawGlass(env);
    ctx.restore();
    if (g.framed) {
      this.pack.drawInterior(ctx, env, g, this.data, this.P);
      this.drawTurntable(env);
    }
  }

  /** A record player on the sill while music plays: the album art spins on the label, and the arm lowers. */
  private drawTurntable(env: FrameEnv) {
    const m = env.music;
    const spot = (this.data as { turntable?: { x: number; y: number } } | null)?.turntable;
    if (m.on < 0.02 || !spot) return;
    const { ctx, geom: g } = this, s = g.s;
    const day = Math.min(1, (env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
    const lit = (c: RGB): RGB => [c[0] * (0.2 + 0.6 * day) + 60 * env.lamp, c[1] * (0.2 + 0.6 * day) + 36 * env.lamp, c[2] * (0.2 + 0.6 * day) + 14 * env.lamp];
    ctx.save();
    ctx.globalAlpha = m.on;
    // Plinth.
    const w = 176 * s, h = 24 * s, x = spot.x - w / 2, y = spot.y - h;
    ctx.fillStyle = rgba(lit([74, 50, 36]));
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4 * s);
    ctx.fill();
    ctx.fillStyle = rgba(lit([110, 78, 56]));
    ctx.fillRect(x + 2 * s, y, w - 4 * s, 2.5 * s);
    // Record, seen from just above.
    const cx = spot.x - 16 * s, cy = y - 1 * s, R = 66 * s, squash = 0.3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, squash);
    ctx.fillStyle = "#101012";
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1 / squash;
    for (let r = R * 0.45; r < R * 0.97; r += R * 0.07) {
      ctx.strokeStyle = `rgba(255,255,255,${0.035 + 0.02 * Math.sin(r)})`;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(m.spin);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.36, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    if (m.art) ctx.drawImage(m.art, -R * 0.36, -R * 0.36, R * 0.72, R * 0.72);
    else {
      ctx.fillStyle = rgba(env.lampColor);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = "#d8d2c4";
    ctx.beginPath();
    ctx.arc(0, 0, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A highlight that stays put while the record turns under it.
    ctx.strokeStyle = rgba([255, 240, 220], 0.12 + 0.1 * env.lamp);
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 0.8, R * 0.8 * squash, 0, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    // Tonearm: resting beside the record, or lowered onto it while playing.
    const px = x + w - 14 * s, py = y - 3 * s;
    const rest = { x: px - 6 * s, y: py + 1 * s }, play = { x: cx + R * 0.62, y: cy + 2 * s };
    const sx = rest.x + (play.x - rest.x) * m.arm, sy = rest.y + (play.y - rest.y) * m.arm - 4 * s * (1 - m.arm);
    ctx.strokeStyle = rgba(lit([196, 190, 180]));
    ctx.lineWidth = 2.4 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 4 * s, py - 10 * s);
    ctx.lineTo(sx, sy - 8 * s);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.fillStyle = rgba(lit([60, 58, 56]));
    ctx.beginPath();
    ctx.arc(px, py, 4.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSky(env: FrameEnv) {
    const { ctx, geom: g } = this;
    const grd = ctx.createLinearGradient(0, g.y, 0, g.horizon + g.h * 0.1);
    grd.addColorStop(0, rgba(env.sky.top));
    grd.addColorStop(0.55, rgba(mixRGB(env.sky.top, env.sky.bottom, 0.5)));
    grd.addColorStop(1, rgba(env.sky.bottom));
    ctx.fillStyle = grd;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }

  private drawStars(env: FrameEnv) {
    const a =
      Math.pow(env.night, 2) * Math.pow(1 - env.cloud, 1.5) * (1 - env.fog) * (1 - env.rain);
    if (a < 0.02) return;
    const { ctx, geom: g } = this,
      p = this.par(0.04);
    ctx.fillStyle = "#e8ecff";
    for (const s of this.stars) {
      ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(env.t * s.s + s.p));
      ctx.fillRect(g.x + s.x * g.w + p.x, g.y + s.y * g.h * 0.85 + p.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  /** Northern (or southern) lights: curtains of light on clear, dark nights at high latitudes. */
  private drawAurora(env: FrameEnv) {
    const lat = Math.abs(env.city.lat);
    const k =
      clamp((lat - 54) / 12) *
      smooth(0.75, 0.98, env.night) *
      Math.pow(clamp(1 - env.cloud * 1.2), 1.5) *
      (1 - env.fog) *
      (1 - env.rain);
    if (k < 0.02) return;
    const { ctx, geom: g } = this, t = env.t, p = this.par(0.06);
    const step = Math.max(3, g.w / 170);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const b of AURORA_BANDS) {
      const top = g.y + g.h * b.y + p.y, height = g.h * b.h;
      const grd = ctx.createLinearGradient(0, top - g.h * 0.07, 0, top + height + g.h * 0.07);
      grd.addColorStop(0, "rgba(180,90,210,0)");
      grd.addColorStop(0.3, "rgba(160,100,220,0.45)");
      grd.addColorStop(0.75, "rgba(90,255,170,0.9)");
      grd.addColorStop(1, "rgba(60,240,150,0)");
      ctx.fillStyle = grd;
      const x0 = b.x0 + Math.sin(t * 0.02 + b.ph) * 0.1, x1 = b.x1 + Math.sin(t * 0.017 + b.ph) * 0.1;
      for (let x = 0; x < g.w; x += step) {
        const u = x / g.w;
        const span = smooth(x0, x0 + 0.18, u) * (1 - smooth(x1 - 0.18, x1, u));
        if (span < 0.01) continue;
        const ray = 0.55 + 0.45 * Math.sin(u * 90 + t * 0.7 + b.ph * 3) * Math.sin(u * 31 - t * 0.4);
        const breathe = 0.75 + 0.25 * Math.sin(t * b.sp * 4 + b.ph);
        ctx.globalAlpha = k * 0.32 * ray * span * breathe;
        const wave = Math.sin(u * 5 + t * b.sp * 6 + b.ph) * 0.5 + Math.sin(u * 13 - t * b.sp * 9 + b.ph * 2) * 0.25;
        ctx.fillRect(g.x + x + p.x, top + wave * g.h * 0.06, step + 0.5, height);
      }
    }
    ctx.restore();
  }

  private drawCelestial(env: FrameEnv) {
    const { ctx, geom: g } = this;
    const facing = env.city.lat >= 0 ? 180 : 0;
    const pos = (alt: number, az: number) => {
      const rel = ((az - facing + 540) % 360) - 180,
        p = this.par(0.05);
      return {
        x: g.x + g.w * (0.5 + rel / 150) + p.x,
        y: g.horizon - (alt / 55) * g.h + p.y,
        vis: Math.abs(rel) < 90,
      };
    };
    const r = Math.min(g.w, g.h * 1.3) * 0.032;

    if (env.sunAlt > -3) {
      const s = pos(env.sunAlt, env.sunAz);
      const clear = 1 - env.cloud * 0.85 - env.fog * 0.5;
      if (s.vis && clear > 0) {
        const core = mixRGB([255, 248, 230], [255, 170, 110], 1 - smooth(2, 20, env.sunAlt));
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 9);
        glow.addColorStop(0, rgba(core, 0.55 * clear));
        glow.addColorStop(0.25, rgba(core, 0.18 * clear));
        glow.addColorStop(1, rgba(core, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.fillStyle = rgba(core, clear);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (env.moonAlt > -3 && env.dayness < 0.9) {
      const m = pos(env.moonAlt, env.moonAz);
      const vis = (1 - env.cloud * 0.8 - env.fog * 0.6) * (1 - env.dayness * 0.7);
      if (m.vis && vis > 0) {
        const mr = r * 0.8,
          p = env.moonPhase,
          lit = 1 - Math.abs(p - 0.5) * 2;
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, mr * 7);
        glow.addColorStop(0, rgba([200, 214, 255], 0.2 * vis * lit));
        glow.addColorStop(1, rgba([200, 214, 255], 0));
        ctx.fillStyle = glow;
        ctx.fillRect(g.x, g.y, g.w, g.h);
        ctx.fillStyle = rgba([236, 236, 226], vis);
        ctx.beginPath();
        ctx.arc(m.x, m.y, mr, 0, Math.PI * 2);
        ctx.fill();
        // Phase: cover the disc with a sky-coloured circle offset by the illuminated fraction.
        const d = mr * (1 - Math.cos(p * Math.PI * 2)),
          dir = p < 0.5 ? -1 : 1;
        const skyHere = mixRGB(
          env.sky.top,
          env.sky.bottom,
          clamp((m.y - g.y) / (g.horizon + g.h * 0.1 - g.y)),
        );
        ctx.save();
        ctx.beginPath();
        ctx.arc(m.x, m.y, mr + 0.5, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = rgba(skyHere, 0.94);
        ctx.beginPath();
        ctx.arc(m.x + dir * d, m.y, mr + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawClouds(env: FrameEnv) {
    const { ctx, geom: g } = this,
      dt = env.dt,
      p = this.par(0.1);
    const lit = mixRGB([44, 50, 72], [240, 242, 246], env.dayness);
    const warm = mixRGB(lit, [255, 178, 140], env.golden * 0.6);
    const top = mixRGB(
      warm,
      mixRGB([40, 44, 56], [118, 122, 132], env.dayness),
      env.rain * 0.6 + clamp(env.cloud - 0.7) * 0.8,
    );
    const under: RGB = mixRGB(top, env.sky.top, 0.35).map((v) => v * 0.86) as RGB;
    const unit = Math.min(g.w, g.h * 1.4) * 0.055;
    for (const c of this.clouds) {
      c.x += dt * (0.004 + env.wind * 0.025) * c.speed;
      if (c.x > 1.25) c.x -= 1.5;
      const vis = smooth(c.thr - 0.12, c.thr + 0.04, env.cloud);
      if (vis < 0.01) continue;
      const u = unit * c.sc,
        cx = g.x + c.x * g.w + p.x,
        cy = g.y + c.y * g.h + p.y;
      ctx.globalAlpha = vis * 0.92;
      for (const [col, oy, rs] of [
        [under, u * 0.18, 1],
        [top, 0, 0.92],
      ] as const) {
        ctx.fillStyle = rgba(col);
        ctx.beginPath();
        for (const q of c.puffs) {
          const px = cx + q.dx * u,
            py = cy + q.dy * u + oy,
            pr = q.r * u * rs;
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    const deck = clamp((env.cloud - 0.55) / 0.45);
    if (deck > 0) {
      const col = mixRGB(top, under, 0.5);
      const grd = ctx.createLinearGradient(0, g.y, 0, g.y + g.h * 0.7);
      grd.addColorStop(0, rgba(col, deck * 0.75));
      grd.addColorStop(1, rgba(col, deck * 0.12));
      ctx.fillStyle = grd;
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
  }

  private drawFog(env: FrameEnv) {
    const haze = clamp(env.fog + env.rain * 0.25);
    if (haze < 0.02) return;
    const { ctx, geom: g } = this,
      c = env.sky.bottom;
    const grd = ctx.createLinearGradient(0, g.y, 0, g.y + g.h);
    grd.addColorStop(0, rgba(c, haze * 0.3));
    grd.addColorStop(1, rgba(c, haze * 0.6));
    ctx.fillStyle = grd;
    ctx.fillRect(g.x, g.y, g.w, g.h);
  }

  /** Petals in spring, leaves in autumn. */
  private drawDrifters(env: FrameEnv) {
    let n = env.season === "autumn" ? 3 + env.wind * 6 : env.season === "spring" ? 5 : 0;
    n = Math.round(n * (1 - env.rain * 0.7) * (1 - env.snow));
    if (!n) return;
    const { ctx, geom: g } = this,
      dt = env.dt,
      s = g.h / 600;
    for (const d of this.drifters.slice(0, n)) {
      d.y += (30 + 30 * d.z) * s * dt;
      d.x += (env.wind * 90 + Math.sin(env.t * 1.3 + d.p) * 30) * s * dt * d.z;
      d.rot += d.vr * dt;
      if (d.y > g.h + 12 || d.x > g.w + 20) Object.assign(d, this.spawnDrifter(false));
      const base =
        env.season === "spring"
          ? mixRGB([246, 198, 212], [250, 236, 238], d.hue)
          : mixRGB([196, 96, 44], [226, 160, 64], d.hue);
      ctx.save();
      ctx.translate(g.x + d.x, g.y + d.y);
      ctx.rotate(d.rot);
      ctx.scale(1, Math.abs(Math.sin(d.rot * 0.7)) + 0.25);
      ctx.fillStyle = rgba(this.shade(base, env, 0.1));
      ctx.beginPath();
      ctx.ellipse(0, 0, (3 + 3 * d.z) * s * 1.3, (1.6 + 1.5 * d.z) * s * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPrecip(env: FrameEnv) {
    const { ctx, geom: g } = this,
      dt = env.dt,
      s = Math.min(g.h, 900) / 600;
    const nRain = Math.round(this.rain.length * clamp(env.rain) * (this.reduced ? 0.4 : 1));
    if (nRain) {
      const slant = env.wind * 0.45 + 0.05;
      const col = mixRGB([150, 160, 182], [214, 222, 236], env.dayness);
      ctx.lineCap = "round";
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        ctx.lineWidth = layer ? 1.3 : 0.8;
        ctx.strokeStyle = rgba(col, layer ? 0.42 : 0.24);
        for (let i = layer; i < nRain; i += 2) {
          const d = this.rain[i]!;
          const v = (700 + 700 * d.z) * s;
          d.y += v * dt;
          d.x += v * slant * dt;
          if (d.y > g.h + 20 || d.x > g.w + 120) Object.assign(d, this.spawnRain(false));
          const len = (14 + 22 * d.z) * s,
            x = g.x + d.x,
            y = g.y + d.y;
          ctx.moveTo(x, y);
          ctx.lineTo(x - slant * len, y - len);
        }
        ctx.stroke();
      }
    }
    const nSnow = Math.round(this.snow.length * clamp(env.snow) * (this.reduced ? 0.5 : 1));
    if (nSnow) {
      ctx.fillStyle = rgba(mixRGB([170, 182, 210], [250, 252, 255], Math.max(env.dayness, 0.3)));
      for (const f of this.snow.slice(0, nSnow)) {
        f.y += (22 + 48 * f.z) * s * dt;
        f.x += (env.wind * 70 * f.z + Math.sin(env.t * 0.9 + f.p) * 14 * f.z) * s * dt;
        if (f.y > g.h + 10) Object.assign(f, this.spawnSnow(false));
        if (f.x > g.w + 100) f.x -= g.w + 240;
        ctx.globalAlpha = 0.45 + 0.55 * f.z;
        ctx.beginPath();
        ctx.arc(g.x + f.x, g.y + f.y, (0.7 + 2.1 * f.z) * s * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** Snow banking up against the bottom of each pane, deeper in the corners. */
  private drawSettledSnow(env: FrameEnv) {
    if (env.snowCover < 0.02) return;
    const { ctx, geom: g } = this;
    ctx.fillStyle = rgba(this.shade([238, 242, 250], env, 0));
    g.panes.forEach((pn, i) => {
      const base = pn.y + pn.h,
        amt = env.snowCover * (i > 1 ? 1 : 0.55) * g.h * 0.05;
      ctx.beginPath();
      ctx.moveTo(pn.x, base);
      for (let k = 0; k <= 24; k++) {
        const u = k / 24,
          edge = Math.pow(Math.abs(u - 0.5) * 2, 3);
        ctx.lineTo(
          pn.x + u * pn.w,
          base - amt * (0.75 + 0.9 * edge + 0.12 * Math.sin(u * 19 + i * 3)),
        );
      }
      ctx.lineTo(pn.x + pn.w, base);
      ctx.closePath();
      ctx.fill();
    });
  }

  private drawGlass(env: FrameEnv) {
    const { ctx, geom: g } = this,
      dt = env.dt;
    const wet = clamp(env.rain * 1.1);
    const scale = Math.max(0.8, g.s * 1.4);
    const area = (g.w * g.h) / (700 * 540);
    const target = Math.round(wet * 220 * Math.min(area, 3));

    // Beads land while it rains and slowly evaporate after.
    this.beadAcc += wet * 90 * dt;
    while (this.beadAcc >= 1) {
      this.beadAcc -= 1;
      if (this.beads.length < target)
        this.beads.push({
          x: g.x + Math.random() * g.w,
          y: g.y + Math.random() * g.h,
          r: (1 + Math.random() * Math.random() * 3.2) * scale,
          snow: false,
          life: 1,
          decay: 0,
        });
    }
    // Flakes stick to the glass and melt.
    this.flakeAcc += env.snow * 10 * (0.4 + env.wind) * dt;
    while (this.flakeAcc >= 1) {
      this.flakeAcc -= 1;
      this.beads.push({
        x: g.x + Math.random() * g.w,
        y: g.y + Math.random() * g.h,
        r: (1.2 + Math.random() * 1.8) * scale,
        snow: true,
        life: 1,
        decay: 1 / (4 + Math.random() * 6),
      });
    }
    this.beads = this.beads.filter((b) => {
      if (b.snow) b.life -= dt * b.decay;
      else if (wet < 0.05) b.r -= dt * 0.25;
      return b.snow ? b.life > 0 : b.r >= 0.5;
    });

    // Heavy drops run down in stops and starts, collecting beads and leaving a trail.
    this.slideAcc += wet * 1.4 * Math.min(area, 3) * dt;
    if (this.slideAcc >= 1) {
      this.slideAcc -= 1;
      if (this.sliders.length < 14 * Math.min(area, 3)) {
        this.sliders.push({
          x: g.x + Math.random() * g.w,
          y: g.y + Math.random() * g.h * 0.5,
          r: (2.6 + Math.random() * 1.8) * scale,
          v: 0,
          pause: 0,
          lx: -1,
          ly: -1,
        });
      }
    }
    for (const sl of this.sliders) {
      if (sl.pause > 0) sl.pause -= dt;
      else {
        sl.v = Math.min(sl.v + 300 * dt, 50 + sl.r * 14);
        if (Math.random() < dt * 1.5) {
          sl.pause = Math.random() * 0.6;
          sl.v = 0;
        }
        sl.y += sl.v * dt;
        sl.x += Math.sin(sl.y * 0.05 + sl.r) * 0.25;
      }
      if (Math.hypot(sl.x - sl.lx, sl.y - sl.ly) > 2) {
        this.trails.push({ x: sl.x, y: sl.y, r: sl.r * 0.38, born: env.t });
        sl.lx = sl.x;
        sl.ly = sl.y;
      }
      this.beads = this.beads.filter((b) => {
        const hit =
          !b.snow && Math.abs(b.x - sl.x) < sl.r + b.r && Math.abs(b.y - sl.y) < sl.r + b.r;
        if (hit) sl.r = Math.min(sl.r + b.r * 0.12, 6.5 * scale);
        return !hit;
      });
    }
    this.sliders = this.sliders.filter((sl) => sl.y <= g.y + g.h + 10);
    if (this.trails.length > 900) this.trails.splice(0, this.trails.length - 900);
    while (this.trails.length && env.t - this.trails[0]!.born > 5) this.trails.shift();

    const dropAlpha = 0.55 + 0.45 * Math.max(env.dayness, env.lamp * 0.6);
    for (const tr of this.trails) {
      ctx.globalAlpha = 0.5 * dropAlpha * (1 - (env.t - tr.born) / 5);
      ctx.drawImage(this.dropSprite, tr.x - tr.r, tr.y - tr.r, tr.r * 2, tr.r * 2);
    }
    for (const b of this.beads) {
      ctx.globalAlpha = b.snow ? Math.min(1, b.life * 2) * 0.9 : dropAlpha;
      ctx.drawImage(
        b.snow ? this.flakeSprite : this.dropSprite,
        b.x - b.r * 1.07,
        b.y - b.r * 1.07,
        b.r * 2.14,
        b.r * 2.14,
      );
    }
    ctx.globalAlpha = dropAlpha;
    for (const sl of this.sliders)
      ctx.drawImage(
        this.dropSprite,
        sl.x - sl.r * 1.07,
        sl.y - sl.r * 1.25,
        sl.r * 2.14,
        sl.r * 2.5,
      );
    ctx.globalAlpha = 1;

    // Frost creeping in from the corners below freezing.
    if (env.temp < 0) {
      const k = clamp(-env.temp / 12) * 0.5;
      for (const pn of g.panes) {
        const R = Math.min(pn.w, pn.h) * 0.45;
        for (const [cx, cy] of [
          [pn.x, pn.y],
          [pn.x + pn.w, pn.y],
          [pn.x, pn.y + pn.h],
          [pn.x + pn.w, pn.y + pn.h],
        ] as const) {
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
          grd.addColorStop(0, rgba([225, 235, 248], k));
          grd.addColorStop(1, rgba([225, 235, 248], 0));
          ctx.fillStyle = grd;
          ctx.fillRect(pn.x, pn.y, pn.w, pn.h);
        }
      }
    }

    if (g.framed) {
      const sheen = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y + g.h);
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.42, "rgba(255,255,255,0.035)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0)");
      sheen.addColorStop(0.62, "rgba(255,255,255,0.025)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(g.x, g.y, g.w, g.h);
    }
  }
}
