/** The planner's data: events (fixed commitments) and tasks (flexible work that can be placed on the day). */
export type Bucket = "Today" | "This Week" | "Later";
export type Category = "study" | "health" | "personal" | "life";
export type Kind = "task" | "event";
export type Subtask = { id: string; title: string; done: boolean };

type Shared = {
  id: string;
  title: string;
  duration: number;
  category: Category;
  notes?: string | undefined;
  subtasks?: Subtask[] | undefined;
  /** Minutes of focused time actually spent, accumulated across focus sessions. */
  actual?: number | undefined;
};
export type Task = Shared & { bucket: Bucket; completed?: boolean | undefined; date?: string | undefined; start?: number | undefined };
export type CalendarEvent = Shared & { date: string; start: number; meta?: string | undefined };
export type PlannerData = { tasks: Task[]; events: CalendarEvent[] };

/** Anything with a place on a day: an event, or a task that has been scheduled. */
export type Block = { kind: Kind; id: string; title: string; start: number; duration: number; category: Category; completed: boolean; meta?: string | undefined; actual?: number | undefined };

export const BUCKETS: Bucket[] = ["Today", "This Week", "Later"];
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "study", label: "Study" },
  { value: "health", label: "Health" },
  { value: "personal", label: "Personal" },
  { value: "life", label: "Life" },
];
export const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180];
export const START_HOUR = 6;
export const END_HOUR = 23;
export const SNAP = 0.25;

const pad = (n: number) => n.toString().padStart(2, "0");
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (key: string) => {
  const [y = 0, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const snap = (h: number) => Math.round(h / SNAP) * SNAP;
export const nowHour = (d = new Date()) => d.getHours() + d.getMinutes() / 60;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function formatHour(hour: number) {
  let whole = Math.floor(hour);
  let minutes = Math.round((hour - whole) * 60);
  if (minutes === 60) {
    whole += 1;
    minutes = 0;
  }
  const display = whole % 12 === 0 ? 12 : whole % 12;
  return `${display}:${pad(minutes)} ${whole >= 12 && whole < 24 ? "PM" : "AM"}`;
}
export const formatDuration = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
export const toTime = (h: number) => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;
export const parseTime = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h + m / 60;
};

/** Everything placed on `date`, earliest first. */
export function blocksOn(data: PlannerData, date: string): Block[] {
  const events: Block[] = data.events
    .filter((e) => e.date === date)
    .map((e) => ({ kind: "event", id: e.id, title: e.title, start: e.start, duration: e.duration, category: e.category, completed: false, meta: e.meta, actual: e.actual }));
  const tasks: Block[] = data.tasks
    .filter((t) => t.date === date && t.start !== undefined)
    .map((t) => ({ kind: "task", id: t.id, title: t.title, start: t.start!, duration: t.duration, category: t.category, completed: !!t.completed, actual: t.actual }));
  return [...events, ...tasks].sort((a, b) => a.start - b.start);
}

/** The block happening now, or else the next one still to come today. */
export function currentBlock(data: PlannerData, today: string, now: number): Block | undefined {
  const open = blocksOn(data, today).filter((b) => !b.completed);
  return open.find((b) => b.start <= now && now < b.start + b.duration / 60) ?? open.find((b) => b.start > now);
}

/** Example data for a first visit, laid out around the current week. */
export function sampleData(today = new Date()): PlannerData {
  const t = toKey(today), week = startOfWeek(today);
  const day = (n: number) => toKey(addDays(week, n));
  const events: CalendarEvent[] = [
    { id: "e1", title: "Morning run", date: t, start: 7.5, duration: 60, category: "health", meta: "River loop" },
    { id: "e2", title: "Cognitive Science", date: t, start: 10, duration: 75, category: "study", meta: "Hawkins 214" },
    { id: "e3", title: "Lunch with Maya", date: t, start: 12.5, duration: 60, category: "personal", meta: "June's Cafe" },
    { id: "e4", title: "Statistics seminar", date: t, start: 15, duration: 75, category: "study", meta: "Zoom" },
    { id: "e5", title: "Dinner", date: t, start: 19, duration: 60, category: "life", meta: "Home" },
    ...([
      { id: "e6", title: "Linear Algebra", date: day(0), start: 9, duration: 90, category: "study", meta: "Science 101" },
      { id: "e7", title: "Gym, legs", date: day(1), start: 17.5, duration: 60, category: "health", meta: "Rec center" },
      { id: "e8", title: "Linear Algebra", date: day(2), start: 9, duration: 90, category: "study", meta: "Science 101" },
      { id: "e9", title: "Study group", date: day(3), start: 16, duration: 90, category: "study", meta: "Library 3F" },
      { id: "e10", title: "Brunch with roommates", date: day(5), start: 11, duration: 90, category: "personal", meta: "Sunny Side" },
      { id: "e11", title: "Long run", date: day(6), start: 8, duration: 75, category: "health", meta: "Lakeshore" },
    ] satisfies CalendarEvent[]).filter((e) => e.date !== t),
  ];
  const tasks: Task[] = [
    { id: "t1", title: "Deep work: research outline", duration: 75, bucket: "Today", category: "study", date: t, start: 8.75 },
    { id: "t2", title: "Problem set 4", duration: 60, bucket: "Today", category: "study", date: t, start: 16.5 },
    { id: "t3", title: "Review chapter 6 notes", duration: 45, bucket: "Today", category: "study" },
    { id: "t4", title: "Plan next week's meals", duration: 30, bucket: "Today", category: "life" },
    { id: "t5", title: "Email Professor Kim", duration: 15, bucket: "Today", category: "study" },
    { id: "t6", title: "Pick up dry cleaning", duration: 30, bucket: "This Week", category: "life" },
    { id: "t7", title: "Call grandma", duration: 30, bucket: "This Week", category: "personal" },
    { id: "t8", title: "Yoga session", duration: 45, bucket: "This Week", category: "health" },
    { id: "t9", title: "Book dentist appointment", duration: 15, bucket: "Later", category: "personal" },
    { id: "t10", title: "Renew passport", duration: 60, bucket: "Later", category: "life" },
  ];
  return { tasks, events };
}
