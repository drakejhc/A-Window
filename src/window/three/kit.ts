/** Building blocks shared by the 3D rooms: walls with a window opening, simple furniture parts, and props. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { Environment } from "../environment";
import { rgb, type Opening } from "./room3d";
import { defaultSleeve, grooves, leaf, toTexture } from "./textures";
import type { RGB } from "../util";

export const mat = (c: RGB, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: rgb(c), roughness: 0.7, ...o });

/** Adds a mesh that casts and receives shadows. */
export function solid(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export const box = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) =>
  solid(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z);

export const rounded = (parent: THREE.Object3D, w: number, h: number, d: number, r: number, m: THREE.Material, x: number, y: number, z: number) =>
  solid(parent, new RoundedBoxGeometry(w, h, d, 3, r), m, x, y, z);

/** A lathe from a profile of [radius, height] points. */
export const lathe = (parent: THREE.Object3D, profile: [number, number][], m: THREE.Material, x: number, y: number, z: number, seg = 48) =>
  solid(parent, new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), seg), m, x, y, z);

/** The shell of the room: a back wall with the window opening cut out, side walls, floor and ceiling. */
export function shell(scene: THREE.Scene, o: Opening, size: { w: number; h: number; d: number }, wall: THREE.Material, floor: THREE.Material, ceiling: THREE.Material) {
  const { w, h, d } = size, T = o.depth, z = -T / 2, half = w / 2, x0 = -o.w / 2, x1 = o.w / 2, top = o.sill + o.h;
  box(scene, half + x0, h, T, wall, (-half + x0) / 2, h / 2, z);
  box(scene, half - x1, h, T, wall, (half + x1) / 2, h / 2, z);
  box(scene, o.w, o.sill, T, wall, 0, o.sill / 2, z);
  box(scene, o.w, h - top, T, wall, 0, (h + top) / 2, z);
  const side = new THREE.PlaneGeometry(d, h);
  // The side walls are never in frame and don't block light: sunlight from the side comes through `sideWindow`.
  const l = solid(scene, side, wall, -half, h / 2, d / 2);
  l.rotation.y = Math.PI / 2;
  const r = solid(scene, side, wall, half, h / 2, d / 2);
  r.rotation.y = -Math.PI / 2;
  l.castShadow = r.castShadow = false;
  const f = solid(scene, new THREE.PlaneGeometry(w, d), floor, 0, 0, d / 2);
  f.rotation.x = -Math.PI / 2;
  const c = solid(scene, new THREE.PlaneGeometry(w, d), ceiling, 0, h, d / 2);
  c.rotation.x = Math.PI / 2;
}

/** A window frame with a cross of glazing bars set into the opening, `inset` from the room side. */
export function windowFrame(scene: THREE.Scene, o: Opening, m: THREE.Material, inset: number, bar = 0.05) {
  const z = -inset, top = o.sill + o.h, cy = o.sill + o.h * 0.56;
  box(scene, bar, o.h, 0.07, m, -o.w / 2 + bar / 2, o.sill + o.h / 2, z);
  box(scene, bar, o.h, 0.07, m, o.w / 2 - bar / 2, o.sill + o.h / 2, z);
  box(scene, o.w, bar, 0.07, m, 0, top - bar / 2, z);
  box(scene, o.w, bar, 0.07, m, 0, o.sill + bar / 2, z);
  box(scene, bar * 0.7, o.h, 0.05, m, 0, o.sill + o.h / 2, z);
  box(scene, o.w, bar * 0.7, 0.05, m, 0, cy, z);
}

/** Venetian blinds, part-lowered, whose slats throw striped shadows when the sun comes in. */
export function blinds(scene: THREE.Scene, o: Opening, m: THREE.Material, slats: number, z: number) {
  const top = o.sill + o.h, w = o.w - 0.03;
  box(scene, w, 0.04, 0.055, m, 0, top - 0.02, z);
  const geo = new THREE.BoxGeometry(w, 0.003, 0.048);
  const inst = new THREE.InstancedMesh(geo, m, slats);
  inst.castShadow = inst.receiveShadow = true;
  const q = new THREE.Object3D();
  for (let i = 0; i < slats; i++) {
    q.position.set(0, top - 0.065 - i * 0.042, z);
    q.rotation.set(0.42, 0, 0);
    q.updateMatrix();
    inst.setMatrixAt(i, q.matrix);
  }
  scene.add(inst);
  const bottom = top - 0.065 - slats * 0.042;
  box(scene, w, 0.014, 0.05, m, 0, bottom, z);
  const cord = mat([228, 220, 204]);
  for (const x of [-w * 0.3, w * 0.3]) box(scene, 0.004, top - bottom, 0.004, cord, x, (top + bottom) / 2, z + 0.026);
}

