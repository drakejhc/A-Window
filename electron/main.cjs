// Electron shell for A Window. Serves the built app from a private awindow:// origin so its local storage
// (your plan and settings) persists, and adds what only a desktop app can do: a menu bar icon, the live
// wallpaper, opening at login, and seeing what's playing in Spotify or Apple Music.
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net, protocol, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// `--mcp`: Claude started the app to read and change the plan. Run the MCP server (mcp.cjs) as plain Node with this
// same executable, passing stdin and stdout straight through, and open no windows. It talks to the running app over
// the bridge below.
if (process.argv.includes("--mcp")) {
  app.dock?.hide();
  const script = path.join(__dirname, "mcp.cjs").replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
  const child = require("node:child_process").spawn(process.execPath, [script], {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", A_WINDOW_DATA: app.getPath("userData") },
  });
  child.on("exit", (code) => app.exit(code ?? 0));
  child.on("error", () => app.exit(1));
  return;
}

const { createWatcher } = require("./music.cjs");
const { openWallpaper } = require("./wallpaper.cjs");
const { createBridge } = require("./bridge.cjs");

const DIST = path.join(__dirname, "../dist");
const APP_URL = "awindow://app/index.html";
const PRELOAD = path.join(__dirname, "preload.cjs");
const STORE = () => path.join(app.getPath("userData"), "desktop.json");

