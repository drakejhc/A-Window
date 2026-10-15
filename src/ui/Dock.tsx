import { useState } from "react";

import { CITIES } from "@/window/cities";
import { PACKS } from "@/window/engine";
import { localParts } from "@/window/astro";
import { PRESETS } from "@/window/weather";

import { Icon } from "./icons";
import { useWindow } from "./use-window";

export const FOCUS_LENGTHS = [15, 25, 50, 90];

type Props = {
  layout: "full" | "side";
  onLayout: (l: "full" | "side") => void;
  sheetOpen: boolean;
  onToggleSheet: () => void;
  focusing: boolean;
  focusLabel: string;
  onFocus: () => void;
  focusMinutes: number;
  onFocusMinutes: (m: number) => void;
};

/** The controls along the bottom: the window's city, scene and sound, Focus, and the day sheet. */
export function Dock({ layout, onLayout, sheetOpen, onToggleSheet, focusing, focusLabel, onFocus, focusMinutes, onFocusMinutes }: Props) {
  const { engine, snap } = useWindow();
  const [adjusting, setAdjusting] = useState(false);
  const following = snap.shift === 0;
  const hourNow = () => {
    const lp = localParts(engine.now(), snap.city.tz);
    return lp.hour + lp.minute / 60;
  };
  const [hour, setHour] = useState(hourNow);
  const fmt = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;

  return (
    <>
      {adjusting && (
        <section className="adjust" aria-label="Adjust the window">
          <h2>Adjust the window</h2>
          <label className="field">
            <span>Weather</span>
            <select value={snap.prefs.preset ?? "live"} onChange={(e) => engine.setPreset(e.target.value === "live" ? null : Number(e.target.value))}>
              <option value="live">Live weather</option>
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
              <input
                type="checkbox"
                checked={following}
                onChange={(e) => {
                  if (e.target.checked) engine.previewHour(null);
                  else engine.previewHour(hour);
                }}
              />
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
          <div className="field">
            <span>Planner</span>
            <div className="seg wide" role="radiogroup" aria-label="Planner layout">
              <button type="button" role="radio" aria-checked={layout === "full"} onClick={() => onLayout("full")}>
                Full workspace
              </button>
              <button type="button" role="radio" aria-checked={layout === "side"} onClick={() => onLayout("side")}>
                Side sheet
              </button>
            </div>
          </div>
          <label className="field">
            <span>Free focus session</span>
            <select value={focusMinutes} onChange={(e) => onFocusMinutes(Number(e.target.value))}>
              {FOCUS_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.01} value={snap.prefs.volume} onChange={(e) => engine.setVolume(Number(e.target.value))} />
          </label>
          <p className="hint">Weather comes from Open-Meteo and refreshes every 15 minutes. Focus works on the block happening now, or a free session when the day is clear.</p>
        </section>
      )}
      <nav className="dock" aria-label="Window controls">
        <label className="sr" htmlFor="city">
          City
        </label>
        <select id="city" className="ctl" value={snap.city.id} onChange={(e) => engine.setCity(e.target.value)}>
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr" htmlFor="scene">
          Scene
        </label>
        <select id="scene" className="ctl" value={snap.prefs.scene} onChange={(e) => engine.setScene(e.target.value)}>
          <option value="auto">Auto scene</option>
          {PACKS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="divider" aria-hidden />
        <button type="button" className="ctl" aria-pressed={snap.prefs.sound} onClick={() => engine.setSound(!snap.prefs.sound)}>
          <Icon name={snap.prefs.sound ? "sound" : "mute"} />
          {snap.prefs.sound ? "Sound on" : "Sound off"}
        </button>
        <span className="divider" aria-hidden />
        <button type="button" className="ctl" aria-pressed={focusing} onClick={onFocus} title="Focus (F)">
          <Icon name="timer" />
          {focusLabel}
        </button>
        <button type="button" className="ctl" aria-pressed={sheetOpen} onClick={onToggleSheet} title="Day sheet (P)">
          <Icon name="panel" />
          Planner
        </button>
        <button type="button" className="ctl icon" aria-expanded={adjusting} aria-label="Adjust the window" title="Adjust" onClick={() => setAdjusting((v) => !v)}>
          <Icon name="sliders" />
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
