/** Saved scenes: a room, a view and a sound mix you can come back to, and a schedule that switches between them
 *  through the day (a bright study by day, the cozy bedroom after nine), plus an optional scene for Focus.
 *  Stored locally, versioned so later changes can migrate it. */
import { useEffect, useState } from "react";

/** The sounds the ambience mixes, each 0..1.5 when set; a sound left unset plays at the scene's own level. */
export const SOUNDS = ["rain", "wind", "city", "fire", "crickets", "birds", "cafe", "vinyl"] as const;
export type Sound = (typeof SOUNDS)[number];
export type SoundMix = Partial<Record<Sound, number>>;

export const SOUND_NAMES: Record<Sound, string> = {
  rain: "Rain",
  wind: "Wind",
  city: "City",
  fire: "Fire",
  crickets: "Crickets",
  birds: "Birds",
  cafe: "Café murmur",
  vinyl: "Vinyl crackle",
};

export type SavedScene = { id: string; name: string; room: string; view: string; mix: SoundMix; sound: boolean };
/** From `from` minutes after midnight (your own clock), show `scene`, until the next entry. */
export type ScheduleEntry = { scene: string; from: number };
export type ScenesState = { version: 1; scenes: SavedScene[]; schedule: ScheduleEntry[]; focus: string | null };

const KEY = "a-window:scenes-v1";
export const emptyScenes = (): ScenesState => ({ version: 1, scenes: [], schedule: [], focus: null });

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Cleans a mix: known sounds only, levels within 0..1.5. */
export function cleanMix(raw: unknown): SoundMix {
  const out: SoundMix = {};
  if (!raw || typeof raw !== "object") return out;
  for (const s of SOUNDS) {
    const v = (raw as Record<string, unknown>)[s];
    if (isNum(v)) out[s] = Math.min(1.5, Math.max(0, v));
  }
  return out;
}

/** Reads stored scenes, dropping anything malformed and schedule entries for scenes that no longer exist. */
export function readScenes(raw: unknown): ScenesState {
  if (!raw || typeof raw !== "object") return emptyScenes();
  const r = raw as Partial<ScenesState> & { version?: unknown };
  if (r.version !== 1) return emptyScenes();
  const scenes = (Array.isArray(r.scenes) ? r.scenes : [])
    .filter((s): s is SavedScene => !!s && typeof s.id === "string" && typeof s.name === "string" && typeof s.room === "string" && typeof s.view === "string")
    .map((s) => ({ id: s.id, name: s.name.slice(0, 60), room: s.room, view: s.view, mix: cleanMix(s.mix), sound: !!s.sound }));
  const ids = new Set(scenes.map((s) => s.id));
  const schedule = (Array.isArray(r.schedule) ? r.schedule : [])
    .filter((e): e is ScheduleEntry => !!e && typeof e.scene === "string" && ids.has(e.scene) && isNum(e.from))
    .map((e) => ({ scene: e.scene, from: Math.min(1439, Math.max(0, Math.round(e.from))) }))
    .sort((a, b) => a.from - b.from);
  return { version: 1, scenes, schedule, focus: typeof r.focus === "string" && ids.has(r.focus) ? r.focus : null };
}

/** The scene the schedule wants at a time of day: the latest entry that has started, or, before the first entry
 *  of the day, the last one from the evening before. Null without a schedule. */
export function scheduledScene(schedule: ScheduleEntry[], minutes: number): string | null {
  if (!schedule.length) return null;
  const sorted = [...schedule].sort((a, b) => a.from - b.from);
  let pick = sorted[sorted.length - 1]!;
  for (const e of sorted) if (e.from <= minutes) pick = e;
  return pick.scene;
}

export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const formatMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const parseMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return isNum(h) && isNum(m) ? Math.min(1439, Math.max(0, h * 60 + m)) : 0;
};

function load(): ScenesState {
  try {
    return readScenes(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
  } catch {
    return emptyScenes();
  }
}

export function useScenesState() {
  const [state, setState] = useState<ScenesState>(load);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: scenes last for this session */
    }
  }, [state]);
  return [state, setState] as const;
}
