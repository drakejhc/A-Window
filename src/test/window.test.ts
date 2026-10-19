import { describe as group, expect, it } from "vitest";

import { localParts, moonPhase, nextSunEvents, seasonFor, sunPosition } from "@/window/astro";
import { cityById, guessCity } from "@/window/cities";
import { Environment } from "@/window/environment";
import { describe } from "@/window/weather";

const kyoto = cityById("kyoto")!;

group("live window astronomy", () => {
  it("puts the midsummer noon sun high over Kyoto", () => {
    // 12:00 in Kyoto is 03:00 UTC.
    const { altitude } = sunPosition(new Date(Date.UTC(2026, 5, 21, 3, 0)), kyoto.lat, kyoto.lon);
    expect(altitude).toBeGreaterThan(75);
    expect(altitude).toBeLessThan(80);
  });

  it("finds a mid-October Kyoto sunset a little after 5pm local time", () => {
    const { sunset } = nextSunEvents(new Date(Date.UTC(2026, 9, 15, 0, 0)), kyoto.lat, kyoto.lon);
    expect(sunset).not.toBeNull();
    const local = localParts(sunset!, kyoto.tz);
    expect(local.hour).toBe(17);
    expect(local.minute).toBeGreaterThanOrEqual(5);
    expect(local.minute).toBeLessThanOrEqual(35);
  });

  it("reports no sunset during the Tromsø midnight sun", () => {
    const tromso = cityById("tromso")!;
    expect(
      nextSunEvents(new Date(Date.UTC(2026, 5, 21)), tromso.lat, tromso.lon).sunset,
    ).toBeNull();
  });

  it("knows a full moon from a new one", () => {
    expect(Math.abs(moonPhase(new Date(Date.UTC(2026, 9, 26, 4))) - 0.5)).toBeLessThan(0.05);
    expect(
      Math.min(
        moonPhase(new Date(Date.UTC(2026, 9, 10, 16))),
        1 - moonPhase(new Date(Date.UTC(2026, 9, 10, 16))),
      ),
    ).toBeLessThan(0.05);
  });

  it("times the phase to within a few hours, checked against 2026's eclipses", () => {
    // An eclipse happens exactly at new (solar) or full (lunar) moon. 0.006 of a cycle is about four hours.
    const off = (date: Date, target: number) => Math.min(Math.abs(moonPhase(date) - target), 1 - Math.abs(moonPhase(date) - target));
    expect(off(new Date(Date.UTC(2026, 1, 17, 12, 12)), 0)).toBeLessThan(0.006); // annular solar eclipse
    expect(off(new Date(Date.UTC(2026, 2, 3, 11, 33)), 0.5)).toBeLessThan(0.006); // total lunar eclipse
    expect(off(new Date(Date.UTC(2026, 7, 12, 17, 46)), 0)).toBeLessThan(0.006); // total solar eclipse
    expect(off(new Date(Date.UTC(2026, 7, 28, 4, 13)), 0.5)).toBeLessThan(0.006); // partial lunar eclipse
  });

  it("flips the seasons south of the equator and keeps the tropics in summer", () => {
    expect(seasonFor(1, 35)).toBe("winter");
    expect(seasonFor(1, -41)).toBe("summer");
    expect(seasonFor(7, 1.3)).toBe("summer");
  });
});

group("live window weather", () => {
  it("maps weather codes and falls back to clear for unknown ones", () => {
    expect(describe(63)).toMatchObject({ label: "Rain", rain: 0.65, snow: 0 });
    expect(describe(95).thunder).toBe(true);
    expect(describe(1234).label).toBe("Clear");
  });

  it("starts in the viewer's own city when it is on the list", () => {
    expect(guessCity("Asia/Tokyo").id).toBe("kyoto");
    expect(guessCity("Mars/Olympus").id).toBe("kyoto");
  });
});

group("live window environment", () => {
  it("switches the lamp on at night and off in the daytime", () => {
    const env = new Environment(kyoto);
    env.update(new Date(Date.UTC(2026, 9, 15, 12, 0)), 0); // 21:00 in Kyoto
    expect(env.lamp).toBe(1);
    expect(env.dayness).toBeLessThan(0.05);
    env.setCity(kyoto);
    env.update(new Date(Date.UTC(2026, 9, 15, 3, 0)), 0); // noon in Kyoto
    expect(env.lamp).toBe(0);
    expect(env.dayness).toBeGreaterThan(0.95);
  });

  it("eases into new weather instead of jumping", () => {
    const env = new Environment(kyoto);
    const noon = new Date(Date.UTC(2026, 9, 15, 3, 0));
    env.update(noon, 0);
    env.setWeather({ ...describe(65), temp: 12, wind: 10, updated: null });
    env.update(noon, 1);
    expect(env.rain).toBeGreaterThan(0);
    expect(env.rain).toBeLessThan(0.9);
  });
});
