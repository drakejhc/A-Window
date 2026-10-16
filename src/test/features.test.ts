import { blocksOn, formatHour, occursOn, setDisplayPrefs, startOfWeek, toKey, weekdayNames, type CalendarEvent } from "@/planner/model";
import { formatTemp } from "@/settings";
import { searchCities, searchOffline } from "@/window/geocode";
import { readBackup } from "@/backup";

const event = (patch: Partial<CalendarEvent>): CalendarEvent => ({ id: "e", title: "Class", date: "2026-10-12", start: 9, duration: 60, category: "study", ...patch });

describe("repeating events", () => {
  it("repeats weekly on the same weekday, from the first date on", () => {
    const e = event({ repeat: "weekly" }); // a Monday
    expect(occursOn(e, "2026-10-19")).toBe(true);
    expect(occursOn(e, "2026-10-20")).toBe(false);
    expect(occursOn(e, "2026-10-05")).toBe(false);
  });

  it("repeats on weekdays only, and skips removed days", () => {
    const e = event({ repeat: "weekdays", skip: ["2026-10-14"] });
    expect(occursOn(e, "2026-10-13")).toBe(true);
    expect(occursOn(e, "2026-10-14")).toBe(false);
    expect(occursOn(e, "2026-10-17")).toBe(false); // Saturday
  });

  it("shows repeats on the timeline with the day they fall on", () => {
    const blocks = blocksOn({ tasks: [], events: [event({ repeat: "daily" })] }, "2026-11-02");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ date: "2026-11-02", repeat: "daily" });
  });
});

describe("display preferences", () => {
  afterEach(() => setDisplayPrefs({ clock24: false, weekStart: 1 }));

  it("formats a 24-hour clock", () => {
    setDisplayPrefs({ clock24: true, weekStart: 1 });
    expect(formatHour(13.5)).toBe("13:30");
    expect(formatHour(9)).toBe("09:00");
  });

  it("starts the week on Sunday or Monday", () => {
    const thursday = new Date(2026, 9, 15);
    expect(toKey(startOfWeek(thursday))).toBe("2026-10-12");
    setDisplayPrefs({ clock24: false, weekStart: 0 });
    expect(toKey(startOfWeek(thursday))).toBe("2026-10-11");
    expect(weekdayNames("short")[0]).toMatch(/^Sun/);
  });

  it("shows temperatures in °C or °F", () => {
    expect(formatTemp(20, "c")).toBe("20°C");
    expect(formatTemp(20, "f")).toBe("68°F");
    expect(formatTemp(-40, "f")).toBe("-40°F");
  });
});

describe("city search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns geocoding results into cities with a time zone", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({ results: [{ id: 6173331, name: "Vancouver", latitude: 49.25, longitude: -123.12, timezone: "America/Vancouver", country: "Canada", admin1: "British Columbia" }, { id: 1, name: "Nowhere", latitude: 0, longitude: 0 }] }),
    }));
    const found = await searchCities("vanc");
    expect(found).toEqual([{ id: "geo-6173331", name: "Vancouver", region: "British Columbia, Canada", lat: 49.25, lon: -123.12, tz: "America/Vancouver" }]);
  });

  it("falls back to the built-in list by name or region", () => {
    expect(searchOffline("kyo").map((c) => c.id)).toEqual(["kyoto"]);
    expect(searchOffline("canada").map((c) => c.id)).toContain("vancouver");
  });
});

describe("backups", () => {
  it("accepts an A Window backup and rejects anything else", () => {
    expect(typeof readBackup(JSON.stringify({ app: "a-window", version: 1, exported: "2026-10-15", data: { "a-window:planner-v1": "{}" } }))).toBe("object");
    expect(readBackup("{}")).toMatch(/isn’t an A Window backup/);
    expect(readBackup(JSON.stringify({ app: "a-window", version: 1, data: { other: "x" } }))).toMatch(/unexpected/);
    expect(readBackup("not json")).toMatch(/couldn’t be read/);
  });
});