/** An unseen window in each side wall, with blinds, so low sun throws striped light across the back wall the
 *  way it does in a corner room. Only its shadow matters, so it's drawn into the shadow map alone. */
export function sideWindows(scene: THREE.Scene, x: number, win: { z0: number; z1: number; y0: number; y1: number }, h: number, slats: number) {
  const m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.x = side * x;
    scene.add(g);
    const block = (z0: number, z1: number, y0: number, y1: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, y1 - y0, z1 - z0), m);
      b.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
      b.castShadow = true;
      g.add(b);
    };
    block(-0.3, win.z0, -0.2, h + 0.2);
    block(win.z1, 9, -0.2, h + 0.2);
    block(win.z0, win.z1, -0.2, win.y0);
    block(win.z0, win.z1, win.y1, h + 0.2);
    block(win.z0, win.z1, (win.y0 + win.y1) / 2 - 0.02, (win.y0 + win.y1) / 2 + 0.02);
    const geo = new THREE.BoxGeometry(0.05, 0.004, win.z1 - win.z0);
    for (let i = 0; i < slats; i++) {
      const s = new THREE.Mesh(geo, m);
      s.position.set(0, win.y1 - 0.05 - i * ((win.y1 - win.y0) / slats), (win.z0 + win.z1) / 2);
      s.rotation.z = side * 0.5;
      s.scale.y = 5;
      s.castShadow = true;
      g.add(s);
    }
  }
}

/** Texture holder for album art that follows the music. */
export class AlbumArt {
  readonly fallback = toTexture(defaultSleeve());
  tex: THREE.Texture = this.fallback;
  private src: CanvasImageSource | null = null;
  private users: THREE.MeshStandardMaterial[] = [];
  use(m: THREE.MeshStandardMaterial) {
    m.map = this.tex;
    this.users.push(m);
    return m;
  }
  update(art: CanvasImageSource | null) {
    if (art === this.src) return;
    this.src = art;
    let t: THREE.Texture = this.fallback;
    if (art) {
      t = new THREE.Texture(art as THREE.Texture["image"]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    }
    if (this.tex !== this.fallback && this.tex !== t) this.tex.dispose();
    this.tex = t;
    for (const m of this.users) {
      m.map = t;
      m.needsUpdate = true;
    }
  }
}

/** A record player. The record spins and the arm swings over while music plays. Origin: centre of its base. */
export function turntable(parent: THREE.Object3D, art: AlbumArt, plinth: THREE.Material) {
  const g = new THREE.Group();
  parent.add(g);
  const black = mat([16, 16, 18], { roughness: 0.5 });
  const metal = mat([200, 200, 202], { metalness: 0.9, roughness: 0.28 });
  for (const [x, z] of [[-0.19, -0.14], [0.19, -0.14], [-0.19, 0.14], [0.19, 0.14]] as const) solid(g, new THREE.CylinderGeometry(0.02, 0.022, 0.012, 24), black, x, 0.006, z);
  rounded(g, 0.46, 0.085, 0.36, 0.01, plinth, 0, 0.054, 0);
  const top = 0.0965;
  const px = -0.04;
  solid(g, new THREE.CylinderGeometry(0.15, 0.15, 0.016, 96), metal, px, top + 0.008, 0);
  const record = new THREE.Group();
  record.position.set(px, top + 0.016, 0);
  g.add(record);
  const grooveTex = toTexture(grooves());
  const vinyl = mat([255, 255, 255], { map: grooveTex, roughness: 0.32, metalness: 0.15 });
  solid(record, new THREE.CylinderGeometry(0.149, 0.149, 0.003, 128), [black, vinyl, black], 0, 0.0015, 0);
  const label = solid(record, new THREE.CircleGeometry(0.048, 64), art.use(mat([255, 255, 255], { roughness: 0.6 })), 0, 0.0031, 0);
  label.rotation.x = -Math.PI / 2;
  solid(record, new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 12), metal, 0, 0.008, 0);
  // Tonearm on its pivot at the back right.
  const pivot = new THREE.Group();
  pivot.position.set(0.17, top, -0.1);
  g.add(pivot);
  solid(pivot, new THREE.CylinderGeometry(0.026, 0.03, 0.03, 32), black, 0, 0.015, 0);
  solid(pivot, new THREE.CylinderGeometry(0.018, 0.018, 0.03, 32), metal, 0, 0.042, -0.05).rotation.x = Math.PI / 2;
  const arm = solid(pivot, new THREE.CylinderGeometry(0.0042, 0.0042, 0.26, 12), metal, 0, 0.045, 0.1);
  arm.rotation.x = Math.PI / 2;
  box(pivot, 0.022, 0.008, 0.04, black, -0.006, 0.042, 0.235);
  box(pivot, 0.012, 0.012, 0.018, mat([200, 90, 40], { roughness: 0.4 }), -0.006, 0.033, 0.245);
  box(pivot, 0.025, 0.006, 0.05, metal, 0.04, 0.025, 0.06);
  // Controls.
  solid(g, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 24), metal, -0.18, top + 0.006, 0.14);
  solid(g, new THREE.CylinderGeometry(0.01, 0.01, 0.01, 24), black, -0.14, top + 0.005, 0.15);
  return {
    group: g,
    update(env: Environment) {
      const m = env.music;
      art.update(m.art);
      record.rotation.y = -m.spin;
      pivot.rotation.y = -0.5 * m.arm;
      pivot.position.y = top + 0.004 * Math.sin(Math.PI * m.arm);
    },
  };
}

