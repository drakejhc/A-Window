export type QuickCategory = "study" | "health" | "personal" | "life";
export type QuickParse = { title: string; date?: string; start?: number; duration?: number; category?: QuickCategory; bucket?: "Today" | "This Week" | "Later" };

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Parses phrases like "Gym tomorrow 7am 45m #health". */
export function parseQuickAdd(input: string, today = new Date()): QuickParse {
  let text = ` ${input} `;
  const out: QuickParse = { title: "" };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) { fn(m); text = text.replace(m[0], " "); }
  };
  take(/\s#(study|health|personal|life)\b/i, (m) => (out.category = m[1]!.toLowerCase() as QuickCategory));
  take(/\s(\d+(?:\.\d+)?)\s?(h|hr|hrs|hours?|m|min|mins|minutes?)(?=\s)/i, (m) => {
    const n = Number(m[1]);
    out.duration = Math.round(/^h/i.test(m[2]!) ? n * 60 : n);
  });
  take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (m) => {
    let h = Number(m[1]) % 12;
    if (m[3]!.toLowerCase() === "pm") h += 12;
    out.start = h + Number(m[2] ?? 0) / 60;
  });
  if (out.start === undefined) take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (m) => (out.start = Number(m[1]) + Number(m[2]) / 60));
  take(/\s(today|tonight|tomorrow|tmrw)(?=\s)/i, (m) => {
    const d = new Date(today);
    if (/^t(omorrow|mrw)/i.test(m[1]!)) d.setDate(d.getDate() + 1);
    out.date = key(d);
  });
  if (!out.date) take(new RegExp(`\\s(?:on\\s)?(${DAYS.join("|")}|${DAYS.map((d) => d.slice(0, 3)).join("|")})(?=\\s)`, "i"), (m) => {
    const idx = DAYS.findIndex((d) => d.startsWith(m[1]!.toLowerCase().slice(0, 3)));
    const d = new Date(today);
    d.setDate(d.getDate() + (((idx - d.getDay() + 7) % 7) || 7));
    out.date = key(d);
  });
  take(/\s(this week|later)(?=\s)/i, (m) => (out.bucket = m[1]!.toLowerCase() === "later" ? "Later" : "This Week"));
  out.title = text.replace(/\s+/g, " ").trim();
  return out;
}
