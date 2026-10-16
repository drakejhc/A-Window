import { useState, type ReactNode } from "react";

import { addDays, blocksOn, BUCKETS, formatDuration, formatHour, fromKey, startOfWeek, toKey, weekdayNames, type Bucket, type Kind, type Task } from "@/planner/model";
import type { PlannerState } from "@/planner/store";

import { Icon } from "./icons";
import { startTaskDrag, Timeline } from "./Timeline";
import { Tray } from "./Tray";

export type View = "day" | "week" | "month";
export type Mode = "calendar" | "tasks";

type Props = {
  state: PlannerState;
  visible: boolean;
  selected: string;
  todayKey: string;
  now: number;
  currentId: string | undefined;
  behind: number;
  view: View;
  mode: Mode;
  bucket: Bucket;
  trayOpen: boolean;
  drawer: ReactNode;
  onView: (v: View) => void;
  onMode: (m: Mode) => void;
  onBucket: (b: Bucket) => void;
  onTrayOpen: (open: boolean) => void;
  onSelect: (date: string) => void;
  onOpen: (kind: Kind, id: string, date?: string) => void;
  onToggle: (id: string) => void;
  onPlace: (kind: Kind, id: string, date: string, start: number) => void;
  onSchedule: (id: string) => void;
  onBlocked: () => void;
  onReplan: () => void;
  onFocus: () => void;
  onQuickAdd: () => void;
  onNewEvent: () => void;
  onStartFresh: () => void;
  onSettings: () => void;
};

const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const bucketLabel = (b: Bucket) => (b === "This Week" ? "This week" : b);

