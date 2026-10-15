import type { Environment } from "./environment";
import type { RGB, Rng } from "./util";

/** Where the glass sits on the canvas. In open mode the glass is the whole canvas. */
export type Geom = {
  W: number;
  H: number;
  x: number;
  y: number;
  w: number;
  h: number;
  frame: number;
  mull: number;
  mx: number;
  my: number;
  panes: { x: number; y: number; w: number; h: number }[];
  /** Scale for sizes drawn in pack units (1 ≈ a 900px wide window). */
  s: number;
  horizon: number;
  framed: boolean;
};

/** The environment as a drawing pass sees it, with this renderer's own frame time. */
export type FrameEnv = Environment & { dt: number };

export type Painter = {
  /** Lights a colour with the ambient light, then fades it into the sky by distance (0 near, 1 far). */
  shade: (c: RGB, env: FrameEnv, depth: number) => RGB;
  /** Parallax offset for a layer; depth 0 is the far sky, 1 is right against the glass. */
  par: (depth: number) => { x: number; y: number };
};

export type AmbienceWeights = {
  rain: number;
  wind: number;
  city: number;
  fire: number;
  crickets: number;
  birds: number;
};

/**
 * A window pack draws what makes a scene its own. The renderer handles the sky, sun, moon, clouds,
 * falling weather and the glass for every pack. In open mode only drawLandscape and drawForeground run.
 */
export interface WindowPack<D> {
  id: string;
  name: string;
  ambience: AmbienceWeights;
  build(g: Geom, rng: Rng): D;
  /** Wall behind everything, drawn first (framed mode only). */
  drawRoom(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** The view, clipped to the glass. */
  drawLandscape(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** Things close to the glass, still clipped. */
  drawForeground(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** Frame, sill and objects in the room, drawn last (framed mode only). */
  drawInterior(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the renderer only passes a pack's data back to that pack
export type AnyPack = WindowPack<any>;
