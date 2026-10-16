// Reads what's playing in Spotify (macOS and Windows) or Apple Music (macOS), and controls playback.
// macOS asks once for permission to talk to the music app. No accounts or API keys are involved.
const { execFile } = require("node:child_process");
const { net } = require("electron");

const run = (cmd, args, timeout = 2500) =>
  new Promise((resolve) => execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve(err ? "" : String(stdout).trim())));

const isRunning = async (name) => (await run("pgrep", ["-x", name])) !== "";

// Each app is queried only when it's running, so a missing app never breaks the script.
const MAC = {
  Spotify: `tell application "Spotify"
  if player state is stopped then return ""
  set t to current track
  return (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & (artwork url of t) & tab & (player position as text) & tab & ((duration of t) / 1000 as text)
end tell`,
  Music: `tell application "Music"
  if player state is stopped then return ""
  set t to current track
  return (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & "" & tab & (player position as text) & tab & (duration of t as text)
end tell`,
};

const num = (s) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

async function readMac() {
  const found = [];
  for (const app of ["Spotify", "Music"]) {
    if (!(await isRunning(app))) continue;
    const out = await run("osascript", ["-e", MAC[app]]);
    if (!out) continue;
    const [state, title, artist, album, artworkUrl, position, duration] = out.split("\t");
    if (!title) continue;
    found.push({ app, state: state === "playing" ? "playing" : "paused", title, artist, album, artworkUrl: artworkUrl || undefined, position: num(position), duration: num(duration) });
  }
  return found.find((f) => f.state === "playing") ?? found[0] ?? null;
}

let lastWindows = null;
async function readWindows() {
  const out = await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-Process -Name Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle } | Select-Object -ExpandProperty MainWindowTitle",
  ], 4000);
  if (!out) return (lastWindows = null);
  // Spotify's window title is "Artist - Title" while playing, and just "Spotify ..." when paused.
  const playing = out.split(/\r?\n/).find((t) => t.includes(" - "));
  if (playing) {
    const i = playing.indexOf(" - ");
    lastWindows = { app: "Spotify", state: "playing", artist: playing.slice(0, i), title: playing.slice(i + 3) };
    return lastWindows;
  }
  return lastWindows ? { ...lastWindows, state: "paused" } : null;
}

const MAC_CONTROL = { playpause: "playpause", next: "next track", previous: "previous track" };
const WIN_KEYS = { playpause: "0xB3", next: "0xB0", previous: "0xB1" };

async function control(app, command) {
  if (process.platform === "darwin") {
    const verb = app === "Music" && command === "previous" ? "back track" : MAC_CONTROL[command];
    if (verb) await run("osascript", ["-e", `tell application "${app === "Music" ? "Music" : "Spotify"}" to ${verb}`]);
  } else if (process.platform === "win32" && WIN_KEYS[command]) {
    // A media key press, which Spotify (and most players) respond to.
    const key = WIN_KEYS[command];
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$s='[DllImport("user32.dll")] public static extern void keybd_event(byte b, byte s, uint f, UIntPtr e);'; $k=Add-Type -MemberDefinition $s -Name K -Namespace AW -PassThru; $k::keybd_event(${key},0,0,[UIntPtr]::Zero); $k::keybd_event(${key},0,2,[UIntPtr]::Zero)`,
    ], 5000);
  }
}

// Album art, cached by track. Spotify gives a URL on macOS; otherwise the iTunes catalogue is searched.
const artCache = new Map();
async function toDataUrl(url) {
  const res = await net.fetch(url);
  if (!res.ok) return undefined;
  const type = res.headers.get("content-type") || "image/jpeg";
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}
async function artwork(track) {
  const key = `${track.artist}|${track.album || track.title}`;
  if (artCache.has(key)) return artCache.get(key);
  let art;
  try {
    if (track.artworkUrl) art = await toDataUrl(track.artworkUrl);
    if (!art) {
      const q = encodeURIComponent(`${track.artist} ${track.album || track.title}`);
      const res = await net.fetch(`https://itunes.apple.com/search?term=${q}&entity=${track.album ? "album" : "song"}&limit=1`);
      const hit = res.ok ? (await res.json()).results?.[0] : undefined;
      if (hit?.artworkUrl100) art = await toDataUrl(hit.artworkUrl100.replace("100x100bb", "600x600bb"));
    }
  } catch {
    art = undefined;
  }
  if (artCache.size > 50) artCache.delete(artCache.keys().next().value);
  artCache.set(key, art);
  return art;
}

/** Polls while at least one window wants music, and sends each change to `send`. */
function createWatcher(send) {
  let timer = null, last = "", current = null, busy = false;
  const read = process.platform === "darwin" ? readMac : process.platform === "win32" ? readWindows : async () => null;
  async function poll() {
    if (busy) return;
    busy = true;
    try {
      const t = await read();
      current = t;
      const sig = t ? `${t.app}|${t.state}|${t.title}|${t.artist}|${Math.round((t.position ?? 0) / 5)}` : "";
      if (sig !== last) {
        last = sig;
        send(t ? { app: t.app, state: t.state, title: t.title, artist: t.artist, album: t.album, position: t.position, duration: t.duration, artwork: await artwork(t), at: Date.now() } : null);
      }
    } finally {
      busy = false;
    }
  }
  return {
    set(on) {
      if (on && !timer) {
        last = "";
        void poll();
        timer = setInterval(poll, process.platform === "win32" ? 3000 : 1500);
      } else if (!on && timer) {
        clearInterval(timer);
        timer = null;
        send(null);
      }
    },
    control: async (command) => {
      await control(current?.app, command);
      setTimeout(poll, 350);
    },
  };
}

module.exports = { createWatcher };
