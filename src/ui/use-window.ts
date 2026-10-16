import { useEffect, useState, useSyncExternalStore } from "react";

import { formatClock } from "@/window/astro";
import { getWindowEngine } from "@/window/engine";

/** The shared live window and its current state. */
export function useWindow() {
  const engine = getWindowEngine();
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snap };
}

// Only say where the weather comes from when it's real or chosen; otherwise say nothing about it.
const SOURCE = { live: "Live weather", stale: "Live weather", loading: "", offline: "", preset: "Chosen weather" } as const;

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
    /** Null when there's no real or chosen weather to report. */
    weather: snap.status === "loading" || snap.status === "offline" ? null : { label: snap.weather.label, tempC: snap.weather.temp },
    sun: engine.sunLabel(),
    source: [SOURCE[snap.status], snap.shift ? "Time adjusted" : ""].filter(Boolean).join(" · "),
    status: snap.status,
  };
}
