import { useRef, useState } from "react";

import { removeBackdropFile, saveBackdropFile, updateBackdrop, useBackdrop, type Slot } from "@/backdrop";
import { OWN_ROOM } from "@/window/engine";

import { Seg, Toggle } from "./controls";
import { useWindow } from "./use-window";

const ACCEPT = "image/*,video/*";

/** A hidden file chooser for one slot: keeps the file, then calls `done`. */
function useChooser(onError: (message: string | null) => void) {
  const input = useRef<HTMLInputElement>(null);
  const slot = useRef<Slot>("day");
  const after = useRef<() => void>(() => {});
  const [busy, setBusy] = useState(false);
  const choose = (s: Slot, done: () => void = () => {}) => {
    slot.current = s;
    after.current = done;
    input.current?.click();
  };
  const element = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        onError(null);
        saveBackdropFile(slot.current, file)
          .then(() => after.current())
          .catch((err: unknown) => onError(err instanceof Error ? err.message : "That file couldn’t be used."))
          .finally(() => setBusy(false));
      }}
    />
  );
  return { choose, element, busy };
}

/** "Your own background" in the room menu: choosing it the first time asks for a picture or video. */
export function OwnBackgroundOption({ onError }: { onError: (message: string | null) => void }) {
  const { engine, snap } = useWindow();
  const b = useBackdrop();
  const { choose, element, busy } = useChooser(onError);
  const pick = () => (b.day ? engine.setScene({ room: OWN_ROOM }) : choose("day", () => engine.setScene({ room: OWN_ROOM })));
  return (
    <li>
      <button type="button" role="option" aria-selected={snap.prefs.room === OWN_ROOM} onClick={pick} disabled={busy}>
        <span className="room-swatch" data-room="own" aria-hidden style={b.day ? { background: `rgb(${b.day.tint.join(",")})` } : undefined}>
          {!b.day && "+"}
        </span>
        <span className="room-text">
          <span className="room-name">Your own background</span>
          <span className="room-blurb">{busy ? "Adding it…" : b.day ? b.day.name : "A picture or video of yours, even 4K, in place of the window and the room"}</span>
        </span>
        <span className="room-kind">Yours</span>
      </button>
      {element}
    </li>
  );
}

/** The choices for your own background, shown under the room list while it's in use. */
export function OwnBackgroundSettings({ error, onError }: { error: string | null; onError: (message: string | null) => void }) {
  const b = useBackdrop();
  const { choose, element, busy } = useChooser(onError);
  return (
    <div className="own-settings">
      <div className="own-file">
        <span className="own-label">Background</span>
        <span className="own-name" title={b.day?.name}>
          {b.day ? b.day.name : "None yet"}
        </span>
        <button type="button" className="link-btn" disabled={busy} onClick={() => choose("day")}>
          {b.day ? "Change" : "Choose"}
        </button>
      </div>
      <div className="own-file">
        <span className="own-label">After dark</span>
        <span className="own-name" title={b.night?.name}>
          {b.night ? b.night.name : "The same (optional)"}
        </span>
        <button type="button" className="link-btn" disabled={busy} onClick={() => choose("night")}>
          {b.night ? "Change" : "Choose"}
        </button>
        {b.night && (
          <button type="button" className="link-btn" onClick={() => void removeBackdropFile("night")}>
            Remove
          </button>
        )}
      </div>
      {busy && <p className="hint">Adding it… a big video can take a moment.</p>}
      {error && <p className="own-error">{error}</p>}
      <Seg label="Fit" value={b.fit} options={[["cover", "Fill the screen"], ["contain", "Show it whole"]]} onChange={(fit) => updateBackdrop({ fit })} />
      {!b.night && <Toggle label="Dim after dark" hint="Follows sunset in the window’s city" checked={b.dim} onChange={(dim) => updateBackdrop({ dim })} />}
      <Toggle label="Rain and snow" hint="The city’s live weather on the glass" checked={b.weather} onChange={(weather) => updateBackdrop({ weather })} />
      <p className="hint">Pictures (JPG, PNG, WebP, GIF) or videos (MP4, WebM), kept on this device only. A night picture fades in as the sun sets.</p>
      {element}
    </div>
  );
}
