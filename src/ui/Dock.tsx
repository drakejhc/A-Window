import { useState } from "react";

import { localParts } from "@/window/astro";
import { ROOMS, VIEWS } from "@/window/engine";
import { PRESETS } from "@/window/weather";

import { CityPicker } from "./CityPicker";
import { Icon } from "./icons";
import { useWindow } from "./use-window";

export const FOCUS_LENGTHS = [15, 25, 50, 90];

type Props = {
  sheetOpen: boolean;
  onToggleSheet: () => void;
  focusing: boolean;
  onFocus: () => void;
  onSettings: () => void;
};

/** The controls along the bottom: the window's city, scene and sound, Focus, the planner and settings. */
export function Dock({ sheetOpen, onToggleSheet, focusing, onFocus, onSettings }: Props) {
  const { engine, snap } = useWindow();
  const [open, setOpen] = useState<"city" | "adjust" | null>(null);
  const following = snap.shift === 0;
  const hourNow = () => {
    const lp = localParts(engine.now(), snap.city.tz);
    return lp.hour + lp.minute / 60;
  };
  const [hour, setHour] = useState(hourNow);
  const fmt = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;
  const toggle = (which: "city" | "adjust") => setOpen((o) => (o === which ? null : which));

  return (
    <>
      {open === "city" && (
        <section className="adjust" aria-label="Choose a city">
          <h2>Where should the window look out?</h2>
          <CityPicker onPick={() => setOpen(null)} />
        </section>
      )}
      {open === "adjust" && (
        <section className="adjust" aria-label="Adjust the window">
          <h2>Adjust the window</h2>
          <label className="field">
            <span>The view outside</span>
            <select value={snap.prefs.view} onChange={(e) => engine.setScene({ view: e.target.value })}>
              <option value="auto">Auto (a fjord in the far north and south)</option>
              {VIEWS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Weather</span>
            <select value={snap.prefs.preset ?? "live"} onChange={(e) => engine.setPreset(e.target.value === "live" ? null : Number(e.target.value))}>
              <option value="live">{snap.status === "offline" ? "Live weather (unavailable here)" : "Live weather"}</option>
              {PRESETS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Time of day in {snap.city.name}</span>
            <label className="toggle">
              <input type="checkbox" checked={following} onChange={(e) => engine.previewHour(e.target.checked ? null : hour)} />
              Follow the real time
            </label>
            <div className="row">
              <input
                type="range"
                min={0}
                max={23.99}
                step={0.05}
                value={following ? hourNow() : hour}
                disabled={following}
                aria-label="Hour of day"
                onChange={(e) => {
                  setHour(Number(e.target.value));
                  engine.previewHour(Number(e.target.value));
                }}
              />
              <output>{fmt(following ? hourNow() : hour)}</output>
            </div>
          </div>
          <label className="field">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.01} value={snap.prefs.volume} onChange={(e) => engine.setVolume(Number(e.target.value))} />
          </label>
          {snap.status === "offline" && <p className="hint">Live weather can’t be reached from here, so the window shows mild weather. Pick conditions above, or use the desktop app.</p>}
        </section>
      )}
      <nav className="dock" aria-label="Window controls">
        <button type="button" className="ctl" aria-expanded={open === "city"} onClick={() => toggle("city")} title="Choose a city">
          <Icon name="pin" />
          {snap.city.name}
        </button>
        <label className="sr" htmlFor="room">
          Room
        </label>
        <select id="room" className="ctl" value={snap.prefs.room} onChange={(e) => engine.setScene({ room: e.target.value })}>
          <option value="auto">Auto room</option>
          {ROOMS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button type="button" className="ctl icon" aria-pressed={snap.prefs.sound} aria-label={snap.prefs.sound ? "Turn sound off" : "Turn sound on"} title={snap.prefs.sound ? "Sound on" : "Sound off"} onClick={() => engine.setSound(!snap.prefs.sound)}>
          <Icon name={snap.prefs.sound ? "sound" : "mute"} />
        </button>
        <button type="button" className="ctl icon" aria-expanded={open === "adjust"} aria-label="Adjust the window" title="Adjust weather, time and volume" onClick={() => toggle("adjust")}>
          <Icon name="sliders" />
        </button>
        <span className="divider" aria-hidden />
        <button type="button" className="ctl" aria-pressed={focusing} onClick={onFocus} title="Focus (F)">
          <Icon name="timer" />
          {focusing ? "Focusing" : "Focus"}
        </button>
        <button type="button" className="ctl" aria-pressed={sheetOpen} onClick={onToggleSheet} title="Planner (P)">
          <Icon name="panel" />
          Planner
        </button>
        <span className="divider" aria-hidden />
        <button type="button" className="ctl icon" aria-label="Settings" title="Settings" onClick={onSettings}>
          <Icon name="gear" />
        </button>
        {document.fullscreenEnabled && (
          <button
            type="button"
            className="ctl icon"
            aria-label="Full screen"
            title="Full screen"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
          >
            <Icon name="expand" />
          </button>
        )}
      </nav>
    </>
  );
}
