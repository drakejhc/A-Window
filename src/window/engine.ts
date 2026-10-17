/**
 * The live window: one clock, weather feed and soundscape shared by every canvas on the page.
 * React reads it through useSyncExternalStore (see src/ui/use-window.ts); it is created on first use.
 */
import { formatClock, localParts, nextSunEvents } from "./astro";
import { Ambience } from "./audio";
import { CITIES, cityById, guessCity, type City } from "./cities";
import { Environment, FALLBACK_WEATHER } from "./environment";
import { paintedCity } from "./packs/painted-city";
import { paintedBedroom } from "./packs/painted-bedroom";
import { paintedStudy } from "./packs/painted-study";
import { paintedValley } from "./packs/painted-valley";
import type { AmbienceWeights, AnyRoom, AnyView } from "./types";
import { describe, fetchCurrent, type Weather } from "./weather";
import { isWallpaper } from "../desktop";
import { cleanMix, type Sound, type SoundMix } from "../scenes";
import { getMusic } from "../music";

/** What's outside the window, and the room you're in. Any view goes with any room. */
export const VIEWS: { id: string; name: string; pack: AnyView }[] = [
  { id: "painted-city", name: "Painted city", pack: paintedCity },
  { id: "painted-valley", name: "Painted valley", pack: paintedValley },
];
/** `three` names a rendered 3D room (see `three/`); `pack` is the 2D room shown where WebGL isn't available.
 *  `view` is the view Auto shows from this room. */
export const ROOMS: { id: string; name: string; pack: AnyRoom; three?: string; view?: string }[] = [
  { id: "painted", name: "Midnight study (painted)", pack: paintedStudy, view: "painted-city" },
  { id: "painted-bedroom", name: "Cozy bedroom (painted)", pack: paintedBedroom, view: "painted-valley" },
  { id: "listening", name: "Listening room (3D)", pack: paintedStudy, three: "listening", view: "painted-city" },
  { id: "cabin3d", name: "Nordic cabin (3D)", pack: paintedBedroom, three: "cabin", view: "painted-valley" },
  { id: "japanese", name: "Japanese room (3D)", pack: paintedStudy, three: "japanese", view: "painted-city" },
  { id: "mediterranean", name: "Mediterranean (3D)", pack: paintedStudy, three: "mediterranean", view: "painted-city" },
];
export type WeatherStatus = "loading" | "live" | "stale" | "offline" | "preset";
export type WindowPrefs = {
  city: string;
  sound: boolean;
  volume: number;
  preset: number | null;
  view: string;
  room: string;
  /** Your own levels for some sounds; the rest follow the scene. */
  mix: SoundMix;
  custom?: City | undefined;
};
export type WindowSnapshot = {
  city: City;
  prefs: WindowPrefs;
  view: AnyView;
  room: AnyRoom;
  /** The 3D room to render instead of `room`, if one is chosen. */
  room3d: string | null;
  status: WeatherStatus;
  weather: Weather;
  /** Milliseconds the scene is shifted from the real time, for previewing dusk or night. */
  shift: number;
  /** How loud the scene itself would make each sound, before your own mix. */
  ambience: AmbienceWeights;
};

type Tickable = { tick: (env: Environment, dt: number) => void };

const PREFS_KEY = "a-window:window-v1";
const REFRESH_MS = 15 * 60_000;
const SEASON_TEMP = { winter: 1, spring: 13, summer: 24, autumn: 14 } as const;

/** Views that were retired (drawn in a flat style that clashed with the painted rooms), and their painted
 *  replacements. */
const VIEW_ALIASES: Record<string, string> = { rooftops: "painted-city", city: "painted-city", fjord: "painted-valley" };

/** Rooms that were retired, and the room that took each one's place. */
const ROOM_ALIASES: Record<string, string> = {
  "lofi-desk": "painted",
  "lofi-bedroom": "painted-bedroom",
  lofi: "painted",
  minimal: "painted",
  attic: "listening",
  cabin: "cabin3d",
};

