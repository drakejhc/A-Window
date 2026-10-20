import { addDays, blocksOn, formatDuration, fromKey, startOfWeek, toKey, type Bucket, type Kind } from "@/planner/model";
import type { PlannerState } from "@/planner/store";

import { AddTask, dayLabel } from "./AddTask";
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
  onQuickAdd: (text: string, bucket?: Bucket) => void;
  onNewEvent: () => void;
  onOpen: (kind: Kind, id: string, date?: string) => void;
  onToggle: (id: string) => void;
  onPlace: (kind: Kind, id: string, date: string, start: number) => void;
  onSchedule: (id: string) => void;
  onBlocked: () => void;
  onCreate: (date: string, start: number) => void;
  onReplan: () => void;
  onStartFresh: () => void;
  quickAddRef: React.RefObject<HTMLInputElement | null>;
};

/** The day sheet: everything about the selected day, beside the window. */
export function Sheet(p: Props) {
  const { state, selected, todayKey } = p;
  const date = fromKey(selected);
  const blocks = blocksOn(state, selected);
  const planned = blocks.reduce((s, b) => s + b.duration, 0);
  const focused = blocks.reduce((s, b) => s + (b.actual ?? 0), 0);
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i));

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

      <AddTask todayKey={todayKey} onAdd={p.onQuickAdd} inputRef={p.quickAddRef} />

      <Timeline data={state} days={[selected]} todayKey={todayKey} now={p.now} currentId={p.currentId} onOpen={p.onOpen} onToggle={p.onToggle} onPlace={p.onPlace} onBlocked={p.onBlocked} onCreate={p.onCreate} />

      <Tray tasks={state.tasks} todayKey={todayKey} onAdd={p.onQuickAdd} open={p.trayOpen} onOpenChange={p.onTrayOpen} onOpen={(id) => p.onOpen("task", id)} onToggle={p.onToggle} onSchedule={p.onSchedule} />
    </aside>
  );
}
