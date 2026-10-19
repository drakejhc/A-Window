import { useEffect, useRef } from "react";

import { useBackdrop, useBackdropUrls, type BackdropFile } from "@/backdrop";
import { getWindowEngine } from "@/window/engine";
import type { Environment } from "@/window/environment";
import { Renderer } from "@/window/renderer";
import { clamp } from "@/window/util";

import { useWindow } from "./use-window";

/** One picture or video, filling the screen or shown whole. Shown whole, a picture sits on a blurred copy of
 *  itself rather than black bars. */
function Layer({ file, url, fit, onLoad }: { file: BackdropFile; url: string; fit: "cover" | "contain"; onLoad?: () => void }) {
  if (file.video)
    return <video className="backdrop-media" data-fit={fit} src={url} autoPlay loop muted playsInline disablePictureInPicture onLoadedData={onLoad} onError={onLoad} />;
  return (
    <>
      {fit === "contain" && <img className="backdrop-media backdrop-fill" src={url} alt="" aria-hidden />}
      <img className="backdrop-media" data-fit={fit} src={url} alt="" decoding="async" onLoad={onLoad} onError={onLoad} />
    </>
  );
}

/** Your own picture or video in place of the window. After dark it fades to your night picture, or dims, as the
 *  sun sets in the window's city; and the city's rain and snow can fall over it, as if on the glass. */
export function Backdrop({ onReady }: { onReady: () => void }) {
  const { snap } = useWindow();
  const b = useBackdrop();
  const urls = useBackdropUrls(b);
  const night = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const weather = useRef<HTMLCanvasElement>(null);
  const settings = useRef(b);
  settings.current = b;

  // Nothing to load: lift the curtain anyway.
  useEffect(() => {
    if (urls.loaded && !urls.day) onReady();
  }, [urls.loaded, urls.day, onReady]);

  // Follows the sun: the night picture fades in (or the picture dims) from just before sunset until the sky is dark.
  useEffect(() => {
    const engine = getWindowEngine();
    let last = -1;
    const apply = (env: Environment) => {
      const n = Math.round(clamp(env.night) * 200) / 200;
      if (n === last) return;
      last = n;
      if (night.current) night.current.style.opacity = String(n);
      if (dim.current) dim.current.style.opacity = String(settings.current.dim && !settings.current.night ? n * 0.5 : 0);
    };
    apply(engine.env);
    return engine.attach({ tick: (env) => apply(env) });
  }, []);
  useEffect(() => {
    if (dim.current) dim.current.style.opacity = String(b.dim && !b.night ? clamp(getWindowEngine().env.night) * 0.5 : 0);
  }, [b.dim, b.night]);

  // The weather, drawn over the picture.
  useEffect(() => {
    const canvas = weather.current;
    if (!canvas || !b.weather) return;
    const engine = getWindowEngine();
    const r = new Renderer(canvas, snap.view, snap.room, { framed: false, overlay: true, parallax: 0, maxFps: 30 });
    const detach = engine.attach(r);
    const ro = new ResizeObserver(() => r.resize());
    ro.observe(canvas);
    return () => {
      detach();
      ro.disconnect();
    };
    // The packs aren't drawn in overlay mode, so a new scene doesn't need a new renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b.weather]);

  return (
    <div className="scene backdrop" role="img" aria-label={`Your own background, following the time of day in ${snap.city.name}`}>
      {b.day && urls.day ? (
        <Layer key={`d${b.stamp}`} file={b.day} url={urls.day} fit={b.fit} onLoad={onReady} />
      ) : (
        urls.loaded && <div className="backdrop-empty">Choose a picture or video for your background from the room menu.</div>
      )}
      {b.night && urls.night && (
        <div ref={night} className="backdrop-night" style={{ opacity: clamp(getWindowEngine().env.night) }}>
          <Layer key={`n${b.stamp}`} file={b.night} url={urls.night} fit={b.fit} />
        </div>
      )}
      <div ref={dim} className="backdrop-dim" />
      {b.weather && <canvas ref={weather} className="backdrop-weather" />}
    </div>
  );
}
