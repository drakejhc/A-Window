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
  /** A café's murmur and clinking cups, and a record's crackle: off unless a room asks for them or you turn them up. */
  cafe?: number;
  vinyl?: number;
};

/** The view outside: drawn inside the glass. The renderer adds sky, sun, moon, clouds and weather around it. */
export interface ViewPack<D> {
  id: string;
  name: string;
  ambience: AmbienceWeights;
  build(g: Geom, rng: Rng): D;
  /** The view, clipped to the glass. */
  drawLandscape(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** Things close to the glass, still clipped. */
  drawForeground(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** A painted view: the renderer softens its clouds to match. */
  painted?: boolean;
}

/** The room around the window (framed mode only). Its data may include `turntable: {x, y}`, the spot on the
 *  sill or desk where the record player stands while music plays. */
export interface RoomPack<D> {
  id: string;
  name: string;
  ambience: AmbienceWeights;
  build(g: Geom, rng: Rng): D;
  /** Walls and everything behind the window, drawn first. */
  drawRoom(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
  /** Frame, sill or desk, and the things on it, drawn last. */
  drawInterior(ctx: CanvasRenderingContext2D, env: FrameEnv, g: Geom, d: D, P: Painter): void;
}

/** A scene that draws both halves (the original attic and cabin). */
export type WindowPack<D> = ViewPack<D> & RoomPack<D>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the renderer only passes a pack's data back to that pack
export type AnyView = ViewPack<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoom = RoomPack<any>;
