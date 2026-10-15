import { useEffect, useState, useSyncExternalStore } from "react";

import { formatClock } from "@/window/astro";
import { getWindowEngine } from "@/window/engine";

/** The shared live window and its current state. */
export function useWindow() {
  const engine = getWindowEngine();
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snap };
}

const SOURCE = {
  live: "Live weather",
  stale: "Live weather · reconnecting",
  loading: "Fetching weather…",
  offline: "Live weather can’t be reached here",
  preset: "Chosen weather",
} as const;

/** The window city's clock, conditions and next sun event, refreshed every 15 seconds. */
export function useWindowSummary() {
  const { engine, snap } = useWindow();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, []);
  return {
    city: snap.city.name,
    clock: formatClock(engine.now(), snap.city.tz),
    conditions: `${snap.weather.label} · ${Math.round(snap.weather.temp)}°C`,
    sun: engine.sunLabel(),
    source: SOURCE[snap.status] + (snap.shift ? " · time adjusted" : ""),
    status: snap.status,
  };
}
