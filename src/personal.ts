/** "Make it yours": the cat (its coat, or no cat), the lamp's colour, the walls' colour and the blanket's, stored
 *  locally and versioned. The cat and the lamp change live; walls and blanket are painted in, so changing them
 *  repaints the room. */
import type { RGB } from "./window/util";

export const COATS = {
  black: { name: "Black", fur: [16, 15, 26] as RGB, patches: null },
  grey: { name: "Grey", fur: [92, 94, 106] as RGB, patches: null },
  ginger: { name: "Ginger", fur: [178, 98, 44] as RGB, patches: null },
  calico: { name: "Calico", fur: [226, 218, 204] as RGB, patches: [[188, 104, 50], [40, 34, 38]] as RGB[] },
  none: { name: "No cat", fur: [0, 0, 0] as RGB, patches: null },
} as const;
export const LAMPS = {
  warm: { name: "Warm", color: [255, 176, 96] as RGB },
  candle: { name: "Candle", color: [255, 146, 64] as RGB },
  white: { name: "Soft white", color: [255, 222, 186] as RGB },
  rose: { name: "Rose", color: [255, 150, 136] as RGB },
} as const;
/** Wall colours, as hues: painted walls keep their light and shade, and only their colour shifts. */
export const WALLS = {
  painted: { name: "As painted", tint: null },
  sage: { name: "Sage", tint: [138, 166, 132] as RGB },
  clay: { name: "Clay", tint: [196, 132, 104] as RGB },
  ink: { name: "Ink", tint: [70, 88, 140] as RGB },
  cream: { name: "Cream", tint: [226, 210, 180] as RGB },
} as const;
export const BLANKETS = {
  terracotta: { name: "Terracotta", tint: null },
  sage: { name: "Sage", tint: [112, 150, 112] as RGB },
  indigo: { name: "Indigo", tint: [72, 88, 158] as RGB },
  mustard: { name: "Mustard", tint: [204, 160, 56] as RGB },
} as const;

export type Coat = keyof typeof COATS;
export type LampTone = keyof typeof LAMPS;
export type WallTone = keyof typeof WALLS;
export type BlanketTone = keyof typeof BLANKETS;
export type Personal = { version: 1; cat: Coat; lamp: LampTone; walls: WallTone; blanket: BlanketTone };

export const PERSONAL_KEY = "a-window:personal-v1";
export const defaultPersonal = (): Personal => ({ version: 1, cat: "black", lamp: "warm", walls: "painted", blanket: "terracotta" });

const pick = <T extends string>(options: Record<T, unknown>, v: unknown, fallback: T): T => (typeof v === "string" && v in options ? (v as T) : fallback);

/** Reads stored choices, keeping each valid one and falling back to the default for anything unknown. */
export function readPersonal(raw: unknown): Personal {
  const d = defaultPersonal();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  return { version: 1, cat: pick(COATS, r.cat, d.cat), lamp: pick(LAMPS, r.lamp, d.lamp), walls: pick(WALLS, r.walls, d.walls), blanket: pick(BLANKETS, r.blanket, d.blanket) };
}

export function loadPersonal(): Personal {
  try {
    return readPersonal(JSON.parse(window.localStorage.getItem(PERSONAL_KEY) ?? "null"));
  } catch {
    return defaultPersonal();
  }
}

const lum = (c: RGB) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/** Shifts a painted colour toward a tint's hue while keeping its lightness, so a night-dark wall stays dark. */
export function retint(c: RGB, tint: RGB, amount = 0.65): RGB {
  const k = lum(c) / Math.max(1, lum(tint));
  return [0, 1, 2].map((i) => Math.min(255, c[i]! + (tint[i]! * k - c[i]!) * amount)) as RGB;
}