/** A snake plant: upright banded blades in a pot. Origin: the bottom of the pot. */
export function snakePlant(parent: THREE.Object3D, pot: THREE.Material, seed = 1) {
  const g = new THREE.Group();
  parent.add(g);
  solid(g, new THREE.CylinderGeometry(0.1, 0.082, 0.21, 48), pot, 0, 0.105, 0);
  solid(g, new THREE.CylinderGeometry(0.094, 0.094, 0.01, 48), mat([48, 36, 28], { roughness: 1 }), 0, 0.2, 0);
  const tex = toTexture(leaf());
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide });
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 10; i++) {
    const len = 0.42 + rand() * 0.38, wid = 0.032 + rand() * 0.022;
    const shape = new THREE.Shape();
    shape.moveTo(-wid * 0.5, 0);
    shape.bezierCurveTo(-wid, len * 0.3, -wid * 0.8, len * 0.75, 0, len);
    shape.bezierCurveTo(wid * 0.8, len * 0.75, wid, len * 0.3, wid * 0.5, 0);
    const geo = new THREE.ShapeGeometry(shape, 16);
    const pos = geo.attributes.position!, uv = geo.attributes.uv!, bend = (rand() - 0.5) * 0.25, cup = 0.012;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), v = y / len;
      uv.setXY(k, (x + wid) / (2 * wid), v);
      pos.setZ(k, bend * v * v * len + cup * (1 - (x / wid) ** 2));
    }
    geo.computeVertexNormals();
    const blade = solid(g, geo, m, (rand() - 0.5) * 0.08, 0.2, (rand() - 0.5) * 0.08);
    blade.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI, (rand() - 0.5) * 0.3);
  }
  return g;
}

/** A row or stack of books. `upright` stands them on a shelf; otherwise they lie in a stack. */
export function books(parent: THREE.Object3D, list: { w: number; h: number; d: number; c: RGB }[], x: number, y: number, z: number, upright: boolean) {
  const pages = mat([236, 228, 210], { roughness: 0.9 });
  let at = 0;
  for (const b of list) {
    const cover = mat(b.c, { roughness: 0.65 });
    if (upright) {
      box(parent, b.w, b.h, b.d, cover, x + at + b.w / 2, y + b.h / 2, z);
      box(parent, b.w - 0.004, b.h - 0.006, b.d + 0.002, pages, x + at + b.w / 2, y + b.h / 2, z + 0.003);
      at += b.w + 0.002;
    } else {
      box(parent, b.w, b.h, b.d, cover, x, y + at + b.h / 2, z);
      box(parent, b.w - 0.008, b.h - 0.004, b.d + 0.002, pages, x + 0.006, y + at + b.h / 2, z);
      at += b.h;
    }
  }
  return at;
}

/** A mug, with a handle. Origin: its base. */
export function mug(parent: THREE.Object3D, m: THREE.Material, x: number, y: number, z: number) {
  lathe(parent, [[0, 0], [0.038, 0], [0.041, 0.004], [0.042, 0.09], [0.038, 0.09], [0.037, 0.008], [0, 0.008]], m, x, y, z);
  const h = solid(parent, new THREE.TorusGeometry(0.024, 0.006, 12, 24, Math.PI), m, x + 0.042, y + 0.046, z);
  h.rotation.z = -Math.PI / 2;
  solid(parent, new THREE.CylinderGeometry(0.036, 0.036, 0.002, 32), mat([60, 36, 22], { roughness: 0.2 }), x, y + 0.078, z);
}
