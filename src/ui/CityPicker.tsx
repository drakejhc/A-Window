import { useEffect, useState } from "react";

import { formatClock } from "@/window/astro";
import { CITIES, type City } from "@/window/cities";
import { searchCities, searchOffline } from "@/window/geocode";

import { useWindow } from "./use-window";

/** Search any city in the world; the built-in list shows until you type. */
export function CityPicker({ onPick, autoFocus = true }: { onPick?: () => void; autoFocus?: boolean }) {
  const { engine, snap } = useWindow();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[]>(CITIES);
  const [offline, setOffline] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(CITIES);
      setSearching(false);
      return;
    }
    const ctl = new AbortController();
    setSearching(true);
    const t = window.setTimeout(() => {
      searchCities(q, ctl.signal)
        .then((r) => {
          setResults(r);
          setOffline(false);
        })
        .catch(() => {
          if (ctl.signal.aborted) return;
          setResults(searchOffline(q));
          setOffline(true);
        })
        .finally(() => !ctl.signal.aborted && setSearching(false));
    }, 280);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  const list = !query.trim() && !CITIES.some((c) => c.id === snap.city.id) ? [snap.city, ...results] : results;
  const now = new Date();
  return (
    <div className="city-picker">
      <input className="search" autoFocus={autoFocus} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for any city" aria-label="Search for a city" />
      <ul className="city-list" role="listbox" aria-label="Cities">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              role="option"
              aria-selected={c.id === snap.city.id}
              onClick={() => {
                engine.setCity(c.id, c);
                onPick?.();
              }}
            >
              <span className="city-name">{c.name}</span>
              {c.region && <span className="city-region">{c.region}</span>}
              <span className="city-time">{formatClock(now, c.tz)}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && !searching && <li className="tray-empty">No city by that name.</li>}
      </ul>
      {offline && <p className="hint">City search needs an internet connection, so this is the built-in list.</p>}
    </div>
  );
}
