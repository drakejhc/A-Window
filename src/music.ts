/** What's playing in Spotify or Apple Music, as reported by the desktop app, plus the album art's colour. */
import { useSyncExternalStore } from "react";

import { desktop, type NowPlaying } from "./desktop";
import type { RGB } from "./window/util";

export type MusicState = { np: NowPlaying | null; art: HTMLImageElement | null; tint: RGB | null };

let state: MusicState = { np: null, art: null, tint: null };
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;
let artKey = "";

function set(next: Partial<MusicState>) {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
}

/** The art's most characterful colour: an average weighted toward saturated, mid-bright pixels. */
export function dominantColor(img: CanvasImageSource): RGB | null {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 24, 24);
  const px = ctx.getImageData(0, 0, 24, 24).data;
  let r = 0, g = 0, b = 0, total = 0;
  for (let i = 0; i < px.length; i += 4) {
    const pr = px[i]!, pg = px[i + 1]!, pb = px[i + 2]!;
    const max = Math.max(pr, pg, pb), min = Math.min(pr, pg, pb);
    const sat = max ? (max - min) / max : 0, light = max / 255;
    const w = 0.05 + sat * sat * (1 - Math.abs(light - 0.6));
    r += pr * w;
    g += pg * w;
    b += pb * w;
    total += w;
  }
  return total ? [r / total, g / total, b / total] : null;
}

function receive(np: NowPlaying | null) {
  const key = np?.artwork ?? "";
  if (key === artKey) return set({ np });
  artKey = key;
  if (!np?.artwork) return set({ np, art: null, tint: null });
  const img = new Image();
  img.onload = () => {
    if (artKey === key) set({ art: img, tint: dominantColor(img) });
  };
  img.src = np.artwork;
  set({ np });
}

/** Starts or stops listening to the desktop app; does nothing in a browser. */
export function watchMusic(on: boolean) {
  if (!desktop) return;
  desktop.watchMusic(on);
  if (on && !unsubscribe) unsubscribe = desktop.onNowPlaying(receive);
  if (!on && unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    receive(null);
  }
}

export const getMusic = () => state;
export function useMusic() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getMusic,
  );
}
