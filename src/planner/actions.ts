/** What Claude can read and change in the plan, as plain functions over the data. The desktop app's Claude bridge
 *  (electron/mcp.cjs, the MCP server, and the bridge in electron/main.cjs) sends each tool call here through the
 *  running app, so there is one writer, the UI stays live and every change can be undone. Times are local "HH:MM"
 *  (24-hour) and dates are "YYYY-MM-DD"; the same collision rules as dragging and quick add apply. */
import { BUCKETS, blocksOn, CATEGORIES, DAY_START, END_HOUR, formatHour, fromKey, snap, START_HOUR, toTime, uid, type Block, type Bucket, type CalendarEvent, type Category, type PlannerData, type Repeat, type Task } from "./model";
import { findOpenSlot, isSlotFree, planReplan } from "./planning";

/** Today's date, the hour of day now (14.5 = 2:30 pm) and the time zone, from the app's clock. */
export type ActionContext = { today: string; now: number; timeZone: string };
/** `data` is set when the plan changed; `summary` then says what happened, for the app's Undo toast. */
export type ActionResult = { result: unknown; data?: PlannerData; summary?: string };

/** A tool call that can't be done as asked; the message goes back to Claude. */
export class ActionError extends Error {}

type Args = Record<string, unknown>;

const REPEAT_VALUES: Repeat[] = ["daily", "weekdays", "weekly"];

function text(a: Args, key: string, required: true): string;
function text(a: Args, key: string, required?: false): string | undefined;
function text(a: Args, key: string, required = false) {
  const v = a[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ActionError(`"${key}" is required.`);
    return undefined;
  }
  if (typeof v !== "string") throw new ActionError(`"${key}" should be text.`);
  return v.trim();
}

function minutes(a: Args, key: string) {
  const v = a[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 5 || v > 24 * 60) throw new ActionError(`"${key}" should be a number of minutes between 5 and 1440.`);
  return Math.round(v / 5) * 5;
}

function dateArg(a: Args, key: string) {
  const v = text(a, key);
  if (v === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(fromKey(v).getTime())) throw new ActionError(`"${key}" should be a date like 2026-10-21.`);
  return v;
}

/** "HH:MM" (24-hour) to an hour of day, snapped to the timeline's quarter hours. */
function timeArg(a: Args, key: string) {
  const v = text(a, key);
  if (v === undefined) return undefined;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  const h = m ? Number(m[1]) + Number(m[2]) / 60 : NaN;
  if (!m || h < START_HOUR || h >= END_HOUR || Number(m[2]) >= 60) throw new ActionError(`"${key}" should be a 24-hour time like 17:30.`);
  return snap(h);
}

function oneOf<T extends string>(a: Args, key: string, values: readonly T[]) {
  const v = text(a, key);
  if (v === undefined) return undefined;
  const hit = values.find((x) => x.toLowerCase() === v.toLowerCase());
  if (!hit) throw new ActionError(`"${key}" should be one of: ${values.join(", ")}.`);
  return hit;
}

const category = (a: Args) => oneOf<Category>(a, "category", CATEGORIES.map((c) => c.value));
const list = (a: Args) => oneOf<Bucket>(a, "list", BUCKETS);

const end = (start: number, duration: number) => toTime(Math.min(24, start + duration / 60));
const weekday = (date: string) => fromKey(date).toLocaleDateString("en-US", { weekday: "long" });
const dayName = (date: string, ctx: ActionContext) => (date === ctx.today ? "today" : fromKey(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));

function showBlock(b: Block, data: PlannerData) {
  const e = b.kind === "event" ? data.events.find((x) => x.id === b.id) : undefined;
  return {
    id: b.id,
    kind: b.kind,
    title: b.title,
    start: toTime(b.start),
    end: end(b.start, b.duration),
    duration_minutes: b.duration,
    category: b.category,
    ...(b.kind === "task" ? { done: b.completed } : {}),
    ...(b.meta ? { where: b.meta } : {}),
    ...(b.repeat ? { repeats: b.repeat } : {}),
    ...(e?.notes ? { notes: e.notes } : {}),
  };
}

function showTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    list: t.bucket,
    duration_minutes: t.duration,
    category: t.category,
    done: !!t.completed,
    ...(t.date && t.start !== undefined ? { scheduled: { date: t.date, start: toTime(t.start), end: end(t.start, t.duration) } } : {}),
    ...(t.notes ? { notes: t.notes } : {}),
    ...(t.subtasks?.length ? { checklist: t.subtasks.map((s) => ({ title: s.title, done: s.done })) } : {}),
  };
}

