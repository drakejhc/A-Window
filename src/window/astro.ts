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

/** Ecliptic longitude and latitude to altitude and azimuth for an observer. */
function toHorizontal(lambda: number, d: number, lat: number, lon: number, beta = 0): Horizontal {
  const e = (23.439 - 0.00000036 * d) * RAD;
  const l = lambda * RAD, b = beta * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
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

/** The Moon's ecliptic longitude and latitude: its mean motion plus the largest periodic terms (the equation of
 *  the centre, evection, variation and the annual equation), good to a fraction of a degree. */
function moonEcliptic(d: number) {
  const L = 218.316 + 13.176396 * d,
    M = (134.963 + 13.064993 * d) * RAD,
    F = (93.272 + 13.22935 * d) * RAD,
    D = (297.85 + 12.190749 * d) * RAD,
    Ms = (357.529 + 0.98560028 * d) * RAD;
  const lambda =
    L + 6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M) - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F);
  return { lambda, beta: 5.128 * Math.sin(F) };
}

/** Where the Moon is in its cycle from the real angle between it and the Sun: 0 = new, 0.25 = first quarter,
 *  0.5 = full, 0.75 = last quarter. */
export function moonPhase(date: Date) {
  const d = daysSinceJ2000(date);
  const elongation = moonEcliptic(d).lambda - sunLongitude(d);
  return (((elongation % 360) + 360) % 360) / 360;
}

export function moonPosition(date: Date, lat: number, lon: number) {
  const d = daysSinceJ2000(date);
  const { lambda, beta } = moonEcliptic(d);
  return { ...toHorizontal(lambda, d, lat, lon, beta), phase: moonPhase(date) };
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
