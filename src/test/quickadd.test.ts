import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/planner/quickadd";

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
