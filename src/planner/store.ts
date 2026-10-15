/** Planner state, saved to this browser's localStorage so nothing needs an account. */
import { useCallback, useEffect, useMemo, useState } from "react";

import { sampleData, uid, type CalendarEvent, type Kind, type PlannerData, type Task } from "./model";
import type { ReplanMove } from "./planning";

const STORAGE_KEY = "a-window:planner-v1";

/** `sample` stays true until the first change, so the example plan can be offered for clearing. */
export type PlannerState = PlannerData & { sample: boolean };

export function loadPlanner(): PlannerState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PlannerState>;
      if (Array.isArray(p.tasks) && Array.isArray(p.events)) return { tasks: p.tasks, events: p.events, sample: !!p.sample };
    }
  } catch {
    /* unreadable or blocked storage: start from the example plan */
  }
  return { ...sampleData(), sample: true };
}

export type TaskInput = Omit<Task, "id">;
export type EventInput = Omit<CalendarEvent, "id">;

export function usePlanner() {
  const [state, setState] = useState<PlannerState>(loadPlanner);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: changes last for this session */
    }
  }, [state]);

  const change = useCallback((fn: (d: PlannerState) => PlannerData) => setState((d) => ({ ...fn(d), sample: false })), []);

  const actions = useMemo(
    () => ({
      /** Puts back an earlier state, for undo. */
      restore: (s: PlannerState) => setState(s),
      startFresh: () => setState({ tasks: [], events: [], sample: false }),
      addTask: (t: TaskInput) => {
        const id = uid("t");
        change((d) => ({ ...d, tasks: [{ ...t, id }, ...d.tasks] }));
        return id;
      },
      addEvent: (e: EventInput) => {
        const id = uid("e");
        change((d) => ({ ...d, events: [...d.events, { ...e, id }] }));
        return id;
      },
      updateTask: (id: string, patch: Partial<TaskInput>) =>
        change((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      updateEvent: (id: string, patch: Partial<EventInput>) =>
        change((d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      toggleTask: (id: string) =>
        change((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)) })),
      remove: (kind: Kind, id: string) =>
        change((d) => (kind === "task" ? { ...d, tasks: d.tasks.filter((t) => t.id !== id) } : { ...d, events: d.events.filter((e) => e.id !== id) })),
      /** Places a task or event at a time on a day. */
      place: (kind: Kind, id: string, date: string, start: number) =>
        change((d) =>
          kind === "task"
            ? { ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, date, start } : t)) }
            : { ...d, events: d.events.map((e) => (e.id === id ? { ...e, date, start } : e)) },
        ),
      /** Takes a task off the timeline and back into its list. */
      unschedule: (id: string) =>
        change((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, date: undefined, start: undefined } : t)) })),
      /** Adds real focused minutes to a block. */
      recordFocus: (kind: Kind, id: string, minutes: number) =>
        change((d) =>
          kind === "task"
            ? { ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, actual: (t.actual ?? 0) + minutes } : t)) }
            : { ...d, events: d.events.map((e) => (e.id === id ? { ...e, actual: (e.actual ?? 0) + minutes } : e)) },
        ),
      /** Applies a replan: moves slipped tasks later today, and sends the ones that no longer fit to This Week. */
      applyReplan: (moves: ReplanMove[], unfit: string[]) =>
        change((d) => ({
          ...d,
          tasks: d.tasks.map((t) => {
            const move = moves.find((m) => m.id === t.id);
            if (move) return { ...t, start: move.to };
            if (unfit.includes(t.id)) return { ...t, date: undefined, start: undefined, bucket: "This Week" };
            return t;
          }),
        })),
    }),
    [change],
  );

  return { state, ...actions };
}

export type Planner = ReturnType<typeof usePlanner>;
