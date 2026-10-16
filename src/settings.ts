/** App-wide preferences, saved in this browser or app. Defaults follow the person's locale. */
import { createContext, useContext, useEffect, useState } from "react";

import { setDisplayPrefs } from "@/planner/model";

export type Settings = {
  units: "c" | "f";
  clock24: boolean;
  weekStart: 0 | 1;
  /** A notification five minutes before each block. */
  notify: boolean;
  /** Show what's playing in Spotify or Apple Music (desktop app only). */
  music: boolean;
  onboarded: boolean;
};

const KEY = "a-window:settings-v1";

/** The person's region (e.g. "US"), from their locale; some systems report odd locale strings, so never throw. */
function region() {
  for (const tag of [navigator.language, Intl.DateTimeFormat().resolvedOptions().locale]) {
    try {
      const r = new Intl.Locale(tag).maximize().region;
      if (r) return r.toUpperCase();
    } catch {
      /* try the next one */
    }
  }
  return "US";
}

function localeDefaults(): Settings {
  const r = region();
  const fahrenheit = ["US", "LR", "MM", "BS", "BZ", "KY", "PW"].includes(r);
  const hourCycle = new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle;
  const sundayFirst = ["US", "CA", "JP", "BR", "MX", "IL", "PH", "KR", "TW", "HK", "IN", "ZA"].includes(r);
  return { units: fahrenheit ? "f" : "c", clock24: hourCycle === "h23" || hourCycle === "h24", weekStart: sundayFirst ? 0 : 1, notify: false, music: true, onboarded: false };
}

export function loadSettings(): Settings {
  const base = localeDefaults();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* fall back to the defaults */
  }
  return base;
}

export function useSettingsState() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // The planner's time and week formatting read these directly.
  setDisplayPrefs(settings);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable */
    }
  }, [settings]);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return { settings, update };
}

export type SettingsApi = ReturnType<typeof useSettingsState>;
export const SettingsContext = createContext<SettingsApi | null>(null);
export function useSettings() {
  const api = useContext(SettingsContext);
  if (!api) throw new Error("useSettings needs a SettingsContext provider");
  return api;
}

export function formatTemp(celsius: number, units: Settings["units"]) {
  return units === "f" ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}
