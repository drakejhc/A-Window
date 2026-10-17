/** Life in the sky beyond the window, each tied to the real place, date and weather: shooting stars (many more on
 *  the nights of the year's great meteor showers), planes, flocks of birds at dawn and dusk, a rainbow when the sun
 *  comes out after rain, fireflies on warm summer nights in the country, and fireworks at midnight on New Year's
 *  Eve. Every view gets them; the renderer calls the three draws at their depths. */
import type { FrameEnv, Geom } from "./types";
import { clamp, mixRGB, rgba, smooth, type RGB } from "./util";

type Par = (depth: number) => { x: number; y: number };

/** Peak nights of the major annual showers, as [month, first day, last day], local date. */
const SHOWERS: [number, number, number][] = [
  [1, 3, 4], // Quadrantids
  [4, 22, 23], // Lyrids
  [5, 5, 6], // Eta Aquariids
  [8, 11, 13], // Perseids
  [10, 21, 22], // Orionids
  [11, 17, 18], // Leonids
  [12, 13, 15], // Geminids
];

type Meteor = { x: number; y: number; vx: number; vy: number; life: number; age: number; len: number };
type Plane = { x: number; y: number; v: number; dir: number; day: boolean; trail: { x: number; y: number }[] };
type Bird = { dx: number; dy: number; ph: number };
type Flock = { x: number; y: number; v: number; dir: number; birds: Bird[]; size: number };
type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; color: RGB };
type Firefly = { x: number; y: number; ph: number; sp: number };

/** Seconds until the next event, at a mean interval. */
const wait = (mean: number) => -Math.log(1 - Math.random() * 0.98) * mean;

