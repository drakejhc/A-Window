import { useCallback, useEffect, useRef, useState } from "react";

import type { AnyRoom, AnyView } from "@/window/types";

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
  // Changing room or view fades through a dark curtain: the new scene is built behind it (which can take a moment)
  // and the curtain lifts once its first frame is drawn, instead of freezing on a black or half-built screen.
  const [shown, setShown] = useState({ view: snap.view, room: snap.room, room3d: snap.room3d });
  const [curtain, setCurtain] = useState(false);
  const same = shown.view === snap.view && shown.room === snap.room && shown.room3d === snap.room3d;
  useEffect(() => {
    if (same) return;
    setCurtain(true);
    const t = window.setTimeout(() => setShown({ view: snap.view, room: snap.room, room3d: snap.room3d }), 300);
    return () => window.clearTimeout(t);
  }, [same, snap.view, snap.room, snap.room3d]);
  const ready = useCallback(() => requestAnimationFrame(() => requestAnimationFrame(() => setCurtain(false))), []);
  const scene =
    framed && shown.room3d && failed !== shown.room3d ? (
      <Scene3D key={shown.room3d} design={shown.room3d} view={shown.view} align={align} onReady={ready} onFail={() => setFailed(shown.room3d)} />
    ) : (
      <Scene2D align={align} framed={framed} view={shown.view} room={shown.room} onReady={ready} />
    );
  return (
    <>
      {scene}
      <div className="scene-curtain" data-on={curtain || undefined} aria-hidden />
    </>
  );
}

const label = (city: string) => `An illustrated window in ${city}, showing the weather and time of day there`;

function usePointer(target: React.RefObject<{ setPointer(x: number, y: number): void } | null>) {
  useEffect(() => {
    const move = (e: PointerEvent) => target.current?.setPointer((e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2);
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [target]);
}

function Scene2D({ align, framed, view, room, onReady }: { align: number; framed: boolean; view: AnyView; room: AnyRoom; onReady: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const { snap } = useWindow();
  usePointer(renderer);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = getWindowEngine();
    const r = new Renderer(canvas, view, room, framed ? { framed: true, align, parallax: 1 } : { framed: false, parallax: 0.3, maxFps: 30 });
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

  useEffect(() => {
    renderer.current?.setScene(view, room);
    onReady();
  }, [view, room, onReady]);
  useEffect(() => renderer.current?.setAlign(align), [align]);

  return <canvas ref={ref} className="scene" role="img" aria-label={label(snap.city.name)} />;
}

function Scene3D({ design, view: viewPack, align, onReady, onFail }: { design: string; view: AnyView; align: number; onReady: () => void; onFail: () => void }) {
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
        const r = new Room3D(layers, d, viewPack, { align });
        room.current = r;
        const detach = engine.attach(r);
        onReady();
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

  useEffect(() => {
    if (!room.current) return;
    room.current.setView(viewPack);
    onReady();
  }, [viewPack, onReady]);
  useEffect(() => room.current?.setAlign(align), [align]);

  return (
    <div className="scene scene3d" role="img" aria-label={label(snap.city.name)}>
      <canvas ref={view} className="scene-view" />
      <canvas ref={roomCanvas} className="scene-layer" />
      <canvas ref={glow} className="scene-layer scene-glow" />
    </div>
  );
}
