// Electron shell for A Window. Serves the bundled planner from a private awindow:// origin so its
// local storage (your plan and window settings) persists between launches.
const { app, BrowserWindow, net, protocol, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "../dist");
const BOUNDS_FILE = () => path.join(app.getPath("userData"), "window-bounds.json");

protocol.registerSchemesAsPrivileged([
  { scheme: "awindow", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);
// The live window's ambience should start with the app, without waiting for a click.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function readBounds() {
  try {
    return JSON.parse(fs.readFileSync(BOUNDS_FILE(), "utf8"));
  } catch {
    return { width: 1440, height: 900 };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    ...readBounds(),
    minWidth: 900,
    minHeight: 600,
    title: "A Window",
    backgroundColor: "#0c0e13",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());
  win.on("close", () => {
    try {
      fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(win.getNormalBounds()));
    } catch {
      // Not being able to remember the window size is harmless.
    }
  });
  // Links to other sites open in the default browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("awindow://")) {
      event.preventDefault();
      if (/^https?:/.test(url)) void shell.openExternal(url);
    }
  });
  void win.loadURL("awindow://app/index.html");
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle("awindow", (request) => {
      const { pathname } = new URL(request.url);
      const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
      if (!file.startsWith(DIST + path.sep)) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
