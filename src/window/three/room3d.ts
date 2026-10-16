/** A rendered 3D room around the live window.
 *
 *  Three stacked canvases keep it cheap. At the back, the ordinary 2D renderer draws the view outside at the
 *  screen position of the window (it already runs at 30 fps and costs little). In the middle, the 3D room renders
 *  with a transparent hole where the glass is, and only when something in it changes: the light, the pointer, or a
 *  spinning record. On top, a small 2D layer draws the glow of lamps, candles and fire, which can flicker every
 *  frame without touching the 3D scene. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

import type { Environment } from "../environment";
import { Renderer } from "../renderer";
import type { AnyRoom, AnyView } from "../types";
import { clamp, mixRGB, smooth, type RGB } from "../util";

/** The window opening in the back wall (the plane z = 0), centred on x = 0. */
export type Opening = { w: number; h: number; sill: number; depth: number };
/** A soft light drawn over the render: `level` (0..1) may change every frame, e.g. to flicker. */
export type Glow = { at: THREE.Vector3; radius: number; color: (env: Environment) => RGB; level: (env: Environment, t: number) => number };
export type RoomBuild = {
  /** Moves things for this frame; returns true while something is moving and needs the room redrawn. */
  update(env: Environment, dt: number): boolean;
  glows?: Glow[];
  /** Slow changes that should redraw the room (beyond the shared sun and sky), e.g. the lamp's level. */
  signature?: (env: Environment) => number[];
};
export type Design = {
  id: string;
  name: string;
  opening: Opening;
  /** The height the camera sits at and looks along, so verticals stay vertical. */
  eye: number;
  /** How much of the room should fit across the screen at the window's distance, in metres. */
  span: { w: number; h: number };
  /** The height the camera looks at on the window wall; below `eye` tilts the view down. Defaults to `eye`. */
  look?: number;
  /** Moves the camera sideways (`x`) and turns it toward `lookX` on the window wall, to bring a side wall into view. */
  turn?: { x: number; lookX: number };
  /** "illustrated" rooms use flat, toon-shaded materials, so the window also lights them with a plain fill light. */
  style?: "realistic" | "illustrated";
  /** Whether low sun slants in from unseen side windows (off for rooms whose side walls are in view). */
  sideSun?: boolean;
  build(scene: THREE.Scene): RoomBuild;
};

export const rgb = (c: RGB) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/** How far behind the wall the view sits, for a little parallax as the camera moves. */
const VIEW_DEPTH = 1.6;
const MOTION_FPS = 24;
/** Light changes slowly; redrawing for it twice a second is plenty. */
const LIGHT_INTERVAL = 0.5;

export type Layers = { view: HTMLCanvasElement; room: HTMLCanvasElement; glow: HTMLCanvasElement };

