import { useEffect, useRef, useState } from "react";

import { getWindowEngine } from "@/window/engine";
import { Renderer } from "@/window/renderer";
import type { Room3D } from "@/window/three/room3d";

import { useWindow } from "./use-window";

type Props = { align: number; framed?: boolean };

/** The live window, drawn full screen behind everything. `align` slides the window sideways (0..1). A 3D room
 *  is rendered with WebGL when one is chosen; without WebGL it falls back to that room's 2D stand-in. */
export function Scene({ align, framed = true }: Props) {
  const { snap } = useWindow();
  const [failed, setFailed] = useState<string | null>(null);
  if (framed && snap.room3d && failed !== snap.room3d) return <Scene3D key={snap.room3d} design={snap.room3d} align={align} onFail={() => setFailed(snap.room3d)} />;
  return <Scene2D align={align} framed={framed} />;
}

const label = (city: string) => `An illustrated window in ${city}, showing the weather and time of day there`;

function usePointer(target: React.RefObject<{ setPointer(x: number, y: number): void } | null>) {
  useEffect(() => {
    const move = (e: PointerEvent) => target.current?.setPointer((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [target]);
}

function Scene2D({ align, framed }: { align: number; framed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const { snap } = useWindow();
  usePointer(renderer);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = getWindowEngine();
    const r = new Renderer(canvas, engine.getSnapshot().view, engine.getSnapshot().room, framed ? { framed: true, align, parallax: 1 } : { framed: false, parallax: 0.3, maxFps: 30 });
    renderer.current = r;
    const detach = engine.attach(r);
    const resize = new ResizeObserver(() => r.resize());
    resize.observe(canvas);
    return () => {
      detach();
      resize.disconnect();
      renderer.current = null;
    };
    // The renderer is created once; scene and alignment changes are applied below without rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => renderer.current?.setScene(snap.view, snap.room), [snap.view, snap.room]);
  useEffect(() => renderer.current?.setAlign(align), [align]);

  return <canvas ref={ref} className="scene" role="img" aria-label={label(snap.city.name)} />;
}

function Scene3D({ design, align, onFail }: { design: string; align: number; onFail: () => void }) {
  const view = useRef<HTMLCanvasElement>(null);
  const roomCanvas = useRef<HTMLCanvasElement>(null);
  const glow = useRef<HTMLCanvasElement>(null);
  const room = useRef<Room3D | null>(null);
  const { snap } = useWindow();
  usePointer(room);

  useEffect(() => {
    if (!view.current || !roomCanvas.current || !glow.current) return;
    const layers = { view: view.current, room: roomCanvas.current, glow: glow.current };
    const engine = getWindowEngine();
    let live = true;
    let cleanup = () => {};
    import("@/window/three")
      .then(({ Room3D, DESIGNS }) => {
        const d = DESIGNS[design];
        if (!live) return;
        if (!d) throw new Error(`No 3D room "${design}"`);
        const r = new Room3D(layers, d, engine.getSnapshot().view, { align });
        room.current = r;
        (window as { __room3d?: Room3D }).__room3d = r;
        const detach = engine.attach(r);
        const resize = new ResizeObserver(() => r.resize());
        resize.observe(layers.room);
        cleanup = () => {
          detach();
          resize.disconnect();
          r.dispose();
          room.current = null;
        };
      })
      .catch((e: unknown) => {
        console.warn("3D room unavailable, using the 2D room instead.", e);
        if (live) onFail();
      });
    return () => {
      live = false;
      cleanup();
    };
    // Built once per design; view and alignment changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => room.current?.setView(snap.view), [snap.view]);
  useEffect(() => room.current?.setAlign(align), [align]);

  return (
    <div className="scene scene3d" role="img" aria-label={label(snap.city.name)}>
      <canvas ref={view} className="scene-view" />
      <canvas ref={roomCanvas} className="scene-layer" />
      <canvas ref={glow} className="scene-layer scene-glow" />
    </div>
  );
}