/** The full planner: a frosted workspace that fades in over the window. */
export function Workspace(p: Props) {
  const { state, selected, todayKey, view } = p;
  const date = fromKey(selected);
  const week = Array.from({ length: 7 }, (_, i) => toKey(addDays(startOfWeek(date), i)));

  const step = (dir: 1 | -1) => p.onSelect(toKey(view === "month" ? addMonths(date, dir) : addDays(date, view === "week" ? dir * 7 : dir)));
  const isCurrent = view === "day" ? selected === todayKey : view === "week" ? week.includes(todayKey) : selected.slice(0, 7) === todayKey.slice(0, 7);
  const dayBlocks = blocksOn(state, selected);
  const title =
    p.mode === "tasks"
      ? bucketLabel(p.bucket)
      : view === "day"
        ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
        : view === "week"
          ? `${fromKey(week[0]!).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${fromKey(week[6]!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const subtitle =
    p.mode === "tasks"
      ? `${state.tasks.filter((t) => t.bucket === p.bucket && !t.completed).length} open`
      : view === "day"
        ? dayBlocks.length
          ? `${dayBlocks.length} ${dayBlocks.length === 1 ? "block" : "blocks"} · ${formatDuration(dayBlocks.reduce((s, b) => s + b.duration, 0))} planned`
          : "A clear day"
        : view === "week"
          ? `${week.reduce((n, d) => n + blocksOn(state, d).length, 0)} blocks this week`
          : `${state.events.filter((e) => e.date.startsWith(selected.slice(0, 7))).length} commitments`;

  return (
    <div className="workspace" data-visible={p.visible || undefined} aria-hidden={!p.visible}>
      <aside className="ws-side">
        <div className="brand">
          <img src="./icon.png" alt="" width={36} height={36} />
          <div>
            <strong>A Window</strong>
            <span>your day, by the window</span>
          </div>
        </div>

        <p className="side-label">Calendar</p>
        {(["day", "week", "month"] as const).map((v) => (
          <button key={v} type="button" className="nav-item" aria-pressed={p.mode === "calendar" && view === v} onClick={() => (p.onMode("calendar"), p.onView(v))}>
            <Icon name={v === "day" ? "clock" : "calendar"} />
            {v === "day" ? "Day" : v === "week" ? "Week" : "Month"}
            <kbd>{v[0]!.toUpperCase()}</kbd>
          </button>
        ))}

        <MiniCalendar key={selected.slice(0, 7)} state={state} selected={selected} todayKey={todayKey} onSelect={(d) => (p.onMode("calendar"), p.onSelect(d))} />

        <p className="side-label">Tasks</p>
        {BUCKETS.map((b) => (
          <button key={b} type="button" className="nav-item" aria-pressed={p.mode === "tasks" && p.bucket === b} onClick={() => (p.onMode("tasks"), p.onBucket(b))}>
            <Icon name={b === "Today" ? "check" : b === "This Week" ? "calendar" : "panel"} />
            {bucketLabel(b)}
            <span className="nav-count">{state.tasks.filter((t) => t.bucket === b && !t.completed).length}</span>
          </button>
        ))}

        <Progress state={state} todayKey={todayKey} />
        <button type="button" className="nav-item settings-link" onClick={p.onSettings}>
          <Icon name="gear" />
          Settings
        </button>
      </aside>

      <main className="ws-main">
        <header className="ws-head">
          <div>
            <h2>
              {title}
              {p.mode === "calendar" && isCurrent && <span className="badge">{view === "day" ? "Today" : view === "week" ? "This week" : "This month"}</span>}
            </h2>
            <p className="sheet-sub">{subtitle}</p>
          </div>
          <div className="ws-actions">
            {p.mode === "calendar" && (
              <>
                <button type="button" className="tool" disabled={isCurrent} onClick={() => p.onSelect(todayKey)}>
                  Today
                </button>
                <button type="button" className="tool icon" aria-label="Previous" onClick={() => step(-1)}>
                  <Icon name="left" />
                </button>
                <button type="button" className="tool icon" aria-label="Next" onClick={() => step(1)}>
                  <Icon name="right" />
                </button>
              </>
            )}
            <button type="button" className="tool icon" aria-pressed={p.trayOpen} aria-label="Task tray" title="Task tray" onClick={() => p.onTrayOpen(!p.trayOpen)}>
              <Icon name="panel" />
            </button>
            <button type="button" className="tool" onClick={p.onReplan} title="Replan the rest of today (R)">
              <Icon name="replan" /> Replan
              {p.behind > 0 && <span className="pip">{p.behind}</span>}
            </button>
            <button type="button" className="tool" onClick={p.onFocus} title="Focus (F)">
              <Icon name="timer" /> Focus
            </button>
            <button type="button" className="tool" onClick={p.onQuickAdd} title="Quick add (⌘K)">
              <Icon name="plus" /> Quick add <kbd>⌘K</kbd>
            </button>
            <button type="button" className="primary-btn" onClick={p.onNewEvent}>
              <Icon name="calendar" /> Event
            </button>
          </div>
        </header>

        {state.sample && (
          <p className="notice ws-notice">
            This is an example plan, so you can see how things work.
            <button type="button" className="link-btn" onClick={p.onStartFresh}>
              Start with a clear plan
            </button>
          </p>
        )}

        <div className="ws-body">
          <section className="ws-view">
            {p.mode === "tasks" ? (
              <TasksView tasks={state.tasks} bucket={p.bucket} onOpen={(id) => p.onOpen("task", id)} onToggle={p.onToggle} />
            ) : view === "month" ? (
              <MonthView state={state} selected={selected} todayKey={todayKey} onPick={(d) => (p.onSelect(d), p.onView("day"))} />
            ) : (
              <>
                {view === "week" && (
                  <div className="week-head">
                    {week.map((d) => (
                      <button key={d} type="button" data-today={d === todayKey || undefined} aria-pressed={d === selected} onClick={() => (p.onSelect(d), p.onView("day"))}>
                        <span>{fromKey(d).toLocaleDateString(undefined, { weekday: "short" })}</span>
                        <strong>{fromKey(d).getDate()}</strong>
                      </button>
                    ))}
                  </div>
                )}
                <Timeline
                  data={state}
                  days={view === "week" ? week : [selected]}
                  todayKey={todayKey}
                  now={p.now}
                  currentId={p.currentId}
                  onOpen={p.onOpen}
                  onToggle={p.onToggle}
                  onPlace={p.onPlace}
                  onBlocked={p.onBlocked}
                />
              </>
            )}
          </section>
          {p.trayOpen && (
            <aside className="ws-tray">
              <Tray tasks={state.tasks} open onOpenChange={() => p.onTrayOpen(false)} onOpen={(id) => p.onOpen("task", id)} onToggle={p.onToggle} onSchedule={p.onSchedule} />
            </aside>
          )}
        </div>
        {p.drawer && <div className="drawer">{p.drawer}</div>}
      </main>
    </div>
  );
}

function MiniCalendar({ state, selected, todayKey, onSelect }: { state: PlannerState; selected: string; todayKey: string; onSelect: (d: string) => void }) {
  const [month, setMonth] = useState(() => new Date(fromKey(selected).getFullYear(), fromKey(selected).getMonth(), 1));
  const first = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  return (
    <div className="mini">
      <div className="mini-head">
        <span>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <Icon name="left" />
        </button>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <Icon name="right" />
        </button>
      </div>
      <div className="mini-grid">
        {weekdayNames("narrow").map((d, i) => (
          <span key={i} className="mini-dow">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const key = toKey(d);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={key === selected}
              data-today={key === todayKey || undefined}
              data-outside={d.getMonth() !== month.getMonth() || undefined}
              data-busy={blocksOn(state, key).length > 0 || undefined}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => onSelect(key)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Progress({ state, todayKey }: { state: PlannerState; todayKey: string }) {
  const todays = state.tasks.filter((t) => t.date === todayKey || (t.bucket === "Today" && !t.date));
  const done = todays.filter((t) => t.completed).length;
  const blocks = blocksOn(state, todayKey);
  const planned = blocks.reduce((s, b) => s + b.duration, 0);
  const focused = blocks.reduce((s, b) => s + (b.actual ?? 0), 0);
  return (
    <div className="progress">
      <div className="progress-row">
        <span>Today’s progress</span>
        <span>
          {done}/{todays.length}
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${todays.length ? (done / todays.length) * 100 : 0}%` }} />
      </div>
      <p>
        Planned {formatDuration(planned)}
        {focused > 0 && ` · Focused ${formatDuration(focused)}`}
      </p>
    </div>
  );
}

