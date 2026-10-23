import { describe, expect, it } from "vitest";

import { ActionError, runAction, type ActionContext } from "@/planner/actions";
import { blocksOn, type PlannerData } from "@/planner/model";

const ctx: ActionContext = { today: "2026-10-21", now: 10, timeZone: "America/Vancouver" }; // a Wednesday, 10 am

const plan = (): PlannerData => ({
  events: [
    { id: "e-run", title: "Morning run", date: "2026-10-19", start: 7, duration: 45, category: "health", repeat: "weekdays" },
    { id: "e-class", title: "Statistics", date: "2026-10-21", start: 15, duration: 75, category: "study", meta: "Room 214" },
  ],
  tasks: [
    { id: "t-essay", title: "Essay draft", duration: 60, bucket: "Today", category: "study", date: "2026-10-21", start: 11 },
    { id: "t-late", title: "Problem set", duration: 60, bucket: "Today", category: "study", date: "2026-10-21", start: 8 },
    { id: "t-mail", title: "Email Kim", duration: 15, bucket: "Today", category: "study" },
    { id: "t-pass", title: "Renew passport", duration: 60, bucket: "Later", category: "life" },
  ],
});

const run = (tool: string, args: object = {}, data = plan()) => runAction(data, tool, args, ctx);

describe("reading the plan", () => {
  it("gives today's date, time, zone and schedule, including repeating events", () => {
    const r = run("get_today").result as { date: string; weekday: string; time_now: string; time_zone: string; schedule: { title: string; start: string }[] };
    expect(r).toMatchObject({ date: "2026-10-21", weekday: "Wednesday", time_now: "10:00", time_zone: "America/Vancouver" });
    expect(r.schedule.map((b) => `${b.start} ${b.title}`)).toEqual(["07:00 Morning run", "08:00 Problem set", "11:00 Essay draft", "15:00 Statistics"]);
  });
  it("lists several days, and tasks by list", () => {
    const r = run("get_day", { date: "2026-10-24", days: 3 }).result as { days: { weekday: string; blocks: unknown[] }[] };
    expect(r.days.map((d) => [d.weekday, d.blocks.length])).toEqual([["Saturday", 0], ["Sunday", 0], ["Monday", 1]]);
    expect((run("list_tasks", { list: "later" }).result as { tasks: { title: string }[] }).tasks.map((t) => t.title)).toEqual(["Renew passport"]);
  });
  it("doesn't change anything when reading", () => {
    expect(run("get_today").data).toBeUndefined();
    expect(run("find_free_slot", { duration_minutes: 30 }).data).toBeUndefined();
  });
});

describe("adding", () => {
  it("puts a timed task on the timeline", () => {
    const r = run("add_task", { title: "Walk", time: "17:00", duration_minutes: 30, category: "health" });
    expect(blocksOn(r.data!, "2026-10-21").find((b) => b.title === "Walk")).toMatchObject({ start: 17, duration: 30, category: "health" });
    expect(r.summary).toMatch(/added “Walk” today at/);
  });
  it("refuses a task where something already is, and says what", () => {
    expect(() => run("add_task", { title: "Gym", time: "11:30" })).toThrow(/taken by “Essay draft”/);
    expect(() => run("add_task", { title: "Gym", time: "11:30" })).toThrow(ActionError);
  });
  it("gives a task with a day but no time that day's next free slot", () => {
    const r = run("add_task", { title: "Laundry", date: "2026-10-22", duration_minutes: 45 });
    // Thursday: the 7:00 run, so the first free 45 minutes from 7 am is 7:45.
    expect(r.data!.tasks[0]).toMatchObject({ title: "Laundry", date: "2026-10-22", start: 7.75, bucket: "This Week" });
  });
  it("puts a task with no day in the list named, or Today", () => {
    const t = run("add_task", { title: "Call mom", list: "This Week" }).data!.tasks[0]!;
    expect([t.bucket, t.start]).toEqual(["This Week", undefined]);
    expect(run("add_task", { title: "Water plants" }).data!.tasks[0]).toMatchObject({ bucket: "Today", duration: 30, category: "personal" });
  });
  it("adds events, which may overlap, and says so", () => {
    const r = run("add_event", { title: "Dentist", date: "2026-10-21", time: "15:30", duration_minutes: 30, where: "Main St" });
    expect(r.data!.events.at(-1)).toMatchObject({ title: "Dentist", start: 15.5, meta: "Main St" });
    expect((r.result as { note?: string }).note).toMatch(/Statistics/);
  });
  it("checks its inputs", () => {
    expect(() => run("add_task", {})).toThrow(/"title" is required/);
    expect(() => run("add_task", { title: "x", time: "5pm" })).toThrow(/24-hour time/);
    expect(() => run("add_event", { title: "x", date: "tomorrow", time: "09:00" })).toThrow(/date like/);
    expect(() => run("add_task", { title: "x", category: "fun" })).toThrow(/study, health, personal, life/);
    expect(() => run("nope")).toThrow(/Unknown tool/);
  });
});

