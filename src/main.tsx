import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { isWallpaper } from "./desktop";
import { watchMusic } from "./music";
import { loadSettings } from "./settings";
import { Scene } from "./ui/Scene";
import "./styles.css";

// The desktop app's wallpaper window shows only the scene, behind your desktop icons.
const wallpaperStyle = new URLSearchParams(window.location.search).get("style");
// The wallpaper gets the record player too, when music is on in Settings.
if (isWallpaper) watchMusic(loadSettings().music);

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isWallpaper ? <Scene align={0.5} framed={wallpaperStyle !== "view"} /> : <App />}</StrictMode>,
);
