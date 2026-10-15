import { useState } from "react";

import { addDays, blocksOn, CATEGORIES, formatDuration, formatHour, fromKey, startOfWeek, toKey, type Kind } from "@/planner/model";
import { parseQuickAdd } from "@/planner/quickadd";
import type { PlannerState } from "@/planner/store";

import { Icon } from "./icons";
import { Timeline } from "./Timeline";
import { Tray } from "./Tray";

type Props = {
  state: PlannerState;
  selected: string;
  todayKey: string;
  now: number;
  currentId: string | undefined;
  behind: number;
  trayOpen: boolean;
  onTrayOpen: (open: boolean) => void;
  onSelect: (date: string) => void;
  onQuickAdd: (text: string) => void;
  onNewEvent: () => void;
  onOpen: (kind: Kind, id: string) => void;
  onToggle: (id: string) => void;
  onPlace: (kind: Kind, id: string, start: number) => void;
  onSchedule: (id: string) => void;
  onBlocked: () => void;
  onReplan: () => void;
  onStartFresh: () => void;
  quickAddRef: React.RefObject<HTMLInputElement | null>;
};

const dayLabel = (key: string, todayKey: string) => {
  const diff = Math.round((fromKey(key).getTime() - fromKey(todayKey).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

/** The day sheet: everything about the selected day, beside the window. */
export function Sheet(p: Props) {
  const { state, selected, todayKey } = p;
  const [text, setText] = useState("");
  const date = fromKey(selected);
  const blocks = blocksOn(state, selected);
  const planned = blocks.reduce((s, b) => s + b.duration, 0);
  const focused = blocks.reduce((s, b) => s + (b.actual ?? 0), 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i));
  const parsed = text.trim() ? parseQuickAdd(text) : null;

  return (
    <aside className="sheet" aria-label="Your day">
      <header className="sheet-head">
        <div>
          <p className="eyebrow">{dayLabel(selected, todayKey)}</p>
          <h2>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h2>
          <p className="sheet-sub">
            {blocks.length ? `${blocks.length} ${blocks.length === 1 ? "block" : "blocks"} · ${formatDuration(planned)} planned` : "A clear day"}
            {focused > 0 && ` · ${formatDuration(focused)} focused`}
          </p>
        </div>
        <button type="button" className="icon-btn boxed" onClick={p.onNewEvent} title="New event" aria-label="New event">
          <Icon name="calendar" />
        </button>
      </header>

      <nav className="week" aria-label="Week">
        <button type="button" className="icon-btn" aria-label="Previous week" onClick={() => p.onSelect(toKey(addDays(date, -7)))}>
          <Icon name="left" />
        </button>
        {week.map((d) => {
          const key = toKey(d);
          return (
            <button key={key} type="button" className="day" aria-pressed={key === selected} data-today={key === todayKey || undefined} data-busy={blocksOn(state, key).length > 0 || undefined} onClick={() => p.onSelect(key)} aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}>
              <span>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              <strong>{d.getDate()}</strong>
            </button>
          );
        })}
        <button type="button" className="icon-btn" aria-label="Next week" onClick={() => p.onSelect(toKey(addDays(date, 7)))}>
          <Icon name="right" />
        </button>
      </nav>

      {state.sample && (
        <p className="notice">
          This is an example plan, so you can see how things work.
          <button type="button" className="link-btn" onClick={p.onStartFresh}>
            Start with a clear plan
          </button>
        </p>
      )}
      {p.behind > 0 && selected === todayKey && (
        <button type="button" className="notice behind" onClick={p.onReplan}>
          <Icon name="replan" />
          {p.behind} {p.behind === 1 ? "task" : "tasks"} fell behind. Replan the rest of today
        </button>
      )}

      <form
        className="quick"
        onSubmit={(e) => {
          e.preventDefault();
          if (!parsed?.title) return;
          p.onQuickAdd(text);
          setText("");
        }}
      >
        <Icon name="plus" className="quick-icon" />
        <input ref={p.quickAddRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (setText(""), e.currentTarget.blur())} placeholder="Add a task, e.g. Gym tomorrow 7am 45m #health" aria-label="Add a task" />
        {parsed && (
          <div className="quick-preview" aria-live="polite">
            {parsed.date && <span>{dayLabel(parsed.date, todayKey)}</span>}
            {parsed.start !== undefined && <span>{formatHour(parsed.start)}</span>}
            {parsed.duration && <span>{formatDuration(parsed.duration)}</span>}
            {parsed.category && <span data-cat={parsed.category}>{CATEGORIES.find((c) => c.value === parsed.category)?.label}</span>}
            {parsed.bucket && <span>{parsed.bucket === "This Week" ? "This week" : parsed.bucket}</span>}
            <span className="quick-enter">Enter to add</span>
          </div>
        )}
      </form>

      <Timeline data={state} date={selected} isToday={selected === todayKey} now={p.now} currentId={p.currentId} onOpen={p.onOpen} onToggle={p.onToggle} onPlace={p.onPlace} onBlocked={p.onBlocked} />

      <Tray tasks={state.tasks} open={p.trayOpen} onOpenChange={p.onTrayOpen} onOpen={(id) => p.onOpen("task", id)} onToggle={p.onToggle} onSchedule={p.onSchedule} />
    </aside>
  );
}
