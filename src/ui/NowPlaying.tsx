import { useEffect, useState } from "react";

import { desktop } from "@/desktop";
import { useMusic } from "@/music";

import { Icon } from "./icons";

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A small record sleeve in the corner for whatever Spotify or Apple Music is playing. */
export function NowPlaying() {
  const { np } = useMusic();
  const [, tick] = useState(0);
  useEffect(() => {
    if (np?.state !== "playing") return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [np?.state]);
  if (!np || !desktop) return null;

  const playing = np.state === "playing";
  const position = np.position !== undefined ? Math.min(np.duration ?? Infinity, np.position + (playing ? (Date.now() - np.at) / 1000 : 0)) : undefined;
  const progress = position !== undefined && np.duration ? position / np.duration : undefined;
  return (
    <section className="now-playing" data-playing={playing || undefined} aria-label={`Now playing in ${np.app}`}>
      <div className="vinyl" aria-hidden>
        <div className="vinyl-disc">{np.artwork ? <img src={np.artwork} alt="" /> : <span className="vinyl-label" />}</div>
      </div>
      <div className="np-body">
        <p className="np-title" title={np.title}>
          {np.title}
        </p>
        <p className="np-artist" title={np.artist}>
          {np.artist}
        </p>
        {progress !== undefined && (
          <div className="np-progress">
            <span>{time(position!)}</span>
            <div className="bar">
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <span>{time(np.duration!)}</span>
          </div>
        )}
      </div>
      <div className="np-controls">
        <button type="button" className="icon-btn" aria-label="Previous track" onClick={() => desktop?.musicControl("previous")}>
          <Icon name="left" />
        </button>
        <button type="button" className="icon-btn" aria-label={playing ? "Pause" : "Play"} onClick={() => desktop?.musicControl("playpause")}>
          <Icon name={playing ? "pause" : "play"} />
        </button>
        <button type="button" className="icon-btn" aria-label="Next track" onClick={() => desktop?.musicControl("next")}>
          <Icon name="right" />
        </button>
      </div>
    </section>
  );
}
