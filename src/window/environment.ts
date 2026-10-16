/** Turns (city, time, weather) into the eased values the renderer and audio read: sky colour, ambient light,
 *  lamp and fire state, settling snow and lightning timing. */
import { localParts, moonPosition, seasonFor, sunPosition, type Season } from "./astro";
import type { City } from "./cities";
import { clamp, ease, lerp, mapRGB, mixRGB, smooth, type RGB } from "./util";
import type { Weather } from "./weather";
import type { MusicState } from "../music";

const LAMP: RGB = [255, 176, 96];

const SKY: { alt: number; top: RGB; bottom: RGB }[] = [
  { alt: -18, top: [7, 9, 20], bottom: [16, 19, 36] },
  { alt: -10, top: [12, 16, 38], bottom: [34, 34, 66] },
  { alt: -4, top: [30, 40, 84], bottom: [148, 92, 100] },
  { alt: 0, top: [58, 82, 138], bottom: [236, 148, 108] },
  { alt: 6, top: [78, 118, 178], bottom: [244, 194, 150] },
  { alt: 15, top: [70, 126, 198], bottom: [178, 206, 230] },
  { alt: 50, top: [50, 108, 192], bottom: [160, 198, 232] },
];

function skyAt(alt: number): { top: RGB; bottom: RGB } {
  let prev = SKY[0]!;
  if (alt <= prev.alt) return prev;
  for (const k of SKY.slice(1)) {
    if (alt <= k.alt) {
      const t = (alt - prev.alt) / (k.alt - prev.alt);
      return { top: mixRGB(prev.top, k.top, t), bottom: mixRGB(prev.bottom, k.bottom, t) };
    }
    prev = k;
  }
  return prev;
}

const grey = (c: RGB): RGB => {
  const l = c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
  return [l, l * 1.01, l * 1.05];
};

export const FALLBACK_WEATHER: Weather = {
  code: 2,
  label: "Partly cloudy",
  cloud: 0.5,
  rain: 0,
  snow: 0,
  fog: 0,
  thunder: false,
  temp: 12,
  wind: 8,
  updated: null,
};

type Eased = {
  dayness: number;
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  wind: number;
  temp: number;
  lamp: number;
  fire: number;
};
// Seconds each value takes to settle: the lamp switches on quickly, weather drifts in.
const TAU: Eased = {
  dayness: 3,
  lamp: 0.8,
  fire: 3,
  cloud: 6,
  rain: 5,
  snow: 6,
  fog: 8,
  wind: 4,
  temp: 10,
};
const KEYS = Object.keys(TAU) as (keyof Eased)[];

export class Environment implements Eased {
  t = 0;
  city: City;
  weather: Weather = FALLBACK_WEATHER;
  sunAlt = 30;
  sunAz = 180;
  moonAlt = -10;
  moonAz = 0;
  moonPhase = 0;
  localHour = 12;
  season: Season = "summer";
  dayness = 1;
  cloud = 0.3;
  rain = 0;
  snow = 0;
  fog = 0;
  wind = 0.2;
  temp = 12;
  lamp = 0;
  fire = 0;
  snowCover = 0;
  flash = 0;
  golden = 0;
  night = 0;
  sky: { top: RGB; bottom: RGB } = { top: [70, 126, 198], bottom: [178, 206, 230] };
  ambient: RGB = [1, 1, 1];
  onThunder: ((distance: number) => void) | null = null;
  /** Music in the room: how present the record player is (eased 0..1), the platter's angle, and the album art. */
  music = { on: 0, playing: false, spin: 0, arm: 0, art: null as CanvasImageSource | null };
  /** The lamp's colour, tinted by the album art while music plays. */
  lampColor: RGB = LAMP;
  private astroAt = 0;
  private fresh = true;
  private flashQueue: { at: number; v: number }[] = [];
  private nextStrike = 6;

  constructor(city: City) {
    this.city = city;
  }

  setCity(city: City) {
    this.city = city;
    this.astroAt = 0;
    this.fresh = true;
  }

  /** snap: jump straight to the new weather instead of easing (first reading for a city). */
  setWeather(w: Weather, snap = false) {
    this.weather = w;
    if (snap) this.fresh = true;
  }