export class Room3D {
  /** How many times the 3D room has been drawn, for tests and tuning. */
  renders = 0;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  private base = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  private view: Renderer;
  private glowCtx: CanvasRenderingContext2D;
  private sun = new THREE.DirectionalLight(0xffffff, 0);
  /** The same sun coming in through unseen side windows, slanting across the back wall. */
  private sideSun = new THREE.DirectionalLight(0xffffff, 0);
  private skyLight: THREE.RectAreaLight;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6b5440, 0.3);
  /** Window light for illustrated rooms, whose toon materials ignore the sky's area light. */
  private fill = new THREE.DirectionalLight(0xffffff, 0);
  private room: RoomBuild;
  private t = 0;
  private sinceRender = 99;
  private sinceGlow = 99;
  private dirty = true;
  private lastSig: number[] = [];
  private dist = 4;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private size = { W: 1, H: 1 };
  private tmp = new THREE.Vector3();

  constructor(
    private layers: Layers,
    private design: Design,
    viewPack: AnyView,
    private opts: { align: number; maxDpr?: number },
  ) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: layers.room, antialias: false, alpha: true, powerPreference: "high-performance" }));
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    RectAreaLightUniformsLib.init();

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.view = new Renderer(layers.view, viewPack, viewPack as unknown as AnyRoom, { framed: false, parallax: 0.15, maxFps: 30, maxDpr: 1.5 });
    this.glowCtx = layers.glow.getContext("2d")!;

    const o = design.opening;
    for (const [light, size] of [[this.sun, 3.4], [this.sideSun, 4]] as const) {
      light.castShadow = true;
      light.shadow.mapSize.set(2048, 2048);
      Object.assign(light.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 32 });
      light.shadow.bias = -0.0004;
      light.shadow.normalBias = 0.03;
      light.shadow.radius = 4;
      this.scene.add(light, light.target);
    }
    this.sun.target.position.set(0, 1, 1.4);
    this.sideSun.target.position.set(0, 1.2, 0.6);
    this.skyLight = new THREE.RectAreaLight(0xffffff, 0, o.w, o.h);
    this.skyLight.position.set(0, o.sill + o.h / 2, -o.depth);
    this.skyLight.lookAt(0, o.sill + o.h / 2, 5);
    this.scene.add(this.skyLight, this.hemi);
    if (design.style === "illustrated") {
      this.fill.position.set(0, o.sill + o.h, -4);
      this.fill.target.position.set(0, o.sill * 0.6, 3);
      this.scene.add(this.fill, this.fill.target);
    }

    this.room = design.build(this.scene);

    // Multisampled, so edges stay smooth through the ambient occlusion.
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera, null, new THREE.Color(0x000000), 0));
    const ao = new GTAOPass(this.scene, this.camera, 512, 512);
    ao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1.2, thickness: 1, scale: 1.1, samples: 12 });
    ao.blendIntensity = 0.85;
    this.composer.addPass(ao);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  setView(view: AnyView) {
    this.view.setScene(view, view as unknown as AnyRoom);
  }

  setAlign(align: number) {
    this.opts = { ...this.opts, align };
    this.resize();
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  resize() {
    const rect = this.layers.room.getBoundingClientRect();
    const W = Math.max(1, rect.width), H = Math.max(1, rect.height);
    const dpr = Math.min(this.opts.maxDpr ?? 1.25, window.devicePixelRatio || 1);
    this.size = { W, H };
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(W, H);
    this.layers.glow.width = Math.round(W);
    this.layers.glow.height = Math.round(H);

    const { span, opening: o, eye } = this.design;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)), aspect = W / H;
    // Close enough that the window fills the frame, far enough to fit the room's span on either axis.
    this.dist = Math.max(span.h / 2 / tan, Math.min(span.w, aspect < 1 ? o.w + 0.5 : span.w) / 2 / (tan * aspect));
    for (const cam of [this.camera, this.base]) {
      cam.aspect = aspect;
      // Slide the window sideways without turning the camera (the side-sheet layout).
      const shift = (0.5 - this.opts.align) * W;
      if (Math.abs(shift) > 0.5) cam.setViewOffset(W, H, shift, 0, W, H);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
    const turn = this.design.turn ?? { x: 0, lookX: 0 };
    this.base.position.set(turn.x, eye, this.dist);
    this.base.lookAt(turn.lookX, this.design.look ?? eye, 0);
    this.base.updateMatrixWorld();

    // The view canvas covers what the opening can show as the camera moves a little.
    const k = (this.dist + VIEW_DEPTH) / this.dist;
    const pw = o.w * k + 0.9, ph = o.h * k + 0.6, cy = o.sill + o.h / 2;
    const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => this.project(this.base, (sx! * pw) / 2, cy + (sy! * ph) / 2, -VIEW_DEPTH));
    const a = { x: Math.min(...corners.map((c) => c.x)), y: Math.min(...corners.map((c) => c.y)) };
    const b = { x: Math.max(...corners.map((c) => c.x)), y: Math.max(...corners.map((c) => c.y)) };
    Object.assign(this.layers.view.style, { left: `${a.x}px`, top: `${a.y}px`, width: `${b.x - a.x}px`, height: `${b.y - a.y}px` });
    this.view.resize();
    this.dirty = true;
  }

  private project(cam: THREE.Camera, x: number, y: number, z: number) {
    const v = this.tmp.set(x, y, z).project(cam);
    return { x: ((v.x + 1) / 2) * this.size.W, y: ((1 - v.y) / 2) * this.size.H };
  }

  tick(env: Environment, dt: number) {
    this.t += dt;
    this.sinceRender += dt;
    this.sinceGlow += dt;
    this.view.tick(env, dt);

    const p = this.pointer, k = 1 - Math.exp(-dt * 2.5);
    const moving = Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) > 0.002;
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;

    const sig = this.light(env);
    for (const v of this.room.signature?.(env) ?? []) sig.push(v);
    const lightChanged = sig.length !== this.lastSig.length || sig.some((v, i) => Math.abs(v - this.lastSig[i]!) > 0.004);
    const animating = this.room.update(env, dt);

    const due = this.dirty || ((moving || animating) && this.sinceRender >= 1 / MOTION_FPS) || (lightChanged && this.sinceRender >= LIGHT_INTERVAL);
    if (due) {
      if (this.dirty || lightChanged) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastSig = sig;
      }
      this.render();
    }
    if (this.sinceGlow >= 1 / 30) this.drawGlows(env);
  }

  private render() {
    const { eye } = this.design, p = this.pointer;
    const turn = this.design.turn ?? { x: 0, lookX: 0 };
    this.camera.position.set(turn.x + p.x * 0.12, eye - p.y * 0.05, this.dist);
    this.camera.lookAt(turn.lookX + p.x * 0.03, this.design.look ?? eye, 0);
    this.camera.updateMatrixWorld();
    this.composer.render(this.sinceRender);
    this.renders++;
    this.sinceRender = 0;
    this.dirty = false;
    // Keep the view behind the glass in step with the camera: it sits further back, so it moves a little less.
    const o = this.design.opening, cy = o.sill + o.h / 2;
    const now = this.project(this.camera, 0, cy, -VIEW_DEPTH), was = this.project(this.base, 0, cy, -VIEW_DEPTH);
    this.layers.view.style.transform = `translate(${(now.x - was.x).toFixed(1)}px, ${(now.y - was.y).toFixed(1)}px)`;
  }

  private drawGlows(env: Environment) {
    this.sinceGlow = 0;
    const x = this.glowCtx, { W, H } = this.size;
    x.clearRect(0, 0, W, H);
    for (const g of this.room.glows ?? []) {
      const a = g.level(env, this.t);
      if (a < 0.01) continue;
      const c = this.project(this.camera, g.at.x, g.at.y, g.at.z), e = this.project(this.camera, g.at.x + g.radius, g.at.y, g.at.z);
      const r = Math.max(4, Math.abs(e.x - c.x)), [cr, cg, cb] = g.color(env).map((v) => v | 0);
      const grd = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      grd.addColorStop(0, `rgba(${cr},${cg},${cb},${0.5 * a})`);
      grd.addColorStop(0.3, `rgba(${cr},${cg},${cb},${0.16 * a})`);
      grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      x.fillStyle = grd;
      x.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    }
  }

  /** Sets the sun, sky and fill for the moment and returns a summary, so the room is redrawn only when it changes. */
  private light(env: Environment) {
    const day = clamp((env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
    const sky = env.sky.bottom;
    this.hemi.color.copy(rgb(mixRGB(sky, [255, 255, 255], 0.4)));
    this.hemi.intensity = 0.04 + 0.32 * day;
    this.skyLight.color.copy(rgb(mixRGB(sky, [255, 250, 240], 0.45)));
    this.skyLight.intensity = 0.2 + 3.2 * day * (1 - 0.25 * env.fog);
    this.scene.environmentIntensity = 0.02 + 0.22 * day;

    // The sun, if it's up and on this side of the house. The window faces the equator, as in the 2D view.
    const facing = env.city.lat >= 0 ? 180 : 0;
    const rel = THREE.MathUtils.degToRad(((env.sunAz - facing + 540) % 360) - 180);
    const alt = THREE.MathUtils.degToRad(Math.max(env.sunAlt, 0.5));
    const facingSun = 1 - smooth(1.35, 1.5, Math.abs(rel));
    const clear = clamp(1 - env.cloud * 1.15) * (1 - env.rain * 0.9) * (1 - env.fog * 0.8);
    const strength = smooth(-1, 8, env.sunAlt) * clear * facingSun;
    this.sun.visible = strength > 0.01;
    this.sun.intensity = 7 * strength;
    this.sun.color.copy(rgb(mixRGB([255, 228, 190], [255, 150, 80], 1 - smooth(3, 30, env.sunAlt))));
    const dir = new THREE.Vector3(Math.sin(rel) * Math.cos(alt), Math.sin(alt), -Math.cos(rel) * Math.cos(alt));
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 14);
    // Through the side window on the sun's side, heading back across the room toward the window wall.
    const side = rel >= 0 ? 1 : -1, lift = Math.tan(Math.min(alt, THREE.MathUtils.degToRad(48)));
    const sideDir = new THREE.Vector3(side * 0.82, lift * 0.98, 0.58).normalize();
    const sideStrength = smooth(1, 10, env.sunAlt) * clear * (0.4 + 0.6 * smooth(0.05, 0.7, Math.abs(rel)));
    this.sideSun.visible = sideStrength > 0.01 && this.design.sideSun !== false;
    this.sideSun.intensity = 7 * sideStrength;
    this.sideSun.color.copy(this.sun.color);
    this.sideSun.position.copy(this.sideSun.target.position).addScaledVector(sideDir, 14);

    if (this.design.style === "illustrated") {
      // Daylight from the window by day; a cool, moonlit blue by night, as in a lofi illustration.
      this.fill.color.copy(rgb(mixRGB([96, 110, 190], mixRGB(sky, [255, 255, 255], 0.5), day)));
      this.fill.intensity = 0.9 + 1.4 * day;
      this.hemi.color.copy(rgb(mixRGB([90, 96, 170], mixRGB(sky, [255, 255, 255], 0.4), day)));
      this.hemi.groundColor.copy(rgb(mixRGB([70, 46, 70], [120, 96, 80], day)));
      this.hemi.intensity = 0.55 + 0.35 * day;
    }
    return [day, sky[0] / 255, sky[1] / 255, sky[2] / 255, strength, sideStrength, dir.x, dir.y, dir.z, side];
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
