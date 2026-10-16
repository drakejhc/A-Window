/** City search through Open-Meteo's free geocoding service (no key). Falls back to the built-in list offline. */
import { CITIES, type City } from "./cities";

type Result = { id: number; name: string; latitude: number; longitude: number; timezone?: string; country?: string; admin1?: string };

export async function searchCities(query: string, signal?: AbortSignal): Promise<City[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) throw new Error(`City search answered ${res.status}`);
  const json = (await res.json()) as { results?: Result[] };
  return (json.results ?? [])
    .filter((r) => r.timezone)
    .map((r) => ({
      id: `geo-${r.id}`,
      name: r.name,
      region: [r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.latitude,
      lon: r.longitude,
      tz: r.timezone!,
    }));
}

/** Matches the built-in cities by name, for when the search service can't be reached. */
export function searchOffline(query: string): City[] {
  const q = query.trim().toLowerCase();
  return CITIES.filter((c) => c.name.toLowerCase().includes(q) || c.region?.toLowerCase().includes(q));
}