function loadPrefs(): WindowPrefs {
  const fallback: WindowPrefs = {
    city: guessCity(Intl.DateTimeFormat().resolvedOptions().timeZone).id,
    sound: false,
    volume: 0.6,
    preset: null,
    view: "auto",
    room: "auto",
    mix: {},
  };
  try {
    const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<WindowPrefs> & { scene?: string };
    // Earlier versions had one "scene" covering both halves, and some rooms have since been retired.
    if (p.scene === "attic-room") Object.assign(p, { view: "rooftops", room: "attic" });
    if (p.scene === "fjord-cabin") Object.assign(p, { view: "fjord", room: "cabin" });
    if (p.room && ROOM_ALIASES[p.room]) p.room = ROOM_ALIASES[p.room]!;
    if (p.view && VIEW_ALIASES[p.view]) p.view = VIEW_ALIASES[p.view]!;
    const known = !!p.city && (!!cityById(p.city) || p.custom?.id === p.city);
    return {
      city: known ? p.city! : fallback.city,
      sound: typeof p.sound === "boolean" ? p.sound : fallback.sound,
      volume: typeof p.volume === "number" ? Math.min(1, Math.max(0, p.volume)) : fallback.volume,
      preset: typeof p.preset === "number" ? p.preset : null,
      view: VIEWS.some((v) => v.id === p.view) ? p.view! : "auto",
      room: ROOMS.some((r) => r.id === p.room) ? p.room! : "auto",
      mix: cleanMix(p.mix),
      custom: p.custom && typeof p.custom.lat === "number" && typeof p.custom.tz === "string" ? p.custom : undefined,
    };
  } catch {
    return fallback;
  }
}

const EAST_ASIA = /^Asia\/(Tokyo|Seoul|Pyongyang|Shanghai|Taipei|Hong_Kong|Macau)$/;

/** The room Auto picks for a city: a Nordic cabin in the far north and south, a Japanese room in East Asia, a
 *  Mediterranean room where it's warm and sunny, and the Listening room everywhere else. */
export function autoRoom(city: City) {
  const lat = Math.abs(city.lat);
  if (lat >= 55) return "cabin3d";
  if (EAST_ASIA.test(city.tz)) return "japanese";
  if (lat < 42) return "mediterranean";
  return "listening";
}

/** Auto shows each room's own view, from the room `autoRoom` picks (or the valley in the far north and south and
 *  the city elsewhere, for a room without one). */
export function sceneFor(prefs: Pick<WindowPrefs, "view" | "room">, city: City) {
  const north = Math.abs(city.lat) >= 58;
  const entry = ROOMS.find((r) => r.id === prefs.room) ?? ROOMS.find((r) => r.id === autoRoom(city))!;
  const auto = VIEWS.find((v) => v.id === entry.view)?.pack ?? (north ? paintedValley : paintedCity);
  const view = VIEWS.find((v) => v.id === prefs.view)?.pack ?? auto;
  const room = entry.pack;
  // Weather sounds come from outside; the fire and its crackle belong to the room.
  const ambience: AmbienceWeights = { ...view.ambience, fire: room.ambience.fire };
  return { view, room, room3d: entry.three ?? null, ambience };
}

export class WindowEngine {
  readonly env: Environment;
  readonly audio = new Ambience();
  private prefs: WindowPrefs;
  private shift = 0;
  private live: Weather | null = null;
  private status: WeatherStatus = "loading";
  private tickables = new Set<Tickable>();
  private listeners = new Set<() => void>();
  private snapshot!: WindowSnapshot;
  private raf = 0;
  private last = 0;
  private refresh: number | undefined;
  private fetchCtl: AbortController | null = null;
  private running = false;
  private stopTimer: number | undefined;
  private retry: number | undefined;
  private failures = 0;

  /** silent: never plays sound (the desktop wallpaper). */
  private away = false;
  private cap = 0;

