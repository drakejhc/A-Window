/** Battery saver: the window draws at a lower frame rate, always or only while the computer runs on battery. */
import type { Settings } from "./settings";

const SAVER_FPS = 20;

type BatteryManager = EventTarget & { charging: boolean };

/** Applies a battery-saver setting to the engine and keeps following the charger; returns a cleanup. */
export function followSaver(mode: Settings["saver"], engine: { setFrameCap(fps: number): void }) {
  const apply = (low: boolean) => engine.setFrameCap(low ? SAVER_FPS : 0);
  if (mode !== "auto") {
    apply(mode === "on");
    return () => apply(false);
  }
  apply(false);
  let battery: BatteryManager | null = null;
  let live = true;
  const update = () => battery && apply(!battery.charging);
  // Chromium (and so the desktop app) knows; elsewhere this is unavailable and nothing is capped.
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
  nav
    .getBattery?.()
    .then((b) => {
      if (!live) return;
      battery = b;
      update();
      b.addEventListener("chargingchange", update);
    })
    .catch(() => {});
  return () => {
    live = false;
    battery?.removeEventListener("chargingchange", update);
    apply(false);
  };
}
