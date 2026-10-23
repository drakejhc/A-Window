// The small, fixed set of desktop features the page may use (see src/desktop.ts for the types).
const { contextBridge, ipcRenderer } = require("electron");

const listen = (channel, cb) => {
  const handler = (_event, value) => cb(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld("aWindow", {
  platform: process.platform,
  version: ipcRenderer.sendSync("app-version"),
  getSettings: () => ipcRenderer.invoke("desktop-settings"),
  setSettings: (patch) => ipcRenderer.invoke("desktop-settings", patch),
  watchMusic: (on) => ipcRenderer.send("music-watch", !!on),
  musicControl: (command) => ipcRenderer.send("music-control", command),
  onNowPlaying: (cb) => listen("now-playing", cb),
  onCommand: (cb) => listen("command", cb),
  show: () => ipcRenderer.send("show-window"),
  backup: (json) => ipcRenderer.send("backup", String(json)),
  openBackups: () => ipcRenderer.send("open-backups"),
  onPlannerRequest: (cb) => listen("planner-request", cb),
  plannerReply: (reply) => ipcRenderer.send("planner-reply", reply),
});