  update(date: Date, dt: number) {
    this.t += dt;
    const c = this.city,
      w = this.weather;
    if (Math.abs(date.getTime() - this.astroAt) > 1000) {
      const s = sunPosition(date, c.lat, c.lon),
        m = moonPosition(date, c.lat, c.lon),
        lp = localParts(date, c.tz);
      this.sunAlt = s.altitude;
      this.sunAz = s.azimuth;
      this.moonAlt = m.altitude;
      this.moonAz = m.azimuth;
      this.moonPhase = m.phase;
      this.localHour = lp.hour + lp.minute / 60;
      this.season = seasonFor(lp.month, c.lat);
      this.astroAt = date.getTime();
    }

    const asleep = this.localHour >= 1 && this.localHour < 5.5;
    const gloomy = w.cloud > 0.85 && this.sunAlt < 14;
    const lamp = !asleep && (this.sunAlt < 3 || gloomy) ? 1 : 0;
    const tgt: Eased = {
      dayness: smooth(-7, 4, this.sunAlt),
      cloud: w.cloud,
      rain: w.rain,
      snow: w.snow,
      fog: w.fog,
      wind: clamp(w.wind / 45),
      temp: w.temp,
      lamp,
      fire: !asleep && w.temp < 8 && (lamp || w.temp < -4) ? 1 : 0,
    };

    if (this.fresh) {
      for (const k of KEYS) this[k] = tgt[k];
      this.snowCover = w.snow > 0 ? 0.55 : w.temp < 0 && this.season === "winter" ? 0.45 : 0;
      this.fresh = false;
    } else {
      for (const k of KEYS) this[k] = ease(this[k], tgt[k], dt, TAU[k]);
      if (this.snow > 0.05) this.snowCover = Math.min(1, this.snowCover + dt * this.snow * 0.025);
      else if (this.temp > 1.5)
        this.snowCover = Math.max(0, this.snowCover - dt * 0.0015 * (this.temp - 1));
    }

    this.updateLightning(dt);
    this.updateLight();
  }

  updateMusic(m: MusicState, dt: number) {
    const mu = this.music, playing = m.np?.state === "playing";
    mu.on = ease(mu.on, m.np ? 1 : 0, dt, 0.6);
    mu.arm = ease(mu.arm, playing ? 1 : 0, dt, 0.5);
    mu.playing = playing;
    // 33⅓ rpm, spinning up and down rather than starting instantly.
    mu.spin = (mu.spin + dt * Math.PI * 2 * (33.33 / 60) * mu.arm) % (Math.PI * 2);
    mu.art = m.art;
    const tint = m.tint ? mixRGB(LAMP, mixRGB(m.tint, [255, 255, 255], 0.25), 0.45 * mu.arm) : LAMP;
    this.lampColor = mixRGB(this.lampColor, tint, 1 - Math.exp(-dt / 1.5));
  }

  private updateLightning(dt: number) {
    if (this.weather.thunder) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = 7 + Math.random() * 18;
        const dist = Math.random();
        this.flashQueue.push(
          { at: this.t, v: 1 - dist * 0.5 },
          { at: this.t + 0.09 + Math.random() * 0.12, v: 0.6 - dist * 0.3 },
        );
        this.onThunder?.(dist);
      }
    }
    this.flash *= Math.exp(-dt * 6);
    while (this.flashQueue.length && this.flashQueue[0]!.at <= this.t)
      this.flash = Math.max(this.flash, this.flashQueue.shift()!.v);
  }

  private updateLight() {
    const base = skyAt(this.sunAlt);
    const ov = this.cloud * 0.78 + this.rain * 0.15;
    const dim = 1 - 0.28 * this.cloud - 0.18 * this.rain;
    let top = mapRGB(mixRGB(base.top, grey(base.top), ov), (v) => v * dim);
    let bottom = mapRGB(mixRGB(base.bottom, grey(base.bottom), ov * 0.9), (v) => v * dim);
    if (this.fog > 0.01) {
      const fogc = mixRGB([60, 64, 76], [196, 200, 206], this.dayness);
      top = mixRGB(top, fogc, this.fog * 0.6);
      bottom = mixRGB(bottom, fogc, this.fog * 0.85);
    }
    this.sky = { top, bottom };

    const level =
      lerp(0.13, 1, smooth(-8, 12, this.sunAlt)) * (1 - 0.32 * this.cloud - 0.15 * this.rain);
    const moonFull = 1 - Math.abs(this.moonPhase - 0.5) * 2;
    const moonLight =
      this.moonAlt > 0 ? 0.07 * moonFull * (1 - this.cloud) * (1 - this.dayness) : 0;
    this.golden =
      smooth(-4, 1, this.sunAlt) * (1 - smooth(4, 14, this.sunAlt)) * (1 - this.cloud * 0.8);
    const tint = mixRGB(
      mixRGB([0.55, 0.64, 1], [1, 1, 1], this.dayness),
      [1.12, 0.86, 0.7],
      this.golden,
    );
    this.ambient = mapRGB(tint, (v) => v * (level + moonLight));
    this.night = 1 - this.dayness;
  }
}
