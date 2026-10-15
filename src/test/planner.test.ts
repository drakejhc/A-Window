import { act, renderHook } from "@testing-library/react";

import { blocksOn, currentBlock, formatDuration, formatHour, sampleData, toKey } from "@/planner/model";
import { usePlanner } from "@/planner/store";

const day = new Date(2026, 9, 15, 9, 0);
const today = toKey(day);

describe("planner model", () => {
  it("lists events and scheduled tasks on a day, earliest first", () => {
    const blocks = blocksOn(sampleData(day), today);
    expect(blocks.map((b) => b.title).slice(0, 3)).toEqual(["Morning run", "Deep work: research outline", "Cognitive Science"]);
    expect(blocks.every((b, i) => i === 0 || blocks[i - 1]!.start <= b.start)).toBe(true);
  });

  it("finds the block happening now, or the next one", () => {
    const data = sampleData(day);
    expect(currentBlock(data, today, 10.5)?.title).toBe("Cognitive Science");
    expect(currentBlock(data, today, 11.5)?.title).toBe("Lunch with Maya");
    expect(currentBlock(data, today, 22)).toBeUndefined();
  });

  it("formats hours and durations for people", () => {
    expect(formatHour(13.5)).toBe("1:30 PM");
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatDuration(75)).toBe("1h 15m");
    expect(formatDuration(45)).toBe("45m");
  });
});

describe("planner store", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts from the example plan and clears it on request", () => {
    const { result } = renderHook(() => usePlanner());
    expect(result.current.state.sample).toBe(true);
    act(() => result.current.startFresh());
    expect(result.current.state).toMatchObject({ tasks: [], events: [], sample: false });
  });

  it("places a task, records focus and saves to storage", () => {
    const { result } = renderHook(() => usePlanner());
    act(() => result.current.place("task", "t3", today, 13));
    act(() => result.current.recordFocus("task", "t3", 25));
    const task = result.current.state.tasks.find((t) => t.id === "t3")!;
    expect(task).toMatchObject({ date: today, start: 13, actual: 25 });
    const saved = JSON.parse(window.localStorage.getItem("a-window:planner-v1")!);
    expect(saved.tasks.find((t: { id: string }) => t.id === "t3").start).toBe(13);
  });

  it("restores an earlier state for undo", () => {
    const { result } = renderHook(() => usePlanner());
    const before = result.current.state;
    act(() => result.current.remove("event", "e1"));
    expect(result.current.state.events.some((e) => e.id === "e1")).toBe(false);
    act(() => result.current.restore(before));
    expect(result.current.state.events.some((e) => e.id === "e1")).toBe(true);
  });
});
