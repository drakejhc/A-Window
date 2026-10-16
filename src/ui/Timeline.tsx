import { useEffect, useRef, useState, type DragEvent } from "react";

import { blocksOn, clamp, END_HOUR, formatDuration, formatHour, snap, START_HOUR, type Block, type Kind, type PlannerData } from "@/planner/model";
import { isSlotFree } from "@/planner/planning";

import { Icon } from "./icons";

export const HOUR_PX = 52;

/** What is being dragged: a block already on the timeline, or a task from a list. */
type Drag = { kind: Kind; id: string; duration: number; grabHours: number };
// dataTransfer can't be read during dragover, so the drag in progress is kept here.
let dragging: Drag | null = null;
export function startTaskDrag(e: DragEvent, id: string, duration: number) {
  dragging = { kind: "task", id, duration, grabHours: 0 };
  e.dataTransfer.setData("text/plain", id);
  e.dataTransfer.effectAllowed = "move";
}

type Props = {
  data: PlannerData;
  /** One column per day: a single day, or a week. */
  days: string[];
  todayKey: string;
  now: number;
  currentId: string | undefined;
  onOpen: (kind: Kind, id: string, date: string) => void;
  onToggle: (id: string) => void;
  onPlace: (kind: Kind, id: string, date: string, start: number) => void;
  onBlocked: () => void;
};

export function Timeline({ data, days, todayKey, now, currentId, onOpen, onToggle, onPlace, onBlocked }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const columns = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ date: string; start: number; duration: number; ok: boolean } | null>(null);
  const compact = days.length > 1;
  const showsToday = days.includes(todayKey);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = showsToday ? Math.max(START_HOUR, now - 1.5) : 7.5;
    el.scrollTop = (focus - START_HOUR) * HOUR_PX;
    // Only when the days shown change, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], days.length]);

  function slotFor(e: DragEvent) {
    const d = dragging, rect = columns.current?.getBoundingClientRect();
    if (!d || !rect) return null;
    const col = clamp(Math.floor(((e.clientX - rect.left) / rect.width) * days.length), 0, days.length - 1);
    const date = days[col]!;
    const start = clamp(snap(START_HOUR + (e.clientY - rect.top) / HOUR_PX - d.grabHours), START_HOUR, END_HOUR - d.duration / 60);
    const others = blocksOn(data, date).filter((b) => !(b.kind === d.kind && b.id === d.id));
    return { d, date, start, ok: isSlotFree(others, start, d.duration) };
  }

  function over(e: DragEvent) {
    const slot = slotFor(e);
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (preview?.start !== slot.start || preview.date !== slot.date || preview.ok !== slot.ok) setPreview({ date: slot.date, start: slot.start, duration: slot.d.duration, ok: slot.ok });
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    const slot = slotFor(e);
    setPreview(null);
    dragging = null;
    if (!slot) return;
    if (slot.ok) onPlace(slot.d.kind, slot.d.id, slot.date, slot.start);
    else onBlocked();
  }

  function grab(e: DragEvent<HTMLDivElement>, b: Block) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragging = { kind: b.kind, id: b.id, duration: b.duration, grabHours: (e.clientY - rect.top) / HOUR_PX };
    e.dataTransfer.setData("text/plain", b.id);
    e.dataTransfer.effectAllowed = "move";
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  const empty = days.every((d) => blocksOn(data, d).length === 0);
  return (
    <div className="timeline" ref={scroller} data-compact={compact || undefined}>
      <div className="timeline-grid" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
        {hours.map((h) => (
          <div key={h} className="hour" style={{ top: (h - START_HOUR) * HOUR_PX }}>
            <span>{formatHour(h).replace(":00", "")}</span>
          </div>
        ))}
        {empty && <p className="timeline-empty">Nothing planned. Drag a task here, or add one.</p>}
        <div
          className="columns"
          ref={columns}
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          onDragOver={over}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setPreview(null)}
          onDrop={drop}
        >
          {days.map((day) => (
            <div key={day} className="column" data-today={day === todayKey || undefined}>
              {blocksOn(data, day).map((b) => {
                const height = Math.max(compact ? 20 : 24, (b.duration / 60) * HOUR_PX - 3);
                const roomy = height >= (compact ? 52 : 40);
                return (
                  <div
                    key={`${b.kind}-${b.id}`}
                    className="block"
                    data-cat={b.category}
                    data-done={b.completed || undefined}
                    data-current={b.id === currentId || undefined}
                    style={{ top: (b.start - START_HOUR) * HOUR_PX + 1, height }}
                    draggable
                    onDragStart={(e) => grab(e, b)}
                    onDragEnd={() => {
                      dragging = null;
                      setPreview(null);
                    }}
                    onClick={() => onOpen(b.kind, b.id, day)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(b.kind, b.id, day)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${b.title}, ${formatHour(b.start)} to ${formatHour(b.start + b.duration / 60)}`}
                  >
                    {b.kind === "task" && !compact && (
                      <button
                        type="button"
                        className="check"
                        aria-pressed={b.completed}
                        aria-label={b.completed ? `Mark ${b.title} as not done` : `Mark ${b.title} as done`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggle(b.id);
                        }}
                      >
                        {b.completed && <Icon name="check" />}
                      </button>
                    )}
                    <div className="block-body">
                      <p className="block-title">
                        {b.repeat && <Icon name="replan" className="repeat-mark" aria-label="Repeats" />}
                        {b.title}
                      </p>
                      {roomy && (
                        <p className="block-meta">
                          {compact ? formatHour(b.start) : `${formatHour(b.start)} – ${formatHour(b.start + b.duration / 60)}`}
                          {b.meta && !compact && <> · {b.meta}</>}
                        </p>
                      )}
                    </div>
                    {roomy && !compact && (
                      <span className="block-dur" title={b.actual ? `${formatDuration(b.actual)} focused of ${formatDuration(b.duration)} planned` : undefined}>
                        {b.actual ? `${formatDuration(b.actual)} / ${formatDuration(b.duration)}` : formatDuration(b.duration)}
                      </span>
                    )}
                  </div>
                );
              })}
              {preview?.date === day && (
                <div className="drop-preview" data-ok={preview.ok} style={{ top: (preview.start - START_HOUR) * HOUR_PX + 1, height: Math.max(24, (preview.duration / 60) * HOUR_PX - 3) }}>
                  {preview.ok ? formatHour(preview.start) : "That time is taken"}
                </div>
              )}
              {day === todayKey && now >= START_HOUR && now <= END_HOUR && (
                <div className="now-line" style={{ top: (now - START_HOUR) * HOUR_PX }}>
                  {!compact && <span>{formatHour(now)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
