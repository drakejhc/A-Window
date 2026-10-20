import { useState } from "react";

import { BUCKETS, CATEGORIES, DURATIONS, formatDuration, formatHour, parseTime, REPEATS, toTime, uid, type Bucket, type Category, type Kind, type PlannerData, type Repeat, type Subtask } from "@/planner/model";

import { Icon } from "./icons";

export type Draft = {
  kind: Kind;
  id?: string;
  title: string;
  category: Category;
  duration: number;
  date: string;
  /** "HH:MM", or empty for a task that isn't on the timeline. */
  time: string;
  bucket: Bucket;
  meta: string;
  notes: string;
  subtasks: Subtask[];
  actual: number;
  repeat: Repeat | "";
  /** The day that was clicked, for "delete this day" on a repeating event. */
  occurrence: string;
  /** A new item started by clicking a time on the timeline, so it keeps that time as a task too. */
  picked?: boolean;
};

export function draftFor(data: PlannerData, kind: Kind, id: string, fallbackDate: string, occurrence = fallbackDate): Draft | null {
  if (kind === "task") {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return null;
    return { kind, id, title: t.title, category: t.category, duration: t.duration, date: t.date ?? fallbackDate, time: t.start !== undefined ? toTime(t.start) : "", bucket: t.bucket, meta: "", notes: t.notes ?? "", subtasks: t.subtasks ?? [], actual: t.actual ?? 0, repeat: "", occurrence };
  }
  const e = data.events.find((x) => x.id === id);
  if (!e) return null;
  return { kind, id, title: e.title, category: e.category, duration: e.duration, date: e.date, time: toTime(e.start), bucket: "Today", meta: e.meta ?? "", notes: e.notes ?? "", subtasks: e.subtasks ?? [], actual: e.actual ?? 0, repeat: e.repeat ?? "", occurrence };
}

export const newDraft = (kind: Kind, date: string, time = ""): Draft => ({
  kind, title: "", category: kind === "event" ? "personal" : "study", duration: kind === "event" ? 60 : 30, date, time: kind === "event" ? time || "09:00" : time, bucket: "Today", meta: "", notes: "", subtasks: [], actual: 0, repeat: "", occurrence: date,
});

/** Turns a new item into a task or an event, keeping what's been typed. An event always has a time; a task keeps
 *  one only if it was started from a time on the timeline, and otherwise goes to a list. */
export function switchKind(d: Draft, kind: Kind): Draft {
  if (d.kind === kind) return d;
  return { ...d, kind, time: kind === "event" ? d.time || "09:00" : d.picked ? d.time : "" };
}

type Props = { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; onDelete: (onlyThisDay: boolean) => void; onUnschedule: () => void };

export function Editor({ draft, onChange, onSave, onCancel, onDelete, onUnschedule }: Props) {
  const [newItem, setNewItem] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const isTask = draft.kind === "task";
  const durations = [...new Set([...DURATIONS, draft.duration])].sort((a, b) => a - b);
  const addItem = () => {
    if (!newItem.trim()) return;
    set("subtasks", [...draft.subtasks, { id: uid("s"), title: newItem.trim(), done: false }]);
    setNewItem("");
  };
  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="editor-head">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          <Icon name="left" /> Back
        </button>
        {draft.id ? (
          <span className="eyebrow">{isTask ? "Task" : "Event"}</span>
        ) : (
          <div className="seg" role="radiogroup" aria-label="New task or event">
            {(["task", "event"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={draft.kind === k} onClick={() => onChange(switchKind(draft, k))}>
                {k === "task" ? "Task" : "Event"}
              </button>
            ))}
          </div>
        )}
      </div>

      <input className="editor-title" autoFocus value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder={isTask ? "What needs doing?" : "What’s happening?"} aria-label="Title" />

      <div className="chips" role="radiogroup" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" role="radio" aria-checked={draft.category === c.value} className="chip" data-cat={c.value} onClick={() => set("category", c.value)}>
            <span className="cat-dot" />
            {c.label}
          </button>
        ))}
      </div>

      <div className="fields">
        <label className="field">
          <span>Date</span>
          <input type="date" value={draft.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
        </label>
        <label className="field">
          <span>{isTask ? "Time (optional)" : "Starts"}</span>
          <input type="time" step={900} value={draft.time} required={!isTask} onChange={(e) => set("time", e.target.value)} />
        </label>
        <label className="field">
          <span>Length</span>
          <select value={draft.duration} onChange={(e) => set("duration", Number(e.target.value))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {formatDuration(d)}
              </option>
            ))}
          </select>
        </label>
        {isTask ? (
          <label className="field">
            <span>List</span>
            <select value={draft.bucket} onChange={(e) => set("bucket", e.target.value as Bucket)}>
              {BUCKETS.map((b) => (
                <option key={b} value={b}>
                  {b === "This Week" ? "This week" : b}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span>Where</span>
            <input value={draft.meta} onChange={(e) => set("meta", e.target.value)} placeholder="Optional" />
          </label>
        )}
        {!isTask && (
          <label className="field">
            <span>Repeats</span>
            <select value={draft.repeat} onChange={(e) => set("repeat", e.target.value as Repeat | "")}>
              <option value="">Never</option>
              {REPEATS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {draft.time && (
        <p className="editor-note">
          <Icon name="clock" />
          {formatHour(parseTime(draft.time))} – {formatHour(parseTime(draft.time) + draft.duration / 60)}
          {isTask && draft.id && (
            <button type="button" className="link-btn" onClick={onUnschedule}>
              Take off the timeline
            </button>
          )}
        </p>
      )}

      <div className="checklist">
        <span className="label">Checklist</span>
        {draft.subtasks.map((s) => (
          <div key={s.id} className="check-row">
            <button type="button" className="check" aria-pressed={s.done} aria-label={s.done ? `Mark ${s.title} as not done` : `Mark ${s.title} as done`} onClick={() => set("subtasks", draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}>
              {s.done && <Icon name="check" />}
            </button>
            <span data-done={s.done || undefined}>{s.title}</span>
            <button type="button" className="icon-btn" aria-label={`Remove ${s.title}`} onClick={() => set("subtasks", draft.subtasks.filter((x) => x.id !== s.id))}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        <input
          className="check-add"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          onBlur={addItem}
          placeholder="Add a step"
          aria-label="Add a checklist step"
        />
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea rows={4} value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything to remember" />
      </label>

      {draft.actual > 0 && (
        <p className="editor-note">
          <Icon name="timer" />
          {formatDuration(draft.actual)} focused so far
          <button type="button" className="link-btn" onClick={() => set("actual", 0)}>
            Reset
          </button>
        </p>
      )}

      <div className="editor-foot">
        {draft.id ? (
          <div className="delete-group">
            {draft.repeat && (
              <button type="button" className="ghost-btn danger" onClick={() => onDelete(true)}>
                <Icon name="trash" /> This day
              </button>
            )}
            <button type="button" className="ghost-btn danger" onClick={() => onDelete(false)}>
              {!draft.repeat && <Icon name="trash" />} {draft.repeat ? "All" : "Delete"}
            </button>
          </div>
        ) : (
          <span />
        )}
        <button type="submit" className="primary-btn" disabled={!draft.title.trim() || (!isTask && !draft.time)}>
          {draft.id ? "Done" : "Add"}
        </button>
      </div>
    </form>
  );
}