function find(data: PlannerData, id: string) {
  const task = data.tasks.find((t) => t.id === id);
  if (task) return { kind: "task" as const, task };
  const event = data.events.find((e) => e.id === id);
  if (event) return { kind: "event" as const, event };
  throw new ActionError(`Nothing has the id "${id}". Use get_day or list_tasks to find ids.`);
}

/** Throws if a task can't go at `start` on `date` because something else is there (ignoring `self`). */
function checkFree(data: PlannerData, date: string, start: number, duration: number, self?: string) {
  if (start + duration / 60 > END_HOUR) throw new ActionError(`That would run past midnight.`);
  const others = blocksOn(data, date).filter((b) => b.id !== self);
  if (isSlotFree(others, start, duration)) return;
  const clash = others.filter((b) => !b.completed && start < b.start + b.duration / 60 && b.start < start + duration / 60);
  throw new ActionError(`${toTime(start)} on ${date} is taken by ${clash.map((b) => `“${b.title}” (${toTime(b.start)}–${end(b.start, b.duration)})`).join(", ")}. Use find_free_slot, or move that first.`);
}

const overlaps = (data: PlannerData, date: string, start: number, duration: number, self?: string) =>
  blocksOn(data, date).filter((b) => b.id !== self && !b.completed && start < b.start + b.duration / 60 && b.start < start + duration / 60).map((b) => b.title);

