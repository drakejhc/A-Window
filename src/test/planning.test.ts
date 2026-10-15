import { describe, expect, it } from "vitest";
import { estimateRatio, findOpenSlot, isSlotFree, planReplan } from "@/planner/planning";

describe("free time scheduling", () => {
  const items = [{ start: 9, duration: 60 }, { start: 10.5, duration: 30 }];
  it("rejects overlaps and allows adjacent blocks", () => {
    expect(isSlotFree(items, 9.75, 30)).toBe(false);
    expect(isSlotFree(items, 10, 30)).toBe(true);
  });
  it("snaps forward to a free quarter hour", () => {
    expect(findOpenSlot(items, 30, 9.1)).toBe(10);
  });
  it("does not manufacture a slot on a full day", () => {
    expect(findOpenSlot([{ start: 6, duration: 1020 }], 15, 8)).toBeUndefined();
  });
  it("ignores completed tasks", () => {
    expect(isSlotFree([{ start: 9, duration: 60, completed: true }], 9, 30)).toBe(true);
  });
});

describe("replanning the rest of today", () => {
  const day = "2026-10-07";
  const task = (id: string, start: number, duration: number, extra: object = {}) => ({ id, date: day, start, duration, ...extra });

  it("leaves a day that is on track alone", () => {
    expect(planReplan([task("a", 15, 60)], [], day, 13)).toEqual({ moves: [], unfit: [] });
  });

  it("moves slipped tasks into gaps between events, in their original order", () => {
    const tasks = [task("late", 10, 30), task("early", 9, 60)];
    const events = [{ date: day, start: 14, duration: 60 }];
    expect(planReplan(tasks, events, day, 13.1)).toEqual({
      moves: [{ id: "early", from: 9, to: 15 }, { id: "late", from: 10, to: 13.25 }],
      unfit: [],
    });
  });

  it("never stacks two moved tasks on the same slot", () => {
    const { moves } = planReplan([task("a", 8, 60), task("b", 9, 60)], [], day, 12);
    expect(moves.map((m) => m.to)).toEqual([12, 13]);
  });

  it("does not move events, completed tasks, future tasks or other days", () => {
    const tasks = [task("done", 9, 60, { completed: true }), task("ahead", 16, 60), task("running", 12.5, 60), { id: "other", date: "2026-10-06", start: 9, duration: 60 }, { id: "loose", duration: 30 }];
    expect(planReplan(tasks, [{ date: day, start: 9, duration: 60 }], day, 13)).toEqual({ moves: [], unfit: [] });
  });

  it("keeps clear of tasks that are still ahead", () => {
    expect(planReplan([task("slipped", 9, 60), task("ahead", 13, 120)], [], day, 13).moves).toEqual([{ id: "slipped", from: 9, to: 15 }]);
  });

  it("reports what no longer fits instead of squeezing it in", () => {
    const tasks = [task("short", 9, 30), task("long", 10, 180)];
    expect(planReplan(tasks, [], day, 21.5)).toEqual({ moves: [{ id: "short", from: 9, to: 21.5 }], unfit: ["long"] });
  });
});

describe("estimate insight", () => {
  const done = (duration: number, actual?: number, category = "study") => ({ category, duration, actual, completed: true });

  it("stays quiet until there are enough tracked tasks", () => {
    expect(estimateRatio([done(60, 90), done(30, 45)], "study")).toBeUndefined();
  });

  it("compares total focused time with total planned time", () => {
    expect(estimateRatio([done(60, 90), done(30, 45), done(30, 33)], "study")).toBeCloseTo(1.4);
  });

  it("ignores open, untracked and other-category tasks", () => {
    const tasks = [done(60, 90), done(30, 45), done(30), done(30, 2), done(30, 60, "health"), { category: "study", duration: 30, actual: 60 }];
    expect(estimateRatio(tasks, "study")).toBeUndefined();
  });
});
