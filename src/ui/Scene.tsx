import { useEffect, useRef } from "react";

import { getWindowEngine } from "@/window/engine";
import { Renderer } from "@/window/renderer";

import { useWindow } from "./use-window";

/** The live window, drawn full screen behind everything. `align` slides the window sideways (0..1). */
export function Scene({ align, framed = true }: { align: number; framed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const { snap } = useWindow();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = getWindowEngine();
    const r = new Renderer(canvas, engine.getSnapshot().view, engine.getSnapshot().room, framed ? { framed: true, align, parallax: 1 } : { framed: false, parallax: 0.3, maxFps: 30 });
    renderer.current = r;
    const detach = engine.attach(r);
    const resize = new ResizeObserver(() => r.resize());
    resize.observe(canvas);
    const move = (e: PointerEvent) => r.setPointer((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    window.addEventListener("pointermove", move);
    return () => {
      detach();
      resize.disconnect();
      window.removeEventListener("pointermove", move);
      renderer.current = null;
    };
    // The renderer is created once; scene and alignment changes are applied below without rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => renderer.current?.setScene(snap.view, snap.room), [snap.view, snap.room]);
  useEffect(() => renderer.current?.setAlign(align), [align]);

  return <canvas ref={ref} className="scene" role="img" aria-label={`An illustrated window in ${snap.city.name}, showing the weather and time of day there`} />;
}
