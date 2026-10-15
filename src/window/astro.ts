/** Sun and moon positions, sunrise/sunset search and a time zone's local clock. Pure, browser-safe functions. */
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Horizontal = { altitude: number; azimuth: number };

const RAD = Math.PI / 180;
const daysSinceJ2000 = (date: Date) => date.getTime() / 86400000 - 10957.5;

function sunLongitude(d: number) {
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  return q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
}

/** Ecliptic longitude (latitude taken as 0) to altitude and azimuth for an observer. */
function toHorizontal(lambda: number, d: number, lat: number, lon: number): Horizontal {
  const e = (23.439 - 0.00000036 * d) * RAD;
  const l = lambda * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l));
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  const gmst = ((280.46061837 + 360.98564736629 * d) % 360) * RAD;
  const H = gmst + lon * RAD - ra;
  const phi = lat * RAD;
  const alt = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H),
  );
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { altitude: alt / RAD, azimuth: (((az / RAD) % 360) + 360) % 360 };
}

export function sunPosition(date: Date, lat: number, lon: number) {
  const d = daysSinceJ2000(date);
  return toHorizontal(sunLongitude(d), d, lat, lon);
}

/** 0 = new moon, 0.5 = full. */
export function moonPhase(date: Date) {
  const synodic = 29.530588853;
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  return ((((date.getTime() / 86400000 - ref) % synodic) + synodic) % synodic) / synodic;
}

export function moonPosition(date: Date, lat: number, lon: number) {
  const d = daysSinceJ2000(date);
  const phase = moonPhase(date);
  return { ...toHorizontal(sunLongitude(d) + phase * 360, d, lat, lon), phase };
}

/** Next sunrise and sunset after `date`; null during polar day or night. */
export function nextSunEvents(date: Date, lat: number, lon: number) {
  const step = 5 * 60000,
    h0 = -0.833;
  const out: { sunrise: Date | null; sunset: Date | null } = { sunrise: null, sunset: null };
  let prev = sunPosition(new Date(date.getTime() - step), lat, lon).altitude;
  for (let t = date.getTime(); t < date.getTime() + 36 * 3600000; t += step) {
    const a = sunPosition(new Date(t), lat, lon).altitude;
    if (prev < h0 && a >= h0 && !out.sunrise) out.sunrise = new Date(t);
    if (prev >= h0 && a < h0 && !out.sunset) out.sunset = new Date(t);
    if (out.sunrise && out.sunset) break;
    prev = a;
  }
  return out;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
export function localParts(date: Date, timeZone: string) {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormatters.set(timeZone, f);
  }
  const o: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return {
    month: o.month ?? 1,
    day: o.day ?? 1,
    hour: (o.hour ?? 0) % 24,
    minute: o.minute ?? 0,
    second: o.second ?? 0,
  };
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatClock(date: Date, timeZone: string) {
  let f = timeFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { timeZone, hour: "numeric", minute: "2-digit" });
    timeFormatters.set(timeZone, f);
  }
  return f.format(date);
}

export function seasonFor(month: number, lat: number): Season {
  if (Math.abs(lat) < 15) return "summer";
  const north: Season =
    month <= 2 || month === 12
      ? "winter"
      : month <= 5
        ? "spring"
        : month <= 8
          ? "summer"
          : "autumn";
  if (lat >= 0) return north;
  return ({ winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" } as const)[
    north
  ];
}
