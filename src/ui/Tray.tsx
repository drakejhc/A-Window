import { useState } from "react";

import { BUCKETS, formatDuration, type Bucket, type Task } from "@/planner/model";

import { Icon } from "./icons";
import { startTaskDrag } from "./Timeline";

type Props = {
  tasks: Task[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  onSchedule: (id: string) => void;
};

const LABEL: Record<Bucket, string> = { Today: "Today", "This Week": "This week", Later: "Later" };

/** Unscheduled tasks, by list. Drag one onto the timeline, or let it find the next free slot. */
export function Tray({ tasks, open, onOpenChange, onOpen, onToggle, onSchedule }: Props) {
  const [bucket, setBucket] = useState<Bucket>("Today");
  const waiting = tasks.filter((t) => !t.completed && t.start === undefined);
  const list = waiting.filter((t) => t.bucket === bucket);
  return (
    <section className="tray" data-open={open} aria-label="Unscheduled tasks">
      <div className="tray-head">
        <button type="button" className="tray-toggle" aria-expanded={open} onClick={() => onOpenChange(!open)}>
          <Icon name="chevronDown" />
          Unscheduled
          <span className="count">{waiting.length}</span>
        </button>
        {open && (
          <div className="seg" role="tablist" aria-label="Task lists">
            {BUCKETS.map((b) => (
              <button key={b} type="button" role="tab" aria-selected={bucket === b} onClick={() => setBucket(b)}>
                {LABEL[b]}
                <span className="count">{waiting.filter((t) => t.bucket === b).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <ul className="tray-list">
          {list.length === 0 && <li className="tray-empty">Nothing waiting in {LABEL[bucket].toLowerCase()}.</li>}
          {list.map((t) => (
            <li key={t.id} className="tray-item" data-cat={t.category} draggable onDragStart={(e) => startTaskDrag(e, t.id, t.duration)}>
              <button type="button" className="check" aria-label={`Mark ${t.title} as done`} onClick={() => onToggle(t.id)} />
              <button type="button" className="tray-title" onClick={() => onOpen(t.id)}>
                <span className="cat-dot" />
                {t.title}
              </button>
              <span className="tray-dur">{formatDuration(t.duration)}</span>
              <button type="button" className="icon-btn" title="Schedule in the next free slot" aria-label={`Schedule ${t.title} in the next free slot`} onClick={() => onSchedule(t.id)}>
                <Icon name="schedule" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
