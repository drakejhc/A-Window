// Screenshot matrix: every room in a spread of times of day and weather, plus planner, Focus, open-view and
// window-size variants, so visual changes can be compared before and after. Writes PNGs and an index.html.
//
//   npm run dev                                   # in one terminal
//   node scripts/screenshots.cjs [out] [filter]   # in another; out defaults to shots/
//
// `filter` keeps only shots whose name contains it (e.g. "bedroom" or "night"). Needs Playwright
// (`npm i -D playwright && npx playwright install chromium`, or NODE_PATH pointing at an existing install).
// The clock is fixed to a chosen local time in Vancouver and the weather set with the engine's presets, so the
// same shot looks the same every run (apart from what moves: rain, clouds, sky life).
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const URL = process.env.A_WINDOW_URL ?? "http://localhost:5173/";
const OUT = path.resolve(process.argv[2] ?? "shots");
const FILTER = process.argv[3] ?? "";

// Vancouver, mid-October (UTC-7): sunrise about 7:30, sunset about 18:15.
const CITY = "vancouver";
const at = (hhmm) => new Date(`2026-10-17T${hhmm}:00-07:00`);
const TIMES = { dawn: "07:25", midday: "12:30", golden: "17:35", dusk: "18:40", night: "23:30" };
const WEATHER = { clear: 0, overcast: 3, rain: 63, snow: 73, fog: 45 };

const PAINTED = [
  { room: "painted", view: "painted-city" },
  { room: "painted-bedroom", view: "painted-valley" },
];
const THREE = ["listening", "cabin3d", "japanese", "mediterranean"];

function matrix() {
  const shots = [];
  // The painted rooms: every time of day × every weather, on their own views.
  for (const { room, view } of PAINTED)
    for (const [t, hhmm] of Object.entries(TIMES))
      for (const [w, code] of Object.entries(WEATHER)) shots.push({ name: `${room}--${t}--${w}`, room, view, time: hhmm, preset: code });
  // Any room with any view: the painted rooms swapped, and the older drawn views.
  for (const [room, view] of [["painted", "painted-valley"], ["painted-bedroom", "painted-city"], ["painted", "rooftops"], ["painted", "fjord"], ["painted", "city"]])
    for (const t of ["midday", "dusk"]) shots.push({ name: `${room}+${view}--${t}--clear`, room, view, time: TIMES[t], preset: 0 });
  // The 3D rooms (slow to render without a GPU): a day, an evening and a wet night each.
  for (const room of THREE)
    for (const [t, w] of [["midday", "clear"], ["dusk", "clear"], ["night", "rain"]])
      shots.push({ name: `${room}--${t}--${w}`, room, view: room === "listening" ? "painted-city" : "city", time: TIMES[t], preset: WEATHER[w], three: true });
  // Modes and sizes.
  for (const { room, view } of PAINTED) {
    shots.push({ name: `${room}--planner--golden`, room, view, time: TIMES.golden, preset: 2, keys: ["p"] });
    shots.push({ name: `${room}--focus--night`, room, view, time: TIMES.night, preset: 0, keys: ["f"] });
    shots.push({ name: `${room}--open-view--dusk`, room, view, time: TIMES.dusk, preset: 0, query: "?mode=wallpaper&style=view" });
    shots.push({ name: `${room}--narrow--midday`, room, view, time: TIMES.midday, preset: 2, size: { width: 900, height: 620 } });
    shots.push({ name: `${room}--ultrawide--night`, room, view, time: TIMES.night, preset: 0, size: { width: 3440, height: 1440 } });
  }
  return shots.filter((s) => s.name.includes(FILTER));
}

async function shoot(browser, s) {
  const size = s.size ?? (s.three ? { width: 1280, height: 800 } : { width: 1600, height: 1000 });
  const page = await browser.newPage({ viewport: size });
  await page.clock.setFixedTime(at(s.time));
  await page.addInitScript(({ city, room, view, preset }) => {
    localStorage.setItem("a-window:settings-v1", JSON.stringify({ onboarded: true }));
    localStorage.setItem("a-window:ui-sheet", "false");
    localStorage.setItem("a-window:window-v1", JSON.stringify({ city, room, view, preset, sound: false, volume: 0.6 }));
  }, { city: CITY, room: s.room, view: s.view, preset: s.preset });
  await page.goto(URL + (s.query ?? ""));
  await page.waitForTimeout(s.three ? 15000 : s.size && s.size.width > 2000 ? 30000 : 12000);
  for (const k of s.keys ?? []) {
    await page.keyboard.press(k);
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`), timeout: 120000 });
  await page.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const shots = matrix();
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [i, s] of shots.entries()) {
    process.stdout.write(`${i + 1}/${shots.length} ${s.name}\n`);
    try {
      await shoot(browser, s);
    } catch (e) {
      process.stdout.write(`  failed: ${e.message.split("\n")[0]}\n`);
    }
  }
  await browser.close();
  const all = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  const cards = all.map((f) => `<figure><a href="${f}"><img src="${f}" loading="lazy"></a><figcaption>${f.replace(".png", "")}</figcaption></figure>`).join("\n");
  fs.writeFileSync(
    path.join(OUT, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>A Window shots</title><style>body{background:#111;color:#ccc;font:12px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}img{width:100%;display:block}figure{margin:0}</style><main>${cards}</main>`,
  );
  process.stdout.write(`${all.length} shots in ${OUT}\n`);
})();