  constructor(private silent = false) {
    this.prefs = loadPrefs();
    this.env = new Environment(this.city);
    this.env.update(this.now(), 0);
    this.env.setWeather(this.effectiveWeather(), true);
    this.audio.setEnv(this.env);
    this.audio.setVolume(this.prefs.volume);
    this.env.onThunder = (d) => this.audio.thunder(d);
    window.addEventListener("pointerdown", () => this.audio.unlock());
    window.addEventListener("keydown", () => this.audio.unlock());
    // Another window (the wallpaper, or a second tab) changed the window's settings.
    window.addEventListener("storage", (e) => {
      if (e.key === PREFS_KEY) this.adopt(loadPrefs());
    });
    // Back online: fetch the weather straight away.
    window.addEventListener("online", () => {
      if (this.running && this.status !== "live") void this.loadWeather();
    });
    this.publish();
  }

  get city(): City {
    return cityById(this.prefs.city) ?? (this.prefs.custom?.id === this.prefs.city ? this.prefs.custom : undefined) ?? CITIES[0]!;
  }

  /** The scene's current time, including any preview shift. */
  now() {
    return new Date(Date.now() + this.shift);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snapshot;

  /** Runs the shared clock (and weather, and sound when it is on) while at least one canvas is showing. Stopping
   *  waits a moment, so swapping one canvas for another (a 2D room for a 3D one) doesn't restart everything. */
  attach(t: Tickable) {
    window.clearTimeout(this.stopTimer);
    this.tickables.add(t);
    if (this.tickables.size === 1 && !this.running) this.start();
    return () => {
      this.tickables.delete(t);
      if (this.tickables.size === 0) this.stopTimer = window.setTimeout(() => this.tickables.size === 0 && this.stop(), 1500);
    };
  }

  /** Moves the window to a city: one from the built-in list, or any city found by search. */
  setCity(id: string, found?: City) {
    const city = cityById(id) ?? found;
    if (!city || city.id === this.prefs.city) return;
    this.prefs = { ...this.prefs, city: city.id, ...(cityById(id) ? {} : { custom: city }) };
    this.applyCity();
    this.save();
  }

  /** Follows settings changed in another window. */
  private adopt(next: WindowPrefs) {
    const moved = next.city !== this.prefs.city;
    const soundChanged = next.sound !== this.prefs.sound;
    this.prefs = next;
    this.audio.setVolume(next.volume);
    if (soundChanged) this.setSound(next.sound);
    if (moved) this.applyCity();
    else this.env.setWeather(this.effectiveWeather());
    this.publish();
  }

  private applyCity() {
    const city = this.city;
    this.live = null;
    this.status = "loading";
    this.env.setCity(city);
    this.env.update(this.now(), 0);
    this.env.setWeather(this.effectiveWeather(), true);
    if (this.tickables.size) void this.loadWeather();
  }

  setScene(patch: Partial<Pick<WindowPrefs, "view" | "room">>) {
    this.prefs = { ...this.prefs, ...patch };
    this.save();
  }

  /** While the desktop app's window is hidden in the tray: no sound until it's shown again. */
  setAway(away: boolean) {
    this.away = away;
    if (away) this.audio.stop();
    else if (this.prefs.sound && this.running && !this.silent) this.audio.start();
  }

  /** Battery saver: draw at most this many frames a second (0 for no limit). */
  setFrameCap(fps: number) {
    this.cap = fps;
  }

  setSound(on: boolean) {
    this.prefs = { ...this.prefs, sound: on };
    if (on && this.tickables.size && !this.silent && !this.away) this.audio.start();
    else this.audio.stop();
    this.save();
  }

  /** Sets your own level for one sound, or (null) hands it back to the scene. */
  setMix(sound: Sound, level: number | null) {
    const mix = { ...this.prefs.mix };
    if (level === null) delete mix[sound];
    else mix[sound] = level;
    this.applyMix(mix);
  }

  /** Replaces your whole mix (empty follows the scene for every sound). */
  applyMix(mix: SoundMix) {
    this.prefs = { ...this.prefs, mix: cleanMix(mix) };
    this.save();
  }

  setVolume(v: number) {
    this.prefs = { ...this.prefs, volume: v };
    this.audio.setVolume(v);
    this.save();
  }

  /** null follows the live weather; a WMO code pins the scene to those conditions. */
  setPreset(code: number | null) {
    this.prefs = { ...this.prefs, preset: code };
    this.env.setWeather(this.effectiveWeather());
    this.save();
  }

  /** Shows the city at a given local hour (0–24), or follows the real time again when null. */
  previewHour(hour: number | null) {
    if (hour === null) this.shift = 0;
    else {
      const lp = localParts(new Date(), this.city.tz);
      this.shift = (hour - (lp.hour + lp.minute / 60 + lp.second / 3600)) * 3600_000;
    }
    this.publish();
  }

  /** Next sunrise or sunset in the window's city, as a short label. */
  sunLabel() {
    const c = this.city, now = this.now(), { sunrise, sunset } = nextSunEvents(now, c.lat, c.lon);
    if (!sunrise && !sunset) return this.env.sunAlt > 0 ? "Midnight sun" : "Polar night";
    if (sunset && (!sunrise || sunset < sunrise)) return `Sunset ${formatClock(sunset, c.tz)}`;
    return `Sunrise ${formatClock(sunrise!, c.tz)}`;
  }

  private effectiveWeather(): Weather {
    const seasonal = SEASON_TEMP[this.env.season];
    if (this.prefs.preset === null) return this.live ?? { ...FALLBACK_WEATHER, temp: seasonal };
    const w = describe(this.prefs.preset);
    let temp = this.live?.temp ?? seasonal;
    if (w.snow) temp = Math.min(temp, -1);
    else if (w.rain && temp < 2) temp = 4;
    return { ...w, temp, wind: this.live?.wind ?? (w.thunder ? 30 : w.rain ? 14 : 8), updated: null };
  }

  private start() {
    this.running = true;
    this.last = performance.now();
    const loop = (ts: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
      // Under a frame cap, skip display frames until enough time has passed (a little early, so 60 Hz screens
      // land on an even 20 or 30 fps).
      if (this.cap && dt < 1 / this.cap - 0.004) return;
      this.last = ts;
      this.env.update(this.now(), dt);
      this.env.updateMusic(getMusic(), dt);
      for (const t of this.tickables) t.tick(this.env, dt);
    };
    this.raf = requestAnimationFrame(loop);
    void this.loadWeather();
    this.refresh = window.setInterval(() => void this.loadWeather(), REFRESH_MS);
    if (this.prefs.sound && !this.silent && !this.away) this.audio.start();
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.clearInterval(this.refresh);
    window.clearTimeout(this.retry);
    this.fetchCtl?.abort();
    this.audio.stop();
  }

  private async loadWeather() {
    this.fetchCtl?.abort();
    window.clearTimeout(this.retry);
    const ctl = (this.fetchCtl = new AbortController());
    const first = !this.live;
    // A stalled connection counts as a failure after 10 seconds, rather than "loading" forever.
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, 10_000);
    try {
      this.live = await fetchCurrent(this.city.lat, this.city.lon, ctl.signal);
      this.status = "live";
      this.failures = 0;
    } catch {
      if (ctl.signal.aborted && !timedOut) return;
      this.status = this.live ? "stale" : "offline";
      // Try again soon (1, 2, then 5 minutes) instead of waiting for the next 15-minute refresh.
      const wait = [60_000, 120_000, 300_000][Math.min(this.failures++, 2)]!;
      if (this.running) this.retry = window.setTimeout(() => void this.loadWeather(), wait);
    } finally {
      window.clearTimeout(timer);
    }
    this.env.setWeather(this.effectiveWeather(), first && this.status === "live" && this.prefs.preset === null);
    this.publish();
  }

  private save() {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
    } catch {
      /* storage unavailable: preferences last for this session */
    }
    this.publish();
  }

  private publish() {
    const { view, room, room3d, ambience } = sceneFor(this.prefs, this.city);
    this.audio.setWeights(ambience);
    this.audio.setMix(this.prefs.mix);
    this.snapshot = {
      city: this.city,
      prefs: this.prefs,
      view,
      room,
      room3d,
      status: this.prefs.preset !== null ? "preset" : this.status,
      weather: this.effectiveWeather(),
      shift: this.shift,
      ambience,
    };
    for (const fn of this.listeners) fn();
  }
}

let engine: WindowEngine | null = null;
export function getWindowEngine() {
  engine ??= new WindowEngine(isWallpaper);
  return engine;
}
