// The live wallpaper: a window that sits behind the desktop icons and shows only the scene.
// macOS and Linux have a "desktop" window type for this. Windows has none, so the window is re-parented
// under the desktop icons (the same technique wallpaper apps use); that part is experimental.
const { BrowserWindow, screen } = require("electron");
const { execFile } = require("node:child_process");

function attachToWindowsDesktop(win) {
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString();
  const script = `
$sig = @'
[DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
[DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
[DllImport("user32.dll")] public static extern IntPtr SetParent(IntPtr c, IntPtr p);
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
public delegate bool EnumProc(IntPtr h, IntPtr l);
'@
$u = Add-Type -MemberDefinition $sig -Name U -Namespace AWWall -PassThru
$progman = $u::FindWindow("Progman", $null)
$r = [IntPtr]::Zero
[void]$u::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$r)
$script:worker = [IntPtr]::Zero
$cb = [AWWall.U+EnumProc]{ param($h, $l)
  if ($u::FindWindowEx($h, [IntPtr]::Zero, "SHELLDLL_DefView", $null) -ne [IntPtr]::Zero) {
    $script:worker = $u::FindWindowEx([IntPtr]::Zero, $h, "WorkerW", $null)
  }
  return $true
}
[void]$u::EnumWindows($cb, [IntPtr]::Zero)
if ($script:worker -eq [IntPtr]::Zero) { $script:worker = $u::FindWindowEx($progman, [IntPtr]::Zero, "WorkerW", $null) }
if ($script:worker -eq [IntPtr]::Zero) { "fail"; exit }
[void]$u::SetParent([IntPtr]${hwnd}, $script:worker)
"ok"`;
  return new Promise((resolve) =>
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 8000, windowsHide: true }, (err, out) => resolve(!err && String(out).trim().endsWith("ok"))),
  );
}

/** Opens the wallpaper on the main display. Resolves to the window, or null if it couldn't be placed. */
async function openWallpaper(url, style, preload) {
  const { bounds } = screen.getPrimaryDisplay();
  const desktopType = process.platform === "darwin" || process.platform === "linux" ? "desktop" : undefined;
  const win = new BrowserWindow({
    ...bounds,
    ...(desktopType ? { type: desktopType } : {}),
    frame: false,
    show: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    enableLargerThanScreen: true,
    backgroundColor: "#0c0e13",
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, preload },
  });
  win.setIgnoreMouseEvents(true);
  if (process.platform === "darwin") win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  await win.loadURL(`${url}?mode=wallpaper&style=${style}`);
  win.showInactive();
  if (process.platform === "win32" && !(await attachToWindowsDesktop(win))) {
    win.destroy();
    return null;
  }
  // Follow the main display if it changes (a monitor plugged in, the resolution changed).
  const fit = () => !win.isDestroyed() && win.setBounds(screen.getPrimaryDisplay().bounds);
  screen.on("display-metrics-changed", fit);
  screen.on("display-added", fit);
  screen.on("display-removed", fit);
  win.on("closed", () => {
    screen.off("display-metrics-changed", fit);
    screen.off("display-added", fit);
    screen.off("display-removed", fit);
  });
  return win;
}

module.exports = { openWallpaper };
