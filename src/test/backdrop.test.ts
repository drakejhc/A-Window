import { describe, expect, it } from "vitest";

import { BACKDROP_KEY, defaultBackdrop, loadBackdrop, readBackdrop, updateBackdrop } from "@/backdrop";
import { CITIES } from "@/window/cities";

describe("your own background", () => {
  it("shows the picture as it is unless asked otherwise", () => {
    expect(readBackdrop(null)).toEqual(defaultBackdrop());
    expect(defaultBackdrop()).toMatchObject({ fit: "cover", dim: false, weather: false, day: null, night: null });
  });

  it("keeps valid choices and drops broken ones", () => {
    const b = readBackdrop({ fit: "contain", dim: true, weather: "yes", day: { name: "lake.jpg", type: "image/jpeg", video: false, tint: [10, 20, 30] }, night: { name: 4 } });
    expect(b.fit).toBe("contain");
    expect(b.dim).toBe(true);
    expect(b.weather).toBe(false);
    expect(b.day).toEqual({ name: "lake.jpg", type: "image/jpeg", video: false, tint: [10, 20, 30] });
    expect(b.night).toBeNull();
  });

  it("saves its settings", () => {
    window.localStorage.removeItem(BACKDROP_KEY);
    updateBackdrop({ fit: "contain", weather: true });
    expect(loadBackdrop()).toMatchObject({ fit: "contain", weather: true, dim: false });
  });

  it("replaces the window and the room, keeping the weather's sounds but no fire", async () => {
    const { OWN_ROOM, sceneFor } = await import("@/window/engine");
    const tromso = CITIES.find((c) => c.id === "tromso")!;
    const s = sceneFor({ view: "auto", room: OWN_ROOM }, tromso);
    expect(s.own).toBe(true);
    expect(s.room3d).toBeNull();
    expect(s.ambience.fire).toBe(0);
    expect(sceneFor({ view: "auto", room: "auto" }, tromso).own).toBe(false);
  });

  it("is remembered as the room", async () => {
    window.localStorage.setItem("a-window:window-v1", JSON.stringify({ room: "own" }));
    const { WindowEngine } = await import("@/window/engine");
    expect(new WindowEngine(true).getSnapshot().own).toBe(true);
  });
});
