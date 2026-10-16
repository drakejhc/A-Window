/** A rendered 3D room around the live window. The view outside is the ordinary 2D window renderer drawing to a
 *  canvas that becomes a texture behind the glass; the room is lit by the same sun, sky and lamp, so sunlight
 *  through the window throws the frame's shadow across the room as the real sun moves. */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import type { Environment } from "../environment";
import { Renderer } from "../renderer";
import type { AnyRoom, AnyView } from "../types";
import { clamp, mixRGB, smooth, type RGB } from "../util";

/** The window opening in the back wall (the plane z = 0), centred on x = 0. */
export type Opening = { w: number; h: number; sill: number; depth: number };
export type RoomBuild = { update(env: Environment, dt: number): void };
export type Design = {
  id: string;
  opening: Opening;
  /** The height the camera sits at and looks along, so verticals stay vertical. */
  eye: number;
  /** How much of the room should fit across the screen at the window's distance, in metres. */
  span: { w: number; h: number };
  build(scene: THREE.Scene): RoomBuild;
};

export const rgb = (c: RGB) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);

/** Behind the wall: far enough for a little parallax as the camera drifts. */
const VIEW_DEPTH = 1.6;

export class Room3D {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private ao: GTAOPass;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  private viewCanvas = document.createElement("canvas");
  /** The view, softened a little as if the camera were focused on the room. */
  private softCanvas = document.createElement("canvas");
  private view: Renderer;
  private viewTex: THREE.CanvasTexture;
  private viewPlane: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xffffff, 0);
  /** The same sun coming in through the side windows, slanting across the back wall. */
  private sideSun = new THREE.DirectionalLight(0xffffff, 0);
  private skyLight: THREE.RectAreaLight;
  private hemi = new THREE.HemisphereLight(0xffffff, 0x6b5440, 0.3);
  private room: RoomBuild;
  private pending = 0;
  private t = 0;
  private dist = 4;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private size = { W: 1, H: 1 };

  constructor(
    private canvas: HTMLCanvasElement,
    private design: Design,
    viewPack: AnyView,
    private opts: { align: number; maxFps?: number; maxDpr?: number },
  ) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    RectAreaLightUniformsLib.init();

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.background = new THREE.Color(0x000000);

    // The view: the 2D renderer in open mode, on a plane behind the opening.
    this.view = new Renderer(this.viewCanvas, viewPack, viewPack as unknown as AnyRoom, { framed: false, parallax: 0.15, maxFps: 30, maxDpr: 1, size: { width: 960, height: 760 } });
    this.viewTex = new THREE.CanvasTexture(this.softCanvas);
    this.viewTex.colorSpace = THREE.SRGBColorSpace;
    this.viewPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.viewTex, toneMapped: false }));
    this.scene.add(this.viewPlane);

    // Sun through the window, the sky's light filling the room, and a little bounce from everywhere.
    const o = design.opening;
    const sun = this.sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 2, far: 32 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = 3;
    sun.target.position.set(0, 1, 1.4);
    this.scene.add(sun, sun.target);
    const ss = this.sideSun;
    ss.castShadow = true;
    ss.shadow.mapSize.set(2048, 2048);
    Object.assign(ss.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 });
    ss.shadow.bias = -0.0004;
    ss.shadow.normalBias = 0.03;
    ss.shadow.radius = 4;
    ss.target.position.set(0, 1.2, 0.6);
    this.scene.add(ss, ss.target);
    this.skyLight = new THREE.RectAreaLight(0xffffff, 0, o.w, o.h);
    this.skyLight.position.set(0, o.sill + o.h / 2, -o.depth);
    this.skyLight.lookAt(0, o.sill + o.h / 2, 5);
    this.scene.add(this.skyLight, this.hemi);

    this.room = design.build(this.scene);

    // Multisampled, so edges stay smooth through the post-processing.
    this.composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new GTAOPass(this.scene, this.camera, 512, 512);
    this.ao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1.2, thickness: 1, scale: 1.1, samples: 16 });
    this.ao.blendIntensity = 0.85;
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.2, 0.5, 0.92);
    this.composer.addPass(this.bloom);
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
    const rect = this.canvas.getBoundingClientRect();
    const W = Math.max(1, rect.width), H = Math.max(1, rect.height);
    this.size = { W, H };
    const dpr = Math.min(this.opts.maxDpr ?? 1.5, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(W, H);
    const cam = this.camera, tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), aspect = W / H;
    cam.aspect = aspect;
    // Close enough that the window fills the frame, far enough to fit the room's span on either axis.
    const { span, opening: o } = this.design;
    this.dist = Math.max(span.h / 2 / tan, Math.min(span.w, aspect < 1 ? o.w + 0.5 : span.w) / 2 / (tan * aspect));
    // Slide the window sideways without turning the camera (the side-sheet layout).
    const shift = (0.5 - this.opts.align) * W;
    if (Math.abs(shift) > 0.5) cam.setViewOffset(W, H, shift, 0, W, H);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
    // The view plane covers what the opening can show from anywhere the camera drifts to.
    const k = (this.dist + VIEW_DEPTH) / this.dist;
    const pw = o.w * k + 1.2, ph = o.h * k + 0.8;
    this.viewPlane.scale.set(pw, ph, 1);
    this.viewPlane.position.set(0, o.sill + o.h / 2, -VIEW_DEPTH);
    const px = Math.round(Math.min(1400, Math.max(640, W * 0.7)));
    this.view.setSize(px, Math.round((px * ph) / pw));
  }

  tick(env: Environment, dt: number) {
    this.pending += dt;
    const min = 1 / (this.opts.maxFps ?? 30);
    if (this.pending < min) return;
    const step = Math.min(0.1, this.pending);
    this.pending = 0;
    this.t += step;

    this.view.tick(env, step);
    this.soften();

    const p = this.pointer, k = 1 - Math.exp(-step * 2);
    p.x += (p.tx - p.x) * k;
    p.y += (p.ty - p.y) * k;
    const eye = this.design.eye, t = this.t;
    this.camera.position.set(p.x * 0.12 + Math.sin(t * 0.13) * 0.02, eye - p.y * 0.05 + Math.sin(t * 0.21) * 0.01, this.dist);
    this.camera.lookAt(p.x * 0.03, eye, 0);

    this.light(env);
    this.room.update(env, step);
    this.composer.render(step);
  }

  private soften() {
    const src = this.viewCanvas, dst = this.softCanvas;
    if (dst.width !== src.width || dst.height !== src.height) {
      dst.width = src.width;
      dst.height = src.height;
      this.viewTex.dispose();
    }
    const x = dst.getContext("2d")!;
    x.filter = `blur(${(src.width / 900).toFixed(2)}px)`;
    x.drawImage(src, 0, 0);
    x.filter = "none";
    this.viewTex.needsUpdate = true;
  }

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
    this.sideSun.visible = sideStrength > 0.01;
    this.sideSun.intensity = 7 * sideStrength;
    this.sideSun.color.copy(this.sun.color);
    this.sideSun.position.copy(this.sideSun.target.position).addScaledVector(sideDir, 14);

    this.bloom.strength = 0.18 + 0.12 * env.night;
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
