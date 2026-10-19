import { useState } from "react";

import { uid } from "@/planner/model";
import { formatMinutes, parseMinutes, type SavedScene, type ScenesState } from "@/scenes";
import { OWN_ROOM, ROOMS, VIEWS } from "@/window/engine";

import { useWindow } from "./use-window";

type Props = {
  scenes: ScenesState;
  onScenes: (fn: (s: ScenesState) => ScenesState) => void;
  onShow: (scene: SavedScene) => void;
};

const roomName = (id: string) => (id === "auto" ? "Auto room" : id === OWN_ROOM ? "Your own background" : (ROOMS.find((r) => r.id === id)?.name ?? id));
const viewName = (id: string) => (id === "auto" ? "its own view" : (VIEWS.find((v) => v.id === id)?.name ?? id));

/** Saved scenes in Settings: save the window as it is, show one again, and schedule them through the day. */
export function ScenesSection({ scenes, onScenes, onShow }: Props) {
  const { snap } = useWindow();
  const [name, setName] = useState("");

  const save = () => {
    const sc: SavedScene = { id: uid("s"), name: name.trim() || `Scene ${scenes.scenes.length + 1}`, room: snap.prefs.room, view: snap.prefs.view, mix: snap.prefs.mix, sound: snap.prefs.sound };
    onScenes((s) => ({ ...s, scenes: [...s.scenes, sc] }));
    setName("");
  };
  const remove = (id: string) =>
    onScenes((s) => ({ ...s, scenes: s.scenes.filter((x) => x.id !== id), schedule: s.schedule.filter((e) => e.scene !== id), focus: s.focus === id ? null : s.focus }));
  const setEntry = (i: number, patch: Partial<ScenesState["schedule"][number]>) =>
    onScenes((s) => ({ ...s, schedule: s.schedule.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));

  return (
    <section>
      <h3>Scenes</h3>
      <p className="hint">Save the window as it is now (its room, view and sounds), come back to it any time, and have the window change through the day.</p>
      {scenes.scenes.map((sc) => (
        <div className="setting-row" key={sc.id}>
          <span>
            {sc.name}
            <small>
              {roomName(sc.room)} · {viewName(sc.view)}
              {sc.sound ? "" : " · sound off"}
            </small>
          </span>
          <div className="setting-actions">
            <button type="button" className="tool" onClick={() => onShow(sc)}>
              Show
            </button>
            <button type="button" className="tool danger" onClick={() => remove(sc.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
      <form
        className="scene-save"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it (Morning study, Late evening…)" aria-label="Scene name" maxLength={60} />
        <button type="submit" className="tool">
          Save the window as a scene
        </button>
      </form>
      {scenes.scenes.length > 0 && (
        <>
          <h4>Through the day</h4>
          {scenes.schedule.map((e, i) => (
            <div className="setting-row schedule-row" key={i}>
              <span>
                From
                <input type="time" value={formatMinutes(e.from)} onChange={(ev) => setEntry(i, { from: parseMinutes(ev.target.value) })} aria-label="From" />
              </span>
              <select value={e.scene} onChange={(ev) => setEntry(i, { scene: ev.target.value })} aria-label="Scene">
                {scenes.scenes.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
              <button type="button" className="tool" aria-label="Remove this time" onClick={() => onScenes((s) => ({ ...s, schedule: s.schedule.filter((_, j) => j !== i) }))}>
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="link-btn"
            onClick={() => onScenes((s) => ({ ...s, schedule: [...s.schedule, { scene: s.scenes[0]!.id, from: s.schedule.length ? 21 * 60 : 8 * 60 }] }))}
          >
            {scenes.schedule.length ? "Add another time" : "Change scenes through the day"}
          </button>
          <label className="setting-row">
            <span>
              During Focus
              <small>Switch to a scene while you focus, and back after</small>
            </span>
            <select value={scenes.focus ?? ""} onChange={(e) => onScenes((s) => ({ ...s, focus: e.target.value || null }))}>
              <option value="">Keep the window as it is</option>
              {scenes.scenes.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
