import { useEffect, useRef, useState, type DragEvent } from "react";

import { blocksOn, clamp, END_HOUR, formatDuration, formatHour, snap, START_HOUR, type Block, type Kind, type PlannerData } from "@/planner/model";
import { isSlotFree } from "@/planner/planning";

import { Icon } from "./icons";

export const HOUR_PX = 52;

/** What is being dragged: a block already on the timeline, or a task from the tray. */
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
  date: string;
  isToday: boolean;
  now: number;
  currentId: string | undefined;
  onOpen: (kind: Kind, id: string) => void;
  onToggle: (id: string) => void;
  onPlace: (kind: Kind, id: string, start: number) => void;
  onBlocked: () => void;
};

export function Timeline({ data, date, isToday, now, currentId, onOpen, onToggle, onPlace, onBlocked }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ start: number; duration: number; ok: boolean } | null>(null);
  const blocks = blocksOn(data, date);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focus = isToday ? Math.max(START_HOUR, now - 1.5) : 7.5;
    el.scrollTop = (focus - START_HOUR) * HOUR_PX;
    // Only when the day changes, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function slotFor(e: DragEvent) {
    const d = dragging, rect = grid.current?.getBoundingClientRect();
    if (!d || !rect) return null;
    const start = clamp(snap(START_HOUR + (e.clientY - rect.top) / HOUR_PX - d.grabHours), START_HOUR, END_HOUR - d.duration / 60);
    const others = blocks.filter((b) => !(b.kind === d.kind && b.id === d.id));
    return { d, start, ok: isSlotFree(others, start, d.duration) };
  }

  function over(e: DragEvent) {
    const slot = slotFor(e);
    if (!slot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (preview?.start !== slot.start || preview.ok !== slot.ok) setPreview({ start: slot.start, duration: slot.d.duration, ok: slot.ok });
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    const slot = slotFor(e);
    setPreview(null);
    dragging = null;
    if (!slot) return;
    if (slot.ok) onPlace(slot.d.kind, slot.d.id, slot.start);
    else onBlocked();
  }

  function grab(e: DragEvent<HTMLDivElement>, b: Block) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragging = { kind: b.kind, id: b.id, duration: b.duration, grabHours: (e.clientY - rect.top) / HOUR_PX };
    e.dataTransfer.setData("text/plain", b.id);
    e.dataTransfer.effectAllowed = "move";
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
  return (
    <div className="timeline" ref={scroller}>
      <div
        className="timeline-grid"
        ref={grid}
        style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}
        onDragOver={over}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setPreview(null)}
        onDrop={drop}
      >
        {hours.map((h) => (
          <div key={h} className="hour" style={{ top: (h - START_HOUR) * HOUR_PX }}>
            <span>{formatHour(h).replace(":00", "")}</span>
          </div>
        ))}
        {blocks.length === 0 && <p className="timeline-empty">Nothing planned. Drag a task here, or add one above.</p>}
        {blocks.map((b) => {
          const height = Math.max(24, (b.duration / 60) * HOUR_PX - 3);
          const ongoing = isToday && b.start <= now && now < b.start + b.duration / 60;
          return (
            <div
              key={`${b.kind}-${b.id}`}
              className="block"
              data-cat={b.category}
              data-done={b.completed || undefined}
              data-current={b.id === currentId || undefined}
              data-ongoing={ongoing || undefined}
              style={{ top: (b.start - START_HOUR) * HOUR_PX + 1, height }}
              draggable
              onDragStart={(e) => grab(e, b)}
              onDragEnd={() => {
                dragging = null;
                setPreview(null);
              }}
              onClick={() => onOpen(b.kind, b.id)}
              onKeyDown={(e) => e.key === "Enter" && onOpen(b.kind, b.id)}
              role="button"
              tabIndex={0}
              aria-label={`${b.title}, ${formatHour(b.start)} to ${formatHour(b.start + b.duration / 60)}`}
            >
              {b.kind === "task" && (
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
                <p className="block-title">{b.title}</p>
                {height >= 40 && (
                  <p className="block-meta">
                    {formatHour(b.start)} – {formatHour(b.start + b.duration / 60)}
                    {b.meta && <> · {b.meta}</>}
                  </p>
                )}
              </div>
              {height >= 40 && (
                <span className="block-dur" title={b.actual ? `${formatDuration(b.actual)} focused of ${formatDuration(b.duration)} planned` : undefined}>
                  {b.actual ? `${formatDuration(b.actual)} / ${formatDuration(b.duration)}` : formatDuration(b.duration)}
                </span>
              )}
            </div>
          );
        })}
        {preview && (
          <div className="drop-preview" data-ok={preview.ok} style={{ top: (preview.start - START_HOUR) * HOUR_PX + 1, height: Math.max(24, (preview.duration / 60) * HOUR_PX - 3) }}>
            {preview.ok ? formatHour(preview.start) : "That time is taken"}
          </div>
        )}
        {isToday && now >= START_HOUR && now <= END_HOUR && (
          <div className="now-line" style={{ top: (now - START_HOUR) * HOUR_PX }}>
            <span>{formatHour(now)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
