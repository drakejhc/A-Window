import { describe, expect, it } from "vitest";

import { defaultPersonal, readPersonal, retint } from "@/personal";

describe("make it yours", () => {
  it("starts from the painted defaults", () => {
    expect(readPersonal(null)).toEqual(defaultPersonal());
    expect(readPersonal("nonsense")).toEqual(defaultPersonal());
  });

  it("keeps valid choices and drops unknown ones", () => {
    const p = readPersonal({ cat: "ginger", lamp: "neon", walls: "sage", blanket: 7 });
    expect(p).toEqual({ version: 1, cat: "ginger", lamp: "warm", walls: "sage", blanket: "terracotta" });
  });

  it("shifts a wall's colour but keeps how light it is", () => {
    const lum = (c: number[]) => 0.3 * c[0]! + 0.59 * c[1]! + 0.11 * c[2]!;
    const night: [number, number, number] = [58, 46, 64], day: [number, number, number] = [150, 132, 128];
    for (const c of [night, day]) {
      const out = retint(c, [138, 166, 132], 1);
      expect(Math.abs(lum(out) - lum(c))).toBeLessThan(1.5);
      // Greener than it was.
      expect(out[1]! - out[0]!).toBeGreaterThan(c[1] - c[0]);
    }
  });
});
