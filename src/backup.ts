/** Export and import everything the app keeps (plan, settings, window), as one JSON file. */
const PREFIX = "a-window:";

export type Backup = { app: "a-window"; version: 1; exported: string; data: Record<string, string> };

export function makeBackup(): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX)) data[key] = window.localStorage.getItem(key) ?? "";
  }
  return { app: "a-window", version: 1, exported: new Date().toISOString(), data };
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(makeBackup(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `a-window-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Checks a file is an A Window backup; returns a message to show if it isn't. */
export function readBackup(text: string): Backup | string {
  try {
    const b = JSON.parse(text) as Partial<Backup>;
    if (b.app !== "a-window" || typeof b.data !== "object" || !b.data) return "That file isn’t an A Window backup.";
    if (!Object.keys(b.data).every((k) => k.startsWith(PREFIX))) return "That backup has unexpected contents.";
    return b as Backup;
  } catch {
    return "That file couldn’t be read as a backup.";
  }
}

/** Replaces the stored data with the backup's and reloads, so every part of the app starts from it. */
export function restoreBackup(b: Backup) {
  for (const key of Object.keys(window.localStorage)) if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
  for (const [key, value] of Object.entries(b.data)) window.localStorage.setItem(key, value);
  window.location.reload();
}
