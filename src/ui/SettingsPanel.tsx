import { useEffect, useRef, useState } from "react";

import { downloadBackup, readBackup, restoreBackup, type Backup } from "@/backup";
import { desktop, type DesktopSettings } from "@/desktop";
import { useMusic } from "@/music";
import { useSettings } from "@/settings";

import type { SavedScene, ScenesState } from "@/scenes";

import { CityPicker } from "./CityPicker";
import { ScenesSection } from "./ScenesSection";
import { FOCUS_LENGTHS } from "./Dock";
import { useWindow } from "./use-window";

type Props = {
  layout: "full" | "side";
  onLayout: (l: "full" | "side") => void;
  focusMinutes: number;
  onFocusMinutes: (m: number) => void;
  onStartFresh: () => void;
  scenes: ScenesState;
  onScenes: (fn: (s: ScenesState) => ScenesState) => void;
  onShowScene: (scene: SavedScene) => void;
  onClose: () => void;
};

function Seg<T extends string | number | boolean>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="setting-row toggle-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsPanel({ layout, onLayout, focusMinutes, onFocusMinutes, onStartFresh, scenes, onScenes, onShowScene, onClose }: Props) {
  const { settings, update } = useSettings();
  const { snap } = useWindow();
  const music = useMusic();
  const [desk, setDesk] = useState<DesktopSettings | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Backup | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [citiesOpen, setCitiesOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void desktop?.getSettings().then(setDesk);
  }, []);

  async function setDesktop(patch: Partial<DesktopSettings>) {
    if (!desktop) return;
    const next = await desktop.setSettings(patch);
    setDesk(next);
    setMessage(next.error ?? "");
  }

  async function setNotify(on: boolean) {
    if (on && "Notification" in window && Notification.permission !== "granted") {
      const answer = await Notification.requestPermission();
      if (answer !== "granted") return setMessage("Notifications are blocked for this app. Allow them in your system settings, then try again.");
    }
    update({ notify: on });
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Done
          </button>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}

        <section>
          <h3>Window</h3>
          <div className="setting-row">
            <span>
              Looking out over
              <small>
                {snap.city.name}
                {snap.city.region ? `, ${snap.city.region}` : ""}
              </small>
            </span>
            <button type="button" className="tool" aria-expanded={citiesOpen} onClick={() => setCitiesOpen((v) => !v)}>
              {citiesOpen ? "Close" : "Change city"}
            </button>
          </div>
          {citiesOpen && <CityPicker onPick={() => setCitiesOpen(false)} />}
          <Seg label="Temperature" value={settings.units} options={[["c", "°C"], ["f", "°F"]]} onChange={(units) => update({ units })} />
          <Seg
            label="Battery saver"
            value={settings.saver}
            options={[["auto", "On battery"], ["on", "Always"], ["off", "Off"]]}
            onChange={(saver) => update({ saver })}
          />
        </section>

        <ScenesSection scenes={scenes} onScenes={onScenes} onShow={onShowScene} />

        <section>
          <h3>Planner</h3>
          <Seg label="Layout" value={layout} options={[["full", "Full workspace"], ["side", "Side sheet"]]} onChange={onLayout} />
          <Seg label="Clock" value={settings.clock24} options={[[false, "12-hour"], [true, "24-hour"]]} onChange={(clock24) => update({ clock24 })} />
          <Seg label="Week starts on" value={settings.weekStart} options={[[1, "Monday"], [0, "Sunday"]]} onChange={(weekStart) => update({ weekStart })} />
          <Seg label="Free focus session" value={focusMinutes} options={FOCUS_LENGTHS.map((m) => [m, `${m} min`] as [number, string])} onChange={onFocusMinutes} />
          <Toggle label="Reminders" hint="A notification five minutes before each block starts" checked={settings.notify} onChange={(v) => void setNotify(v)} />
        </section>

        {desktop && (
          <section>
            <h3>Desktop</h3>
            <Toggle
              label="Show what’s playing"
              hint={
                music.np
                  ? `${music.np.app}: ${music.np.title} · ${music.np.artist}`
                  : desktop.platform === "win32"
                    ? "Spotify. A record player appears on the sill and the ambience turns down while it plays"
                    : "Spotify or Apple Music. The first time, macOS asks to let A Window see what’s playing"
              }
              checked={settings.music}
              onChange={(music) => update({ music })}
            />
            {desk && (
              <>
                <Toggle
                  label="Live wallpaper"
                  hint={desktop.platform === "win32" ? "The window behind your desktop icons. Experimental on Windows" : "The window behind your desktop icons, even with the app closed"}
                  checked={desk.wallpaper}
                  onChange={(wallpaper) => void setDesktop({ wallpaper })}
                />
                {desk.wallpaper && (
                  <Seg label="Wallpaper shows" value={desk.wallpaperStyle} options={[["room", "The room"], ["view", "Just the view"]]} onChange={(wallpaperStyle) => void setDesktop({ wallpaperStyle })} />
                )}
                <Toggle label="Open at login" hint="Starts quietly in the menu bar, with the wallpaper if it’s on" checked={desk.openAtLogin} onChange={(openAtLogin) => void setDesktop({ openAtLogin })} />
              </>
            )}
          </section>
        )}

        <section>
          <h3>Your data</h3>
          <p className="hint">
            Your plan stays on this device. Weather and city search send only a city’s name or coordinates to Open-Meteo.
            {desktop && " A copy is saved in the app’s backups folder each day you use it, for the last 14 days."}
          </p>
          <div className="setting-actions">
            <button type="button" className="tool" onClick={downloadBackup}>
              Export a backup
            </button>
            <button type="button" className="tool" onClick={() => file.current?.click()}>
              Import a backup
            </button>
            {desktop && (
              <button type="button" className="tool" onClick={() => desktop?.openBackups()}>
                Backups folder
              </button>
            )}
            {!confirmClear ? (
              <button type="button" className="tool danger" onClick={() => setConfirmClear(true)}>
                Clear my plan
              </button>
            ) : (
              <span className="confirm">
                Clear every task and event?
                <button
                  type="button"
                  className="tool danger"
                  onClick={() => {
                    onStartFresh();
                    setConfirmClear(false);
                    onClose();
                  }}
                >
                  Clear
                </button>
                <button type="button" className="tool" onClick={() => setConfirmClear(false)}>
                  Keep
                </button>
              </span>
            )}
          </div>
          {pending && (
            <p className="notice">
              Replace everything here with the backup from {new Date(pending.exported).toLocaleDateString()}?
              <button type="button" className="link-btn" onClick={() => restoreBackup(pending)}>
                Replace and reload
              </button>
              <button type="button" className="link-btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </p>
          )}
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const b = readBackup(await f.text());
              if (typeof b === "string") setMessage(b);
              else setPending(b);
            }}
          />
        </section>

        <p className="about">A Window{desktop ? ` ${desktop.version}` : ""} · Weather by Open-Meteo</p>
      </div>
    </div>
  );
}