export class SkyLife {
  private meteors: Meteor[] = [];
  private nextMeteor = wait(60);
  private plane: Plane | null = null;
  private nextPlane = wait(90);
  private flock: Flock | null = null;
  private nextFlock = wait(40);
  private sparks: Spark[] = [];
  private nextBurst = 0;
  private fireflies: Firefly[] = Array.from({ length: 16 }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.4, ph: Math.random() * 9, sp: 0.6 + Math.random() * 0.8 }));
  /** How recently it rained, 1 just after to 0 some twenty minutes later. */
  private wet = 0;

  /** High in the sky, behind the clouds: shooting stars and planes' lights. */
  drawHigh(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    const clear = Math.pow(clamp(1 - env.cloud * 1.15), 1.5) * (1 - env.fog) * (1 - env.rain);
    this.meteorsFrame(ctx, env, g, par, Math.pow(env.night, 2) * clear);
    this.planeFrame(ctx, env, g, par);
  }

  /** In front of the clouds, behind the land: the rainbow, birds and fireworks. */
  drawMid(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    this.rainbowFrame(ctx, env, g, par);
    this.flockFrame(ctx, env, g, par);
    this.fireworksFrame(ctx, env, g, par);
  }

  /** Close by, in front of the land: fireflies, in country views. */
  drawNear(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, country: boolean) {
    const summer = env.season === "summer" ? 1 : env.season === "spring" && env.temp > 18 ? 0.5 : 0;
    const k = country ? summer * smooth(0.55, 0.85, env.night) * smooth(14, 18, env.temp) * (1 - env.rain) * clamp(1.4 - env.wind) : 0;
    if (k < 0.02) return;
    const s = g.h / 600, t = env.t;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of this.fireflies) {
      f.x = (f.x + Math.sin(t * 0.3 * f.sp + f.ph) * 0.0004 + 1) % 1;
      const y = f.y + Math.sin(t * 0.5 * f.sp + f.ph * 2) * 0.03;
      const blink = Math.pow(Math.max(0, Math.sin(t * 0.9 * f.sp + f.ph)), 6);
      if (blink < 0.02) continue;
      const x = g.x + f.x * g.w, yy = g.y + y * g.h, r = 13 * s;
      const grd = ctx.createRadialGradient(x, yy, 0, x, yy, r);
      grd.addColorStop(0, `rgba(236,255,150,${0.95 * blink * k})`);
      grd.addColorStop(0.25, `rgba(200,250,110,${0.4 * blink * k})`);
      grd.addColorStop(1, "rgba(160,230,80,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, yy - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  private meteorsFrame(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par, vis: number) {
    const shower = SHOWERS.some(([m, d0, d1]) => env.localMonth === m && env.localDay >= d0 && env.localDay <= d1);
    if (vis > 0.15) {
      this.nextMeteor -= env.dt;
      if (this.nextMeteor <= 0) {
        this.nextMeteor = wait(shower ? 22 : 150);
        const a = 0.35 + Math.random() * 0.5, dir = Math.random() < 0.5 ? -1 : 1, sp = 0.9 + Math.random() * 0.8;
        this.meteors.push({ x: 0.15 + Math.random() * 0.7, y: 0.05 + Math.random() * 0.35, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.6, age: 0, len: 0.05 + Math.random() * 0.07 });
      }
    }
    if (!this.meteors.length) return;
    const p = par(0.03);
    ctx.save();
    ctx.lineCap = "round";
    for (const m of this.meteors) {
      m.age += env.dt;
      const u = m.age / m.life, fade = Math.sin(Math.PI * clamp(u)) * vis;
      const hx = g.x + (m.x + m.vx * m.age * 0.5) * g.w + p.x, hy = g.y + (m.y + m.vy * m.age * 0.5) * g.h + p.y;
      const tx = hx - m.vx * m.len * g.w, ty = hy - m.vy * m.len * g.h;
      const grd = ctx.createLinearGradient(hx, hy, tx, ty);
      grd.addColorStop(0, `rgba(255,255,240,${fade})`);
      grd.addColorStop(1, "rgba(200,220,255,0)");
      ctx.strokeStyle = grd;
      ctx.lineWidth = Math.max(1, g.h / 500);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.restore();
    this.meteors = this.meteors.filter((m) => m.age < m.life);
  }

  private planeFrame(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    const s = g.h / 600;
    if (!this.plane) {
      this.nextPlane -= env.dt;
      if (this.nextPlane > 0) return;
      this.nextPlane = wait(240);
      const day = env.dayness > 0.5;
      // By day a plane is only worth seeing (and leaves a trail) in a fairly clear sky.
      if (day && env.cloud > 0.6) return;
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.plane = { x: dir > 0 ? -0.05 : 1.05, y: 0.08 + Math.random() * 0.3, v: (0.011 + Math.random() * 0.006) * dir, dir, day, trail: [] };
    }
    const pl = this.plane, p = par(0.04);
    pl.x += pl.v * env.dt;
    pl.y -= 0.0006 * env.dt;
    if (pl.x < -0.1 || pl.x > 1.1) {
      this.plane = null;
      return;
    }
    const x = g.x + pl.x * g.w + p.x, y = g.y + pl.y * g.h + p.y;
    if (pl.day) {
      // A tiny silhouette drawing a contrail that spreads and fades behind it.
      pl.trail.push({ x: pl.x, y: pl.y });
      if (pl.trail.length > 400) pl.trail.shift();
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 1; i < pl.trail.length; i += 2) {
        const a = pl.trail[i - 1]!, b = pl.trail[i]!, age = (pl.trail.length - i) / pl.trail.length;
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - age) * (1 - env.cloud)})`;
        ctx.lineWidth = (1.5 + age * 5) * s;
        ctx.beginPath();
        ctx.moveTo(g.x + a.x * g.w + p.x, g.y + a.y * g.h + p.y);
        ctx.lineTo(g.x + b.x * g.w + p.x, g.y + b.y * g.h + p.y);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(230,232,240,0.9)";
      ctx.beginPath();
      ctx.ellipse(x, y, 3.2 * s, 0.9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    // At night, just its lights: a steady wingtip light and a double white strobe.
    const vis = env.night * (1 - env.fog) * clamp(1.2 - env.cloud);
    const tt = env.t % 1.4, strobe = tt < 0.06 || (tt > 0.18 && tt < 0.24) ? 1 : 0;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,70,60,${0.85 * vis})`;
    ctx.fillRect(x - 1.2 * s, y - 1.2 * s, 2.4 * s, 2.4 * s);
    if (strobe) {
      ctx.fillStyle = `rgba(255,255,255,${vis})`;
      ctx.fillRect(x + 4 * s * pl.dir - 1.4 * s, y - 1.4 * s, 2.8 * s, 2.8 * s);
    }
    ctx.restore();
  }

  private flockFrame(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    const s = g.h / 600;
    if (!this.flock) {
      this.nextFlock -= env.dt;
      if (this.nextFlock > 0) return;
      const h = env.localHour, twilight = (h > 5.5 && h < 9) || (h > 16.5 && h < 20) ? 1 : 0;
      this.nextFlock = wait(twilight ? 70 : 200);
      if (env.dayness < 0.35 || env.rain > 0.2 || env.snow > 0.4 || env.fog > 0.5) return;
      if (env.season === "winter" && Math.random() < 0.6) return;
      const dir = Math.random() < 0.5 ? -1 : 1, n = 4 + Math.floor(Math.random() * 8), vee = Math.random() < 0.5;
      const birds = Array.from({ length: n }, (_, i) => {
        const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2);
        return vee ? { dx: -rank * 0.018 * dir, dy: side * rank * 0.012, ph: Math.random() * 6 } : { dx: (Math.random() - 0.5) * 0.08, dy: (Math.random() - 0.5) * 0.06, ph: Math.random() * 6 };
      });
      this.flock = { x: dir > 0 ? -0.12 : 1.12, y: 0.15 + Math.random() * 0.25, v: (0.035 + Math.random() * 0.02) * dir, dir, birds, size: 0.8 + Math.random() * 0.5 };
    }
    const f = this.flock, p = par(0.12);
    f.x += f.v * env.dt;
    f.y += Math.sin(env.t * 0.4) * 0.002 * env.dt;
    if (f.x < -0.25 || f.x > 1.25) {
      this.flock = null;
      return;
    }
    // Dark against the sky, softened by haze.
    const c = mixRGB([34, 32, 40], env.sky.bottom, 0.35 + env.fog * 0.4);
    ctx.save();
    ctx.strokeStyle = rgba(c, 0.85);
    ctx.lineWidth = Math.max(1, 1.3 * s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const b of f.birds) {
      const x = g.x + (f.x + b.dx) * g.w + p.x, y = g.y + (f.y + b.dy) * g.h + p.y;
      const w = 5 * s * f.size, flap = Math.sin(env.t * 9 + b.ph) * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - w, y - w * 0.35 * flap);
      ctx.quadraticCurveTo(x - w * 0.4, y - w * 0.15 - w * 0.3 * flap, x, y);
      ctx.quadraticCurveTo(x + w * 0.4, y - w * 0.15 - w * 0.3 * flap, x + w, y - w * 0.35 * flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  private rainbowFrame(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    if (env.rain > 0.25) this.wet = 1;
    else this.wet = Math.max(0, this.wet - env.dt / 1200);
    // The sun must be out and low enough, with rain still in the air or just passed.
    const k = this.wet * smooth(3, 9, env.sunAlt) * (1 - smooth(34, 42, env.sunAlt)) * clamp(1.4 - env.cloud * 1.4) * (1 - env.fog);
    if (k < 0.02) return;
    // Centred on the point opposite the sun, mapped the way the sun and moon are.
    const facing = env.city.lat >= 0 ? 180 : 0;
    // Pulled into view: it stays on the side of the sky away from the sun, but always within the glass.
    const rel = clamp(((env.sunAz + 180 - facing + 540) % 360) - 180, -35, 35);
    const p = par(0.06);
    // A true circle 42° across from that point, which sits as far below the horizon as the sun is above it.
    const r = Math.min(g.w * 0.36, g.h * 0.75);
    const cx = g.x + g.w * (0.5 + rel / 150) + p.x, cy = g.horizon + (env.sunAlt / 42) * r + p.y;
    const rx = r, ry = r;
    const bands: RGB[] = [[150, 60, 200], [70, 90, 230], [60, 170, 220], [90, 200, 110], [240, 220, 80], [250, 150, 60], [230, 70, 60]];
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const bw = ry * 0.016;
    bands.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.22 * k);
      ctx.lineWidth = bw * 1.6;
      ctx.beginPath();
      const r = 1 - (bands.length - 1 - i) * 0.016;
      ctx.ellipse(cx, cy, rx * r, ry * r, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  private fireworksFrame(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, par: Par) {
    const h = env.localHour;
    const newYear = (env.localMonth === 12 && env.localDay === 31 && h >= 23.97) || (env.localMonth === 1 && env.localDay === 1 && h < 0.4);
    if (newYear && env.night > 0.5 && env.rain < 0.6) {
      this.nextBurst -= env.dt;
      if (this.nextBurst <= 0) {
        this.nextBurst = 0.4 + Math.random() * (h < 0.1 ? 0.8 : 2.2);
        const x = 0.15 + Math.random() * 0.7, y = 0.18 + Math.random() * 0.25;
        const palette: RGB[] = [[255, 90, 90], [255, 200, 90], [120, 200, 255], [190, 130, 255], [140, 255, 170], [255, 255, 230]];
        const color = palette[Math.floor(Math.random() * palette.length)]!, n = 36 + Math.floor(Math.random() * 24), sp = 0.12 + Math.random() * 0.08;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.1, v = sp * (0.85 + Math.random() * 0.3);
          this.sparks.push({ x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, age: 0, life: 1.4 + Math.random() * 0.8, color });
        }
      }
    }
    if (!this.sparks.length) return;
    const s = g.h / 600, p = par(0.08);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const k of this.sparks) {
      k.age += env.dt;
      k.vx *= Math.exp(-env.dt * 1.6);
      k.vy = k.vy * Math.exp(-env.dt * 1.6) + 0.05 * env.dt;
      k.x += k.vx * env.dt;
      k.y += k.vy * env.dt;
      const a = (1 - k.age / k.life) * (k.age < 0.08 ? k.age / 0.08 : 1);
      if (a <= 0) continue;
      // Each spark a short streak along its path.
      const x = g.x + k.x * g.w + p.x, y = g.y + k.y * g.h + p.y;
      ctx.strokeStyle = rgba(k.color, a);
      ctx.lineWidth = (1.2 + (1 - k.age / k.life)) * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - k.vx * g.w * 0.08, y - k.vy * g.h * 0.08);
      ctx.stroke();
    }
    ctx.restore();
    this.sparks = this.sparks.filter((k) => k.age < k.life);
  }
}