const withTask = (data: PlannerData, id: string, patch: Partial<Task>): PlannerData => ({ ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
const withEvent = (data: PlannerData, id: string, patch: Partial<CalendarEvent>): PlannerData => ({ ...data, events: data.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

/** Runs one tool call against the plan. */
export function runAction(data: PlannerData, tool: string, args: unknown, ctx: ActionContext): ActionResult {
  const a: Args = args && typeof args === "object" ? (args as Args) : {};
  const at = (date: string, start: number) => `${dayName(date, ctx)} at ${formatHour(start)}`;

  switch (tool) {
    case "get_today": {
      const open = data.tasks.filter((t) => !t.completed && t.start === undefined);
      return {
        result: {
          date: ctx.today,
          weekday: weekday(ctx.today),
          time_now: toTime(snap(ctx.now)),
          time_zone: ctx.timeZone,
          schedule: blocksOn(data, ctx.today).map((b) => showBlock(b, data)),
          unscheduled: { Today: open.filter((t) => t.bucket === "Today").map(showTask), "This Week": open.filter((t) => t.bucket === "This Week").length, Later: open.filter((t) => t.bucket === "Later").length },
        },
      };
    }

    case "get_day": {
      const from = dateArg(a, "date") ?? ctx.today;
      const n = a.days === undefined ? 1 : Number(a.days);
      if (!Number.isInteger(n) || n < 1 || n > 14) throw new ActionError(`"days" should be a whole number from 1 to 14.`);
      const days = Array.from({ length: n }, (_, i) => {
        const d = fromKey(from);
        d.setDate(d.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return { date: key, weekday: weekday(key), blocks: blocksOn(data, key).map((b) => showBlock(b, data)) };
      });
      return { result: n === 1 ? days[0] : { days } };
    }

    case "list_tasks": {
      const only = list(a);
      const done = a.include_done === true;
      return { result: { tasks: data.tasks.filter((t) => (!only || t.bucket === only) && (done || !t.completed)).map(showTask) } };
    }

    case "add_task": {
      const title = text(a, "title", true);
      const duration = minutes(a, "duration_minutes") ?? 30;
      let date = dateArg(a, "date");
      const time = timeArg(a, "time");
      if (time !== undefined) date ??= ctx.today;
      let start = time;
      if (start !== undefined) checkFree(data, date!, start, duration);
      else if (date) start = findOpenSlot(blocksOn(data, date), duration, date === ctx.today ? ctx.now : DAY_START, END_HOUR);
      if (start === undefined) date = undefined;
      const bucket = list(a) ?? (date && date !== ctx.today ? "This Week" : "Today");
      const notes = text(a, "notes");
      const task: Task = { id: uid("t"), title, duration, category: category(a) ?? "personal", bucket, ...(date && start !== undefined ? { date, start } : {}), ...(notes ? { notes } : {}) };
      return {
        data: { ...data, tasks: [task, ...data.tasks] },
        summary: date && start !== undefined ? `added “${title}” ${at(date, start)}` : `added “${title}” to ${bucket === "This Week" ? "this week" : bucket.toLowerCase()}`,
        result: { added: showTask(task), ...(a.date && start === undefined ? { note: `No free ${duration}-minute slot was left that day, so it went to the ${bucket} list.` } : {}) },
      };
    }

    case "add_event": {
      const title = text(a, "title", true);
      const date = dateArg(a, "date") ?? ctx.today;
      const start = timeArg(a, "time");
      if (start === undefined) throw new ActionError(`"time" is required for an event.`);
      const duration = minutes(a, "duration_minutes") ?? 60;
      if (start + duration / 60 > END_HOUR) throw new ActionError(`That would run past midnight.`);
      const where = text(a, "where"), notes = text(a, "notes"), repeat = oneOf(a, "repeat", REPEAT_VALUES);
      const event: CalendarEvent = { id: uid("e"), title, date, start, duration, category: category(a) ?? "personal", ...(where ? { meta: where } : {}), ...(notes ? { notes } : {}), ...(repeat ? { repeat } : {}) };
      const clash = overlaps(data, date, start, duration);
      const next = { ...data, events: [...data.events, event] };
      return {
        data: next,
        summary: `added “${title}” ${at(date, start)}`,
        result: { added: showBlock(blocksOn(next, date).find((b) => b.id === event.id)!, next), ...(clash.length ? { note: `It overlaps ${clash.map((t) => `“${t}”`).join(", ")}.` } : {}) },
      };
    }

    case "move_item": {
      const id = text(a, "id", true);
      const start = timeArg(a, "time");
      if (start === undefined) throw new ActionError(`"time" is required.`);
      const item = find(data, id);
      if (item.kind === "task") {
        const t = item.task;
        const date = dateArg(a, "date") ?? t.date ?? ctx.today;
        checkFree(data, date, start, t.duration, t.id);
        return { data: withTask(data, t.id, { date, start }), summary: `moved “${t.title}” to ${at(date, start)}`, result: { moved: showTask({ ...t, date, start }) } };
      }
      const e = item.event;
      if (start + e.duration / 60 > END_HOUR) throw new ActionError(`That would run past midnight.`);
      // As in the app: a daily or weekday series keeps its days and changes time; anything else moves to the new day.
      const series = e.repeat === "daily" || e.repeat === "weekdays";
      const date = series ? e.date : dateArg(a, "date") ?? e.date;
      const next = withEvent(data, e.id, { date, start });
      const clash = overlaps(next, dateArg(a, "date") ?? date, start, e.duration, e.id);
      const note = e.repeat ? (series ? "Every day of the series moved to the new time." : "The whole series moved to the new weekday and time.") : undefined;
      return {
        data: next,
        summary: `moved “${e.title}”${e.repeat ? " and its repeats" : ""} to ${series ? formatHour(start) : at(date, start)}`,
        result: {
          moved: { id: e.id, title: e.title, date, start: toTime(start), end: end(start, e.duration), ...(e.repeat ? { repeats: e.repeat } : {}) },
          ...(note || clash.length ? { note: [note, clash.length ? `It overlaps ${clash.map((t) => `“${t}”`).join(", ")}.` : ""].filter(Boolean).join(" ") } : {}),
        },
      };
    }

    case "update_item": {
      const id = text(a, "id", true);
      const item = find(data, id);
      const title = text(a, "title"), notes = text(a, "notes"), duration = minutes(a, "duration_minutes"), cat = category(a);
      const shared = { ...(title ? { title } : {}), ...(notes !== undefined ? { notes } : {}), ...(duration ? { duration } : {}), ...(cat ? { category: cat } : {}) };
      if (item.kind === "task") {
        const t = item.task, bucket = list(a);
        if (duration && t.date && t.start !== undefined) checkFree(data, t.date, t.start, duration, t.id);
        const patched = { ...t, ...shared, ...(bucket ? { bucket } : {}) };
        return { data: withTask(data, t.id, patched), summary: `updated “${patched.title}”`, result: { updated: showTask(patched) } };
      }
      const e = item.event, where = text(a, "where"), repeat = a.repeat === "none" ? "none" : oneOf(a, "repeat", REPEAT_VALUES);
      if (duration && e.start + duration / 60 > END_HOUR) throw new ActionError(`That would run past midnight.`);
      const patch: Partial<CalendarEvent> = { ...shared, ...(where !== undefined ? { meta: where } : {}), ...(repeat ? { repeat: repeat === "none" ? undefined : repeat } : {}) };
      const patched = { ...e, ...patch };
      return { data: withEvent(data, e.id, patch), summary: `updated “${patched.title}”`, result: { updated: { id: e.id, title: patched.title, date: patched.date, start: toTime(patched.start), end: end(patched.start, patched.duration), duration_minutes: patched.duration, category: patched.category, ...(patched.meta ? { where: patched.meta } : {}), ...(patched.repeat ? { repeats: patched.repeat } : {}) } } };
    }

    case "complete_task": {
      const id = text(a, "id", true);
      const item = find(data, id);
      if (item.kind !== "task") throw new ActionError(`“${item.event.title}” is an event; only tasks can be marked done.`);
      const done = a.done !== false;
      return { data: withTask(data, id, { completed: done }), summary: `${done ? "checked off" : "reopened"} “${item.task.title}”`, result: { id, title: item.task.title, done } };
    }

    case "unschedule_task": {
      const id = text(a, "id", true);
      const item = find(data, id);
      if (item.kind !== "task") throw new ActionError(`“${item.event.title}” is an event; use move_item or delete_item.`);
      return { data: withTask(data, id, { date: undefined, start: undefined }), summary: `moved “${item.task.title}” back to your list`, result: { unscheduled: showTask({ ...item.task, date: undefined, start: undefined }) } };
    }

    case "delete_item": {
      const id = text(a, "id", true);
      const date = dateArg(a, "date");
      const item = find(data, id);
      if (item.kind === "task") {
        return { data: { ...data, tasks: data.tasks.filter((t) => t.id !== id) }, summary: `deleted “${item.task.title}”`, result: { deleted: showTask(item.task) } };
      }
      const e = item.event;
      if (e.repeat && date) {
        if (!blocksOn(data, date).some((b) => b.id === id)) throw new ActionError(`“${e.title}” doesn't happen on ${date}.`);
        return { data: withEvent(data, id, { skip: [...(e.skip ?? []), date] }), summary: `removed “${e.title}” from ${dayName(date, ctx)}`, result: { removed_one_day: { id, title: e.title, date }, note: "The rest of the series stays." } };
      }
      return {
        data: { ...data, events: data.events.filter((x) => x.id !== id) },
        summary: `deleted “${e.title}”${e.repeat ? " and its repeats" : ""}`,
        result: { deleted: { id, title: e.title, date: e.date, start: toTime(e.start), ...(e.repeat ? { repeats: e.repeat, note: "Every repeat was deleted. To remove one day only, pass its date." } : {}) } },
      };
    }

    case "find_free_slot": {
      const date = dateArg(a, "date") ?? ctx.today;
      const duration = minutes(a, "duration_minutes") ?? 30;
      const after = timeArg(a, "after");
      const from = Math.max(after ?? (date === ctx.today ? 0 : DAY_START), date === ctx.today ? ctx.now : 0);
      const start = findOpenSlot(blocksOn(data, date), duration, from, END_HOUR);
      return { result: start === undefined ? { date, free: null, note: `No free ${duration} minutes left that day.` } : { date, free: { start: toTime(start), end: end(start, duration) } } };
    }

    case "replan_today": {
      // Repeating events count as busy on the days they repeat, not only on their first day.
      const events = blocksOn(data, ctx.today).filter((b) => b.kind === "event").map((b) => ({ date: ctx.today, start: b.start, duration: b.duration }));
      const plan = planReplan(data.tasks, events, ctx.today, ctx.now, END_HOUR);
      if (!plan.moves.length && !plan.unfit.length) return { result: { moved: [], sent_to_this_week: [], note: "Nothing fell behind today." } };
      const title = (id: string) => data.tasks.find((t) => t.id === id)?.title ?? id;
      const next: PlannerData = {
        ...data,
        tasks: data.tasks.map((t) => {
          const move = plan.moves.find((m) => m.id === t.id);
          if (move) return { ...t, start: move.to };
          if (plan.unfit.includes(t.id)) return { ...t, date: undefined, start: undefined, bucket: "This Week" };
          return t;
        }),
      };
      const n = plan.moves.length + plan.unfit.length;
      return {
        data: next,
        summary: `replanned ${n} ${n === 1 ? "task" : "tasks"}`,
        result: { moved: plan.moves.map((m) => ({ id: m.id, title: title(m.id), from: toTime(m.from), to: toTime(m.to) })), sent_to_this_week: plan.unfit.map((id) => ({ id, title: title(id) })) },
      };
    }

    default:
      throw new ActionError(`Unknown tool "${tool}".`);
  }
}