protocol.registerSchemesAsPrivileged([
  { scheme: "awindow", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
// The window's ambience should start with the app, without waiting for a click.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const defaults = { wallpaper: false, wallpaperStyle: "room", openAtLogin: false, claude: false, bounds: { width: 1440, height: 900 } };
let store = { ...defaults };
let quitting = false;
app.on("before-quit", () => (quitting = true));
app.on("will-quit", () => bridge.stop());
function load() {
  try {
    store = { ...defaults, ...JSON.parse(fs.readFileSync(STORE(), "utf8")) };
  } catch {
    /* first launch */
  }
}
const save = () => {
  try {
    fs.writeFileSync(STORE(), JSON.stringify(store));
  } catch {
    /* not being able to save is harmless */
  }
};

let main = null;
let wallpaper = null;
let tray = null;
let refreshTray = () => {};
const musicWanted = new Set();
const watcher = createWatcher((np) => {
  for (const w of BrowserWindow.getAllWindows()) {
    // A window that is closing can still be listed after its page is gone; sending to it would throw.
    if (w.isDestroyed() || w.webContents.isDestroyed()) continue;
    try {
      w.webContents.send("now-playing", np);
    } catch {
      /* the page went away between the check and the send */
    }
  }
});
const updateMusicWatch = () => watcher.set(musicWanted.size > 0);

// Use with Claude: a local bridge the MCP server calls, which hands each tool call to the page (see bridge.cjs).
const bridge = createBridge({
  file: () => path.join(app.getPath("userData"), "mcp.json"),
  page: () => {
    if (!main) createMain({ show: false });
    return main.webContents;
  },
});
/** How Claude starts the MCP server: this app's executable running mcp.cjs as plain Node, so no window system
 *  starts (which also works with no display, and shows no Dock icon). `--mcp` above does the same, more slowly. */
const claudeLaunch = () => ({
  command: process.execPath,
  args: [app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "electron", "mcp.cjs") : path.join(__dirname, "mcp.cjs")],
  env: { ELECTRON_RUN_AS_NODE: "1", A_WINDOW_DATA: app.getPath("userData") },
});

/** The saved window position, if it is still on a connected screen; otherwise just the size, so the window opens
 *  centred on the main screen (for example after an external monitor has been unplugged). */
function startBounds() {
  const b = store.bounds ?? {};
  const size = { width: Math.max(900, b.width ?? 1440), height: Math.max(600, b.height ?? 900) };
  if (typeof b.x !== "number" || typeof b.y !== "number") return size;
  // Visible enough to grab: at least 120×60 px of the window's title area must lie within some screen.
  const grab = { x: b.x + 40, y: b.y, width: 120, height: 60 };
  const visible = screen.getAllDisplays().some(({ workArea: a }) => grab.x < a.x + a.width && grab.x + grab.width > a.x && grab.y < a.y + a.height && grab.y + grab.height > a.y && grab.y >= a.y - 20);
  if (!visible) return size;
  // Also keep a window that was bigger than its screen from spilling off it.
  const d = screen.getDisplayMatching({ x: b.x, y: b.y, width: size.width, height: size.height }).workArea;
  return { x: b.x, y: b.y, width: Math.min(size.width, d.width), height: Math.min(size.height, d.height) };
}

function createMain({ show = true } = {}) {
  main = new BrowserWindow({
    ...startBounds(),
    minWidth: 900,
    minHeight: 600,
    title: "A Window",
    backgroundColor: "#0c0e13",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: PRELOAD },
  });
  if (show) main.once("ready-to-show", () => main?.show());
  // Closing hides the window to the menu bar or tray, so reminders still arrive; quitting (from the tray menu, or
  // when the computer shuts down) really closes it.
  main.on("close", (event) => {
    store.bounds = main.getNormalBounds();
    save();
    if (quitting) return;
    event.preventDefault();
    main.hide();
    main.webContents.send("command", "hidden");
  });
  // Windows logging off or shutting down doesn't send before-quit; let the window close then too.
  main.on("session-end", () => (quitting = true));
  main.on("closed", () => (main = null));
  // Links to other sites open in the default browser, never inside the app.
  main.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  main.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("awindow://")) {
      event.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
  void main.loadURL(APP_URL);
}

/** Shows the main window (creating it if it was closed), then passes on a command such as "focus". */
function showMain(command) {
  const fresh = !main;
  if (fresh) createMain();
  else {
    if (main.isMinimized()) main.restore();
    if (!main.isVisible()) main.webContents.send("command", "shown");
    main.show();
    main.focus();
  }
  if (!command) return;
  if (fresh || main.webContents.isLoading()) main.webContents.once("did-finish-load", () => main?.webContents.send("command", command));
  else main.webContents.send("command", command);
}

async function applyWallpaper() {
  if (wallpaper && !wallpaper.isDestroyed()) wallpaper.destroy();
  wallpaper = null;
  if (!store.wallpaper) return undefined;
  wallpaper = await openWallpaper(APP_URL, store.wallpaperStyle, PRELOAD);
  if (wallpaper) return undefined;
  store.wallpaper = false;
  save();
  return "The wallpaper couldn’t be placed behind the desktop icons on this version of Windows.";
}

/** Starts or stops the Claude bridge to match the setting; returns an error message if it couldn't start. */
async function applyBridge() {
  if (!store.claude) return void bridge.stop();
  try {
    await bridge.start();
    return undefined;
  } catch {
    store.claude = false;
    save();
    return "Claude couldn’t be connected: the app couldn’t open its local connection.";
  }
}

function applyLogin() {
  if (process.platform === "linux") return;
  app.setLoginItemSettings({ openAtLogin: store.openAtLogin, openAsHidden: true, args: ["--hidden"] });
}

// Updates come from the project's GitHub releases: downloaded quietly in the background, installed when the app
// quits, or straight away from "Restart to Update" in the tray menu. Not on macOS, where updating needs a signed app.
let updateReady = false;
function watchForUpdates() {
  if (!app.isPackaged || process.platform === "darwin") return;
  const { autoUpdater } = require("electron-updater");
  autoUpdater.on("error", () => {
    /* offline, or no release yet: try again later */
  });
  autoUpdater.on("update-downloaded", () => {
    updateReady = true;
    refreshTray();
  });
  const check = () => void autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

function installUpdate() {
  quitting = true;
  require("electron-updater").autoUpdater.quitAndInstall();
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "assets", process.platform === "darwin" ? "trayTemplate.png" : "tray.png"));
  if (process.platform === "darwin") icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip("A Window");
  const refresh = () =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open A Window", click: () => showMain() },
        { label: "Start Focus", click: () => showMain("focus") },
        { label: "Open the Planner", click: () => showMain("planner") },
        { type: "separator" },
        {
          label: "Live Wallpaper",
          type: "checkbox",
          checked: store.wallpaper,
          click: async (item) => {
            store.wallpaper = item.checked;
            save();
            await applyWallpaper();
            refresh();
          },
        },
        { label: "Settings…", click: () => showMain("settings") },
        { type: "separator" },
        ...(updateReady ? [{ label: "Restart to Update", click: installUpdate }, { type: "separator" }] : []),
        { label: "Quit A Window", role: "quit" },
      ]),
    );
  refresh();
  if (process.platform !== "darwin") tray.on("click", () => showMain());
  return refresh;
}

