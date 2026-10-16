export type City = { id: string; name: string; lat: number; lon: number; tz: string; region?: string };

export const CITIES: City[] = [
  { id: "kyoto", name: "Kyoto", lat: 35.0116, lon: 135.7681, tz: "Asia/Tokyo", region: "Japan" },
  { id: "tromso", name: "Tromsø", lat: 69.6492, lon: 18.9553, tz: "Europe/Oslo", region: "Norway" },
  { id: "reykjavik", name: "Reykjavík", lat: 64.1466, lon: -21.9426, tz: "Atlantic/Reykjavik", region: "Iceland" },
  { id: "edinburgh", name: "Edinburgh", lat: 55.9533, lon: -3.1883, tz: "Europe/London", region: "Scotland, UK" },
  { id: "paris", name: "Paris", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris", region: "France" },
  { id: "lisbon", name: "Lisbon", lat: 38.7223, lon: -9.1393, tz: "Europe/Lisbon", region: "Portugal" },
  { id: "istanbul", name: "Istanbul", lat: 41.0082, lon: 28.9784, tz: "Europe/Istanbul", region: "Türkiye" },
  { id: "seoul", name: "Seoul", lat: 37.5665, lon: 126.978, tz: "Asia/Seoul", region: "South Korea" },
  { id: "taipei", name: "Taipei", lat: 25.033, lon: 121.5654, tz: "Asia/Taipei", region: "Taiwan" },
  { id: "singapore", name: "Singapore", lat: 1.3521, lon: 103.8198, tz: "Asia/Singapore", region: "Singapore" },
  { id: "sydney", name: "Sydney", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney", region: "Australia" },
  { id: "wellington", name: "Wellington", lat: -41.2865, lon: 174.7762, tz: "Pacific/Auckland", region: "New Zealand" },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    lat: -34.6037,
    lon: -58.3816,
    tz: "America/Argentina/Buenos_Aires", region: "Argentina",
  },
  { id: "vancouver", name: "Vancouver", lat: 49.2827, lon: -123.1207, tz: "America/Vancouver", region: "British Columbia, Canada" },
  {
    id: "san-francisco",
    name: "San Francisco",
    lat: 37.7749,
    lon: -122.4194,
    tz: "America/Los_Angeles", region: "California, US",
  },
  { id: "chicago", name: "Chicago", lat: 41.8781, lon: -87.6298, tz: "America/Chicago", region: "Illinois, US" },
  { id: "montreal", name: "Montréal", lat: 45.5019, lon: -73.5674, tz: "America/Toronto", region: "Quebec, Canada" },
  { id: "new-york", name: "New York", lat: 40.7128, lon: -74.006, tz: "America/New_York", region: "New York, US" },
  { id: "london", name: "London", lat: 51.5072, lon: -0.1276, tz: "Europe/London", region: "England, UK" },
];

export const DEFAULT_CITY = CITIES[0]!;

export const cityById = (id: string | undefined) => CITIES.find((c) => c.id === id);

/** Picks the listed city that shares the viewer's time zone, so the window starts out close to home. */
export function guessCity(timeZone: string | undefined): City {
  return CITIES.find((c) => c.tz === timeZone) ?? DEFAULT_CITY;
}
