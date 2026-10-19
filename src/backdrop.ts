/** Your own background in place of the window: a picture or a video (a 4K photo, a looping clip, an animated GIF),
 *  and optionally a second one for after dark that fades in as the sun sets in the window's city. The files stay
 *  on this device, in IndexedDB; the choices about them are small and live in localStorage, so the desktop
 *  wallpaper and other tabs see a change straight away. */
import { useEffect, useState } from "react";

import type { RGB } from "./window/util";

export type Slot = "day" | "night";
export type BackdropFile = { name: string; type: string; video: boolean; tint: RGB };
export type Backdrop = {
  version: 1;
  day: BackdropFile | null;
  night: BackdropFile | null;
  /** cover fills the screen, cropping the edges; contain shows the whole picture. */
  fit: "cover" | "contain";
  /** Darken the picture after dark, when there's no picture of its own for the night. Off unless chosen: by
   *  default your background shows exactly as it is. */
  dim: boolean;
  /** Rain, snow and lightning from the city's live weather, over the picture as if on the glass. */
  weather: boolean;
  /** Changes with every new file, so other windows know to load it again. */
  stamp: number;
};

export const BACKDROP_KEY = "a-window:backdrop-v1";
const DB = "a-window-backdrop";
const STORE = "files";

export const defaultBackdrop = (): Backdrop => ({ version: 1, day: null, night: null, fit: "cover", dim: false, weather: false, stamp: 0 });

function readFile(raw: unknown): BackdropFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || typeof r.type !== "string") return null;
  const tint = Array.isArray(r.tint) && r.tint.length === 3 && r.tint.every((n) => typeof n === "number") ? (r.tint as RGB) : ([40, 44, 60] as RGB);
  return { name: r.name.slice(0, 200), type: r.type, video: !!r.video, tint };
}

/** Reads stored choices, keeping each valid one. */
export function readBackdrop(raw: unknown): Backdrop {
  const d = defaultBackdrop();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  return {
    version: 1,
    day: readFile(r.day),
    night: readFile(r.night),
    fit: r.fit === "contain" ? "contain" : "cover",
    dim: typeof r.dim === "boolean" ? r.dim : d.dim,
    weather: typeof r.weather === "boolean" ? r.weather : d.weather,
    stamp: typeof r.stamp === "number" ? r.stamp : 0,
  };
}

export function loadBackdrop(): Backdrop {
  try {
    return readBackdrop(JSON.parse(window.localStorage.getItem(BACKDROP_KEY) ?? "null"));
  } catch {
    return defaultBackdrop();
  }
}

const listeners = new Set<() => void>();

function store(b: Backdrop) {
  try {
    window.localStorage.setItem(BACKDROP_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable: lasts for this session */
  }
  for (const fn of listeners) fn();
}

export function updateBackdrop(patch: Partial<Pick<Backdrop, "fit" | "dim" | "weather">>) {
  store({ ...loadBackdrop(), ...patch });
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function loadBackdropFile(slot: Slot): Promise<Blob | null> {
  try {
    const db = await open();
    return ((await request(db.transaction(STORE).objectStore(STORE).get(slot))) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

/** The average colour of a picture or a video's first frame, for tinting the planner's glass to match. */
function averageColour(source: CanvasImageSource): RGB {
  const c = document.createElement("canvas"), n = 24;
  c.width = c.height = n;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(source, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, sum = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k]! += d[i + k]!;
  return sum.map((v) => Math.round(v / (n * n))) as RGB;
}

/** Checks the file can be shown here, and takes its colour, before keeping it. */
async function inspect(file: Blob): Promise<{ video: boolean; tint: RGB }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error("unplayable"));
      });
      return { video: true, tint: averageColour(v) };
    }
    const img = new Image();
    img.src = url;
    await img.decode();
    return { video: false, tint: averageColour(img) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const nextStamp = (b: Backdrop) => Math.max(Date.now(), b.stamp + 1);

/** Keeps a picture or video for a slot. Throws a message to show if it can't be used. */
export async function saveBackdropFile(slot: Slot, file: File) {
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) throw new Error("That isn’t a picture or a video.");
  let info: { video: boolean; tint: RGB };
  try {
    info = await inspect(file);
  } catch {
    throw new Error(file.type.startsWith("video/") ? "This video can’t be played here. Try an MP4 (H.264) or WebM." : "This picture can’t be shown here. Try a JPG, PNG, WebP or GIF.");
  }
  try {
    const db = await open();
    await request(db.transaction(STORE, "readwrite").objectStore(STORE).put(new Blob([file], { type: file.type }), slot));
  } catch {
    throw new Error("There isn’t room to keep that file on this device.");
  }
  const b = loadBackdrop();
  store({ ...b, [slot]: { name: file.name, type: file.type, ...info }, stamp: nextStamp(b) });
}

export async function removeBackdropFile(slot: Slot) {
  try {
    const db = await open();
    await request(db.transaction(STORE, "readwrite").objectStore(STORE).delete(slot));
  } catch {
    /* already gone */
  }
  const b = loadBackdrop();
  store({ ...b, [slot]: null, stamp: nextStamp(b) });
}

/** The current choices, following changes made here or in another window. */
export function useBackdrop() {
  const [b, setB] = useState(loadBackdrop);
  useEffect(() => {
    const update = () => setB(loadBackdrop());
    const onStorage = (e: StorageEvent) => e.key === BACKDROP_KEY && update();
    listeners.add(update);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return b;
}

/** Object URLs for the stored files, reloaded when they change and released when they're no longer shown. */
export function useBackdropUrls(b: Backdrop) {
  const [urls, setUrls] = useState<{ day: string | null; night: string | null; loaded: boolean }>({ day: null, night: null, loaded: false });
  const want = `${b.stamp}:${!!b.day}:${!!b.night}`;
  useEffect(() => {
    let live = true;
    const made: string[] = [];
    const url = async (slot: Slot, has: boolean) => {
      const blob = has ? await loadBackdropFile(slot) : null;
      if (!blob) return null;
      const u = URL.createObjectURL(blob);
      if (!live) {
        URL.revokeObjectURL(u);
        return null;
      }
      made.push(u);
      return u;
    };
    void Promise.all([url("day", !!b.day), url("night", !!b.night)]).then(([day, night]) => {
      if (live) setUrls({ day, night, loaded: true });
    });
    return () => {
      live = false;
      for (const u of made) URL.revokeObjectURL(u);
    };
    // Reload only when the files change, not when the fit or the toggles do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);
  return urls;
}
