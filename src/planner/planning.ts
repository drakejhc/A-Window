type TimedItem = { start?: number | undefined; duration: number; completed?: boolean | undefined };

export function isSlotFree(items: TimedItem[], start: number, duration: number) {
  return !items.some((item) => !item.completed && item.start !== undefined && start < item.start + item.duration / 60 && item.start < start + duration / 60);
}

export function findOpenSlot(items: TimedItem[], duration: number, from: number, end = 23) {
  for (let start = Math.ceil(from * 4) / 4; start + duration / 60 <= end; start += 0.25) {
    if (isSlotFree(items, start, duration)) return start;
  }
  return undefined;
}

type PlanTask = { id: string; date?: string | undefined; start?: number | undefined; duration: number; completed?: boolean | undefined };
type PlanEvent = { date: string; start: number; duration: number };
export type ReplanMove = { id: string; from: number; to: number };
export type ReplanResult = { moves: ReplanMove[]; unfit: string[] };

/** A task has slipped when its whole block is already behind the clock and it is still open. */
export function isSlipped(task: PlanTask, date: string, now: number) {
  return task.date === date && task.start !== undefined && !task.completed && task.start + task.duration / 60 <= now;
}

/**
 * Refits slipped tasks into the free time left on `date`. Events and tasks that are
 * still ahead stay put; anything that no longer fits before `end` is reported, not squeezed in.
 */
export function planReplan(tasks: PlanTask[], events: PlanEvent[], date: string, now: number, end = 23): ReplanResult {
  const slipped = tasks.filter((t) => isSlipped(t, date, now)).sort((a, b) => a.start! - b.start!);
  const occupied: TimedItem[] = [
    ...events.filter((e) => e.date === date),
    ...tasks.filter((t) => t.date === date && t.start !== undefined && !t.completed && !isSlipped(t, date, now)),
  ];
  const result: ReplanResult = { moves: [], unfit: [] };
  for (const task of slipped) {
    const to = findOpenSlot(occupied, task.duration, now, end);
    if (to === undefined) result.unfit.push(task.id);
    else {
      result.moves.push({ id: task.id, from: task.start!, to });
      occupied.push({ start: to, duration: task.duration });
    }
  }
  return result;
}

type TrackedTask = { category: string; duration: number; actual?: number | undefined; completed?: boolean | undefined };

/**
 * How long finished tasks in a category really took versus their estimate (1.4 = 40% over).
 * Needs a few tracked tasks before it says anything, so one odd session cannot skew it.
 */
export function estimateRatio(tasks: TrackedTask[], category: string, minSamples = 3) {
  const tracked = tasks.filter((t) => t.completed && t.category === category && (t.actual ?? 0) >= 5 && t.duration > 0);
  if (tracked.length < minSamples) return undefined;
  const planned = tracked.reduce((sum, t) => sum + t.duration, 0);
  const actual = tracked.reduce((sum, t) => sum + (t.actual ?? 0), 0);
  return actual / planned;
}
