/** Current conditions from Open-Meteo (free, no key), mapped from WMO weather codes to the scene's fields. */
export type Conditions = {
  code: number;
  label: string;
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  thunder: boolean;
};
export type Weather = Conditions & { temp: number; wind: number; updated: Date | null };

// label, cloud cover, rain, snow, fog (0..1), thunder
type Row = [string, number, number?, number?, number?, number?];
const CODES: Record<number, Row> = {
  0: ["Clear", 0],
  1: ["Mostly clear", 0.2],
  2: ["Partly cloudy", 0.5],
  3: ["Overcast", 0.95],
  45: ["Fog", 0.8, 0, 0, 0.85],
  48: ["Freezing fog", 0.8, 0, 0, 0.9],
  51: ["Light drizzle", 0.85, 0.18, 0, 0.2],
  53: ["Drizzle", 0.9, 0.28, 0, 0.25],
  55: ["Heavy drizzle", 0.95, 0.38, 0, 0.3],
  56: ["Freezing drizzle", 0.9, 0.25, 0, 0.2],
  57: ["Freezing drizzle", 0.95, 0.35, 0, 0.25],
  61: ["Light rain", 0.9, 0.4],
  63: ["Rain", 0.95, 0.65],
  65: ["Heavy rain", 1, 0.9],
  66: ["Freezing rain", 0.95, 0.5],
  67: ["Freezing rain", 1, 0.8],
  71: ["Light snow", 0.9, 0, 0.35],
  73: ["Snow", 0.95, 0, 0.6],
  75: ["Heavy snow", 1, 0, 0.9],
  77: ["Snow grains", 0.9, 0, 0.3],
  80: ["Rain showers", 0.75, 0.5],
  81: ["Heavy showers", 0.85, 0.75],
  82: ["Violent showers", 0.95, 1],
  85: ["Snow showers", 0.8, 0, 0.5],
  86: ["Heavy snow showers", 0.9, 0, 0.85],
  95: ["Thunderstorm", 1, 0.8, 0, 0, 1],
  96: ["Thunderstorm with hail", 1, 0.85, 0, 0, 1],
  99: ["Thunderstorm with hail", 1, 0.9, 0, 0, 1],
};

export function describe(code: number): Conditions {
  const [label, cloud, rain = 0, snow = 0, fog = 0, thunder = 0] = CODES[code] ?? CODES[0]!;
  return { code, label, cloud, rain, snow, fog, thunder: thunder > 0 };
}

/** Conditions offered when picking the weather by hand. */
export const PRESETS = [
  { code: 0, name: "Clear" },
  { code: 2, name: "Partly cloudy" },
  { code: 3, name: "Overcast" },
  { code: 45, name: "Fog" },
  { code: 53, name: "Drizzle" },
  { code: 63, name: "Rain" },
  { code: 65, name: "Heavy rain" },
  { code: 95, name: "Thunderstorm" },
  { code: 73, name: "Snow" },
  { code: 75, name: "Heavy snow" },
];

export async function fetchCurrent(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<Weather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m,precipitation" +
    "&wind_speed_unit=kmh&timezone=auto";
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`Weather service answered ${res.status}`);
  const json = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      cloud_cover?: number;
      wind_speed_10m?: number;
      precipitation?: number;
    };
  };
  const c = json.current;
  if (!c || typeof c.weather_code !== "number" || typeof c.temperature_2m !== "number")
    throw new Error("Weather service sent an unexpected reply");
  const w = describe(c.weather_code);
  if (typeof c.cloud_cover === "number")
    w.cloud = Math.max(c.cloud_cover / 100, w.rain || w.snow ? 0.8 : 0);
  if (w.rain && (c.precipitation ?? 0) > 0)
    w.rain = Math.max(w.rain, Math.min(1, (c.precipitation ?? 0) / 6));
  return { ...w, temp: c.temperature_2m, wind: c.wind_speed_10m ?? 8, updated: new Date() };
}