ipcMain.on("app-version", (e) => (e.returnValue = app.getVersion()));
ipcMain.handle("desktop-settings", async (_e, patch) => {
  let error;
  if (patch && typeof patch === "object") {
    const before = { ...store };
    if (typeof patch.wallpaper === "boolean") store.wallpaper = patch.wallpaper;
    if (patch.wallpaperStyle === "room" || patch.wallpaperStyle === "view") store.wallpaperStyle = patch.wallpaperStyle;
    if (typeof patch.openAtLogin === "boolean") store.openAtLogin = patch.openAtLogin;
    if (typeof patch.claude === "boolean") store.claude = patch.claude;
    save();
    if (store.claude !== before.claude) error = await applyBridge();
    if (store.wallpaper !== before.wallpaper || (store.wallpaper && store.wallpaperStyle !== before.wallpaperStyle)) error = await applyWallpaper();
    if (store.openAtLogin !== before.openAtLogin) applyLogin();
    refreshTray();
  }
  return { wallpaper: store.wallpaper, wallpaperStyle: store.wallpaperStyle, openAtLogin: store.openAtLogin, claude: store.claude, claudeLaunch: claudeLaunch(), ...(error ? { error } : {}) };
});
const musicSenders = new Set();
ipcMain.on("music-watch", (e, on) => {
  const id = e.sender.id;
  if (on) musicWanted.add(id);
  else musicWanted.delete(id);
  // Clean up once per window when it goes away, not on every call.
  if (!musicSenders.has(id)) {
    musicSenders.add(id);
    e.sender.once("destroyed", () => {
      musicSenders.delete(id);
      musicWanted.delete(id);
      updateMusicWatch();
    });
  }
  updateMusicWatch();
});
ipcMain.on("show-window", () => showMain());
ipcMain.on("planner-reply", (e, reply) => {
  if (main && e.sender === main.webContents) bridge.reply(reply);
});

// A copy of the plan in the app's folder for each of the last 14 days it was used, so a wiped or broken local
// storage never loses everything.
const BACKUPS = () => path.join(app.getPath("userData"), "backups");
ipcMain.on("backup", (_e, json) => {
  if (typeof json !== "string" || json.length > 20_000_000) return;
  try {
    JSON.parse(json);
    fs.mkdirSync(BACKUPS(), { recursive: true });
    const day = new Date().toLocaleDateString("en-CA");
    fs.writeFileSync(path.join(BACKUPS(), `plan-${day}.json`), json);
    const old = fs.readdirSync(BACKUPS()).filter((f) => /^plan-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -14);
    for (const f of old) fs.rmSync(path.join(BACKUPS(), f));
  } catch {
    /* disk full or not writable: try again on the next change */
  }
});
ipcMain.on("open-backups", () => {
  fs.mkdirSync(BACKUPS(), { recursive: true });
  void shell.openPath(BACKUPS());
});
ipcMain.on("music-control", (_e, command) => {
  if (["playpause", "next", "previous"].includes(command)) void watcher.control(command);
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => showMain());

  app.whenReady().then(async () => {
    load();
    protocol.handle("awindow", (request) => {
      const { pathname } = new URL(request.url);
      const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
      if (!file.startsWith(DIST + path.sep)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    const hidden = process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAsHidden;
    refreshTray = buildTray();
    createMain({ show: !hidden });
    await applyWallpaper();
    await applyBridge();
    watchForUpdates();
    app.on("activate", () => showMain());
  });

  // Closing the window keeps the app (and the wallpaper) running from the menu bar or tray icon.
  app.on("window-all-closed", () => {});
}
