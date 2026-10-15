import { useEffect, useRef, useState } from "react";

import { formatDuration, formatHour, type Block } from "@/planner/model";

import { Icon } from "./icons";

/** What Focus mode is working on: a block from the day, or a free session of a set length. */
export type FocusTarget = { block: Block | null; minutes: number };

type Props = {
  target: FocusTarget;
  now: number;
  onChime: () => void;
  /** Called with the seconds actually spent focusing (breaks and pauses excluded). */
  onExit: (seconds: number) => void;
  onComplete: (seconds: number) => void;
};

export function FocusCard({ target, now, onChime, onExit, onComplete }: Props) {
  const b = target.block;
  const initial = () => (b ? Math.max(60, Math.round((b.start + b.duration / 60 - Math.max(now, b.start)) * 3600)) : target.minutes * 60);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(initial);
  const [total, setTotal] = useState(initial);
  const [running, setRunning] = useState(true);
  const [saved, setSaved] = useState(0);
  // Real focused seconds: measured from the wall clock so a throttled window still counts, capped per tick
  // so a sleeping laptop does not.
  const focused = useRef(0);

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const accrue = () => {
      const t = Date.now();
      if (phase === "focus") focused.current += Math.min(90, Math.max(0, (t - last) / 1000));
      last = t;
    };
    const id = window.setInterval(() => {
      accrue();
      setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      window.clearInterval(id);
      accrue();
    };
  }, [running, phase]);

  useEffect(() => {
    if (left > 0) return;
    onChime();
    if (phase === "break") {
      setPhase("focus");
      setLeft(saved);
      setTotal(Math.max(saved, 1));
    } else setRunning(false);
    // Runs once each time the countdown reaches zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit.current(focused.current);
      else if (e.key === " " && !(e.target as HTMLElement).closest("button, input, select, textarea")) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const startBreak = () => {
    setSaved(left);
    setPhase("break");
    setLeft(5 * 60);
    setTotal(5 * 60);
    setRunning(true);
  };
  const endBreak = () => {
    setPhase("focus");
    setLeft(saved);
    setTotal(Math.max(saved, 1));
    setRunning(true);
  };

  const r = 120, c = 2 * Math.PI * r, progress = total ? left / total : 0;
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <section className="focus-card" aria-label="Focus timer">
      <span className="eyebrow" data-phase={phase}>
        {phase === "break" ? "On a break" : "Focusing"}
      </span>
      <h2>{phase === "break" ? "Breathe. Look outside." : (b?.title ?? "Free focus")}</h2>
      <p className="focus-sub">{b ? `${formatHour(b.start)} – ${formatHour(b.start + b.duration / 60)} · ${formatDuration(b.duration)}` : `${target.minutes} minute session`}</p>
      <div className="ring">
        <svg viewBox="0 0 260 260">
          <circle cx="130" cy="130" r={r} className="ring-track" />
          <circle cx="130" cy="130" r={r} className="ring-fill" data-phase={phase} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
        </svg>
        <div className="ring-text">
          <span className="ring-time" aria-live="polite">
            {mm}:{ss}
          </span>
          <span className="ring-state">{left === 0 ? "Time’s up" : running ? "remaining" : "paused"}</span>
        </div>
      </div>
      <div className="focus-row">
        <button type="button" className="round-btn" aria-label={running ? "Pause" : "Resume"} onClick={() => setRunning((v) => !v)} disabled={left === 0}>
          <Icon name={running ? "pause" : "play"} />
        </button>
        {phase === "focus" ? (
          <>
            <button type="button" className="pill-btn" onClick={startBreak}>
              <Icon name="coffee" /> 5 min break
            </button>
            <button
              type="button"
              className="pill-btn quiet"
              onClick={() => {
                setLeft((s) => s + 300);
                setTotal((t) => t + 300);
                setRunning(true);
              }}
            >
              +5 min
            </button>
          </>
        ) : (
          <button type="button" className="pill-btn" onClick={endBreak}>
            <Icon name="play" /> Back to focus
          </button>
        )}
      </div>
      <div className="focus-foot">
        <button type="button" className="ghost-btn" onClick={() => onExit(focused.current)}>
          Exit focus
        </button>
        {b && (
          <button type="button" className="primary-btn" onClick={() => onComplete(focused.current)}>
            <Icon name="check" /> {b.kind === "task" ? "Complete task" : "Finish block"}
          </button>
        )}
      </div>
      <p className="hint-keys">
        <kbd>Space</kbd> pause · <kbd>Esc</kbd> exit
      </p>
    </section>
  );
}