function MonthView({ state, selected, todayKey, onPick }: { state: PlannerState; selected: string; todayKey: string; onPick: (d: string) => void }) {
  const date = fromKey(selected);
  const first = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  return (
    <div className="month">
      {weekdayNames("short").map((d) => (
        <span key={d} className="month-dow">
          {d}
        </span>
      ))}
      {days.map((d) => {
        const key = toKey(d), blocks = blocksOn(state, key);
        return (
          <button key={key} type="button" className="month-cell" data-today={key === todayKey || undefined} data-outside={d.getMonth() !== date.getMonth() || undefined} onClick={() => onPick(key)}>
            <span className="month-num">{d.getDate()}</span>
            {blocks.slice(0, 3).map((b) => (
              <span key={`${b.kind}-${b.id}`} className="month-chip" data-cat={b.category} data-done={b.completed || undefined}>
                <span className="cat-dot" />
                {formatHour(b.start).replace(":00", "")} {b.title}
              </span>
            ))}
            {blocks.length > 3 && <span className="month-more">+{blocks.length - 3} more</span>}
          </button>
        );
      })}
    </div>
  );
}

function TasksView({ tasks, bucket, onOpen, onToggle }: { tasks: Task[]; bucket: Bucket; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = tasks.filter((t) => (q ? t.title.toLowerCase().includes(q) : t.bucket === bucket));
  const open = list.filter((t) => !t.completed), done = list.filter((t) => t.completed);
  const row = (t: Task) => (
    <li key={t.id} className="task-row" data-cat={t.category} data-done={t.completed || undefined} draggable={!t.completed} onDragStart={(e) => startTaskDrag(e, t.id, t.duration)}>
      <button type="button" className="check" aria-pressed={!!t.completed} aria-label={t.completed ? `Mark ${t.title} as not done` : `Mark ${t.title} as done`} onClick={() => onToggle(t.id)}>
        {t.completed && <Icon name="check" />}
      </button>
      <button type="button" className="task-title" onClick={() => onOpen(t.id)}>
        {t.title}
      </button>
      <span className="task-when">{t.date && t.start !== undefined ? `${fromKey(t.date).toLocaleDateString(undefined, { weekday: "short" })} ${formatHour(t.start)}` : "Unscheduled"}</span>
      <span className="tray-dur">{formatDuration(t.duration)}</span>
    </li>
  );
  return (
    <div className="tasks-view">
      <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all tasks" aria-label="Search all tasks" />
      <ul className="task-list">
        {open.length === 0 && <li className="tray-empty">{q ? "No tasks match." : `Nothing open in ${bucketLabel(bucket).toLowerCase()}.`}</li>}
        {open.map(row)}
      </ul>
      {done.length > 0 && (
        <>
          <p className="side-label">Done</p>
          <ul className="task-list">{done.map(row)}</ul>
        </>
      )}
    </div>
  );
}
