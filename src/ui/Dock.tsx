import { useState } from "react";

import { localParts } from "@/window/astro";
import { SOUND_NAMES, SOUNDS } from "@/scenes";
import { autoRoom, ROOMS, VIEWS } from "@/window/engine";
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
  const [open, setOpen] = useState<"city" | "room" | "adjust" | null>(null);
  const following = snap.shift === 0;
  const hourNow = () => {
    const lp = localParts(engine.now(), snap.city.tz);
    return lp.hour + lp.minute / 60;
  };
  const [hour, setHour] = useState(hourNow);
  const fmt = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;
  const toggle = (which: "city" | "room" | "adjust") => setOpen((o) => (o === which ? null : which));
  const autoName = ROOMS.find((r) => r.id === autoRoom(snap.city))?.name ?? "";
  const roomName = snap.prefs.room === "auto" ? `Auto · ${autoName}` : (ROOMS.find((r) => r.id === snap.prefs.room)?.name ?? "Room");
  const pickRoom = (id: string) => {
    engine.setScene({ room: id });
    setOpen(null);
  };

  return (
    <>
      {open === "city" && (
        <section className="adjust" aria-label="Choose a city">
          <h2>Where should the window look out?</h2>
          <CityPicker onPick={() => setOpen(null)} />
        </section>
      )}
      {open === "room" && (
        <section className="adjust" aria-label="Choose a room">
          <h2>Which room are you in?</h2>
          <ul className="room-list" role="listbox" aria-label="Rooms">
            <li>
              <button type="button" role="option" aria-selected={snap.prefs.room === "auto"} onClick={() => pickRoom("auto")}>
                <span className="room-swatch" data-room="auto" aria-hidden />
                <span className="room-text">
                  <span className="room-name">Auto</span>
                  <span className="room-blurb">Suits the city: {autoName} for {snap.city.name}</span>
                </span>
              </button>
            </li>
            {ROOMS.map((r) => (
              <li key={r.id}>
                <button type="button" role="option" aria-selected={snap.prefs.room === r.id} onClick={() => pickRoom(r.id)}>
                  <span className="room-swatch" data-room={r.id} aria-hidden />
                  <span className="room-text">
                    <span className="room-name">{r.name}</span>
                    <span className="room-blurb">{r.blurb}</span>
                  </span>
                  <span className="room-kind">{r.three ? "3D" : "Painted"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {open === "adjust" && (
        <section className="adjust" aria-label="Adjust the window">
          <h2>Adjust the window</h2>
          <label className="field">
            <span>The view outside</span>
            <select value={snap.prefs.view} onChange={(e) => engine.setScene({ view: e.target.value })}>
              <option value="auto">Auto (the room's own view)</option>
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
          <details className="sounds">
            <summary>Sounds</summary>
            {SOUNDS.map((s) => {
              const own = snap.prefs.mix[s], level = own ?? snap.ambience[s] ?? 0;
              return (
                <label key={s} className="row sound-row" data-own={own !== undefined || undefined}>
                  <span>{SOUND_NAMES[s]}</span>
                  <input type="range" min={0} max={1.5} step={0.05} value={level} aria-label={`${SOUND_NAMES[s]} level`} onChange={(e) => engine.setMix(s, Number(e.target.value))} />
                </label>
              );
            })}
            {Object.keys(snap.prefs.mix).length > 0 && (
              <button type="button" className="link-btn" onClick={() => engine.applyMix({})}>
                Back to the scene’s own mix
              </button>
            )}
          </details>
          {snap.status === "offline" && <p className="hint">Live weather can’t be reached from here, so the window shows mild weather. Pick conditions above, or use the desktop app.</p>}
        </section>
      )}
      <nav className="dock" aria-label="Window controls">
        <button type="button" className="ctl" aria-expanded={open === "city"} onClick={() => toggle("city")} title="Choose a city">
          <Icon name="pin" />
          {snap.city.name}
        </button>
        <button type="button" className="ctl" aria-expanded={open === "room"} aria-haspopup="listbox" onClick={() => toggle("room")} title="Choose a room">
          {roomName}
          <Icon name="chevronDown" />
        </button>
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
