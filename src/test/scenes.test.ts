import { describe, expect, it } from "vitest";

import { cleanMix, emptyScenes, formatMinutes, parseMinutes, readScenes, scheduledScene } from "@/scenes";

const scene = (id: string) => ({ id, name: id, room: "painted", view: "painted-city", mix: {}, sound: true });

describe("saved scenes", () => {
  it("follows the schedule through the day and wraps past midnight", () => {
    const schedule = [
      { scene: "day", from: 8 * 60 },
      { scene: "night", from: 21 * 60 },
    ];
    expect(scheduledScene(schedule, 12 * 60)).toBe("day");
    expect(scheduledScene(schedule, 21 * 60)).toBe("night");
    expect(scheduledScene(schedule, 23 * 60 + 59)).toBe("night");
    // Before the first entry of the day, last night's scene is still showing.
    expect(scheduledScene(schedule, 2 * 60)).toBe("night");
    expect(scheduledScene([], 600)).toBeNull();
  });

  it("orders entries by time however they were added", () => {
    expect(scheduledScene([{ scene: "night", from: 1260 }, { scene: "day", from: 480 }], 600)).toBe("day");
  });

  it("reads stored scenes defensively", () => {
    expect(readScenes(null)).toEqual(emptyScenes());
    expect(readScenes({ version: 2, scenes: [scene("a")] })).toEqual(emptyScenes());
    const s = readScenes({
      version: 1,
      scenes: [scene("a"), { id: 3 }, scene("b")],
      schedule: [{ scene: "b", from: 1300 }, { scene: "gone", from: 60 }, { scene: "a", from: -20 }],
      focus: "gone",
    });
    expect(s.scenes.map((x) => x.id)).toEqual(["a", "b"]);
    // Entries for missing scenes are dropped, times are clamped and sorted, and a missing Focus scene is cleared.
    expect(s.schedule).toEqual([{ scene: "a", from: 0 }, { scene: "b", from: 1300 }]);
    expect(s.focus).toBeNull();
  });

  it("keeps only known sounds at sensible levels", () => {
    expect(cleanMix({ rain: 0.4, fire: 9, cafe: -1, laser: 1, birds: "loud" })).toEqual({ rain: 0.4, fire: 1.5, cafe: 0 });
  });

  it("reads and writes times of day", () => {
    expect(parseMinutes("21:30")).toBe(1290);
    expect(formatMinutes(1290)).toBe("21:30");
    expect(formatMinutes(5)).toBe("00:05");
  });
});
