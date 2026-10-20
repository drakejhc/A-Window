import { describe, expect, it } from "vitest";
import { parseQuickAdd, splitLines } from "@/planner/quickadd";

describe("quick add parsing", () => {
  const today = new Date(2026, 9, 7); // Wed
  it("extracts date, time, duration, category", () => {
    expect(parseQuickAdd("Gym tomorrow 7am 45m #health", today)).toEqual({ title: "Gym", date: "2026-10-08", start: 7, duration: 45, category: "health" });
  });
  it("handles weekdays, 24h time and hours", () => {
    const r = parseQuickAdd("Essay draft fri 14:30 1.5h", today);
    expect(r).toMatchObject({ title: "Essay draft", date: "2026-10-09", start: 14.5, duration: 90 });
  });
  it("keeps plain titles and buckets", () => {
    expect(parseQuickAdd("Call mom later", today)).toEqual({ title: "Call mom", bucket: "Later" });
  });
});

describe("pasted lists", () => {
  it("makes one phrase per line without bullets or checkboxes", () => {
    expect(splitLines("- Buy milk\n* Call mom later\n\n1. Essay fri 2pm\n[ ] Laundry\n- [x] Gym 45m")).toEqual(["Buy milk", "Call mom later", "Essay fri 2pm", "Laundry", "Gym 45m"]);
  });
  it("leaves a single line alone", () => {
    expect(splitLines("  Read chapter 3 ")).toEqual(["Read chapter 3"]);
  });
});