describe("changing", () => {
  it("moves a task, but not onto something else", () => {
    const r = run("move_item", { id: "t-essay", date: "2026-10-22", time: "14:00" });
    expect(r.data!.tasks.find((t) => t.id === "t-essay")).toMatchObject({ date: "2026-10-22", start: 14 });
    expect(() => run("move_item", { id: "t-essay", time: "15:30" })).toThrow(/Statistics/);
  });
  it("moves a weekday series to a new time, keeping its days", () => {
    const r = run("move_item", { id: "e-run", date: "2026-10-23", time: "06:30" });
    expect(r.data!.events.find((e) => e.id === "e-run")).toMatchObject({ date: "2026-10-19", start: 6.5 });
    expect(r.summary).toMatch(/and its repeats/);
  });
  it("updates fields, completes, reopens and unschedules tasks", () => {
    const u = run("update_item", { id: "t-mail", title: "Email Professor Kim", list: "Later", notes: "About the extension" });
    expect(u.data!.tasks.find((t) => t.id === "t-mail")).toMatchObject({ title: "Email Professor Kim", bucket: "Later", notes: "About the extension" });
    expect(run("complete_task", { id: "t-mail" }).data!.tasks.find((t) => t.id === "t-mail")!.completed).toBe(true);
    expect(run("complete_task", { id: "t-mail", done: false }).data!.tasks.find((t) => t.id === "t-mail")!.completed).toBe(false);
    expect(run("unschedule_task", { id: "t-essay" }).data!.tasks.find((t) => t.id === "t-essay")).toMatchObject({ date: undefined, start: undefined });
    expect(() => run("complete_task", { id: "e-class" })).toThrow(/is an event/);
  });
  it("can stop an event repeating", () => {
    expect(run("update_item", { id: "e-run", repeat: "none" }).data!.events.find((e) => e.id === "e-run")!.repeat).toBeUndefined();
  });
  it("deletes one day of a series, or the whole thing", () => {
    const one = run("delete_item", { id: "e-run", date: "2026-10-22" }).data!;
    expect(blocksOn(one, "2026-10-22").some((b) => b.id === "e-run")).toBe(false);
    expect(blocksOn(one, "2026-10-23").some((b) => b.id === "e-run")).toBe(true);
    expect(run("delete_item", { id: "e-run" }).data!.events.some((e) => e.id === "e-run")).toBe(false);
    expect(() => run("delete_item", { id: "e-run", date: "2026-10-24" })).toThrow(/doesn't happen/);
    expect(() => run("delete_item", { id: "nope" })).toThrow(/Nothing has the id/);
  });
});

describe("free time and replanning", () => {
  it("finds the next free slot from now on today, and from 7 am on other days", () => {
    expect(run("find_free_slot", { duration_minutes: 60 }).result).toEqual({ date: "2026-10-21", free: { start: "10:00", end: "11:00" } });
    expect(run("find_free_slot", { duration_minutes: 90 }).result).toMatchObject({ free: { start: "12:00" } });
    expect(run("find_free_slot", { date: "2026-10-22", duration_minutes: 30 }).result).toMatchObject({ free: { start: "07:45" } });
  });
  it("moves tasks that fell behind into today's free time", () => {
    const r = run("replan_today");
    expect(r.result).toMatchObject({ moved: [{ id: "t-late", from: "08:00", to: "10:00" }] });
    expect(r.data!.tasks.find((t) => t.id === "t-late")!.start).toBe(10);
  });
});
