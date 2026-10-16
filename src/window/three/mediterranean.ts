/** "Mediterranean": thick whitewashed walls, a tall window with blue louvred shutters folded open, a rustic table
 *  with lemons, a blue-and-white jug of flowers and a linen runner, a potted olive tree and an iron lantern.
 *  For warm, sunny places. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp } from "../util";
import { AlbumArt, box, candle, lathe, mat, shell, sideWindows, solid, turntable, windowFrame, worldUV } from "./kit";
import { rgb, type Design } from "./room3d";
import { blueware, fabric, louvres, plaster, tiles, toTexture, wood } from "./textures";

const opening = { w: 1.2, h: 1.6, sill: 0.95, depth: 0.55 };
const BLUE: [number, number, number] = [46, 92, 140];

export const mediterranean: Design = {
  id: "mediterranean",
  name: "Mediterranean",
  opening,
  eye: 1.38,
  span: { w: 3.6, h: 2.5 },

  build(scene) {
    const wall = mat([255, 255, 255], { map: toTexture(plaster([246, 242, 234], 17), [1, 1]), roughness: 1 });
    const floor = mat([255, 255, 255], { map: toTexture(tiles(), [1, 1]), roughness: 0.75 });
    shell(scene, opening, { w: 5.4, h: 2.9, d: 10 }, wall, floor, mat([238, 234, 226], { roughness: 1 }), { wall: 1.8, floor: 1.6 });
    sideWindows(scene, 2.6, { z0: 0.6, z1: 2.4, y0: 0.9, y1: 2.6 }, 2.9, 14);
    // Ceiling beams.
    const beam = mat([255, 255, 255], { map: toTexture(wood([112, 80, 52], 33, 0, 512, 128), [1, 1]), roughness: 0.8 });
    for (let i = 0; i < 6; i++) box(scene, 5.4, 0.14, 0.12, beam, 0, 2.83, 0.4 + i * 0.7);

    // A slim blue frame and shutters folded back against the wall.
    const paint = mat(BLUE, { roughness: 0.55 });
    windowFrame(scene, opening, paint, 0.45, 0.045, 2, 3);
    const slats = mat([255, 255, 255], { map: toTexture(louvres(BLUE)), roughness: 0.6 });
    for (const side of [-1, 1]) {
      const w = opening.w / 2, x = side * (opening.w / 2 + w / 2 + 0.03), cy = opening.sill + opening.h / 2;
      box(scene, w, opening.h, 0.03, [paint, paint, paint, paint, slats, paint], x, cy, 0.03);
      for (const dx of [-w / 2 + 0.02, w / 2 - 0.02]) box(scene, 0.04, opening.h, 0.035, paint, x + dx, cy, 0.035);
      for (const dy of [-opening.h / 2 + 0.03, 0, opening.h / 2 - 0.03]) box(scene, w, 0.05, 0.035, paint, x, cy + dy, 0.035);
    }
    // A deep tiled sill.
    worldUV(box(scene, opening.w + 0.04, 0.03, opening.depth, mat([255, 255, 255], { map: toTexture(tiles(3, 42), [1, 1]), roughness: 0.7 }), 0, opening.sill - 0.015, -opening.depth / 2 + 0.02), 0.6);

    // A rustic table.
    const oak = mat([255, 255, 255], { map: toTexture(wood([176, 130, 86], 34)), roughness: 0.7 });
    const top = 0.78, W = 1.7, D = 0.6, z = D / 2 + 0.05;
    worldUV(box(scene, W, 0.07, D, oak, 0, top - 0.035, z), 1.2);
    for (const [x, zz] of [[-W / 2 + 0.08, z - D / 2 + 0.08], [W / 2 - 0.08, z - D / 2 + 0.08], [-W / 2 + 0.08, z + D / 2 - 0.08], [W / 2 - 0.08, z + D / 2 - 0.08]] as const)
      box(scene, 0.08, top - 0.07, 0.08, oak, x, (top - 0.07) / 2, zz);
    box(scene, 0.42, 0.004, D + 0.12, mat([255, 255, 255], { map: toTexture(fabric([236, 230, 216], 35), [2, 2]), roughness: 1 }), -0.15, top + 0.002, z);

    // Lemons in a bowl.
    const bowl = mat([226, 214, 190], { roughness: 0.45 });
    lathe(scene, [[0, 0], [0.07, 0], [0.13, 0.05], [0.16, 0.09], [0.15, 0.09], [0.12, 0.05], [0, 0.012]], bowl, -0.5, top, z + 0.02);
    const lemon = mat([236, 196, 52], { roughness: 0.5 });
    for (const [dx, dy, dz, r] of [[-0.05, 0.07, 0.02, 0], [0.05, 0.07, -0.02, 1], [0.0, 0.08, 0.06, 2], [0.02, 0.12, 0.0, 3], [-0.07, 0.09, -0.05, 4]] as const) {
      const l = solid(scene, new THREE.SphereGeometry(0.045, 20, 14), lemon, -0.5 + dx, top + dy, z + 0.02 + dz);
      l.scale.set(1, 0.85, 1.25);
      l.rotation.y = r;
    }
    // A blue-and-white jug of white flowers.
    const jx = 0.15;
    lathe(scene, [[0, 0], [0.06, 0], [0.085, 0.07], [0.08, 0.15], [0.05, 0.22], [0.055, 0.26], [0, 0.26]], mat([255, 255, 255], { map: toTexture(blueware()), roughness: 0.3 }), jx, top, z - 0.05);
    const stem = mat([86, 112, 64], { roughness: 0.8 });
    const petal = mat([248, 246, 238], { roughness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, lean = 0.25 + (i % 3) * 0.1, len = 0.32 + (i % 4) * 0.05;
      const s = solid(scene, new THREE.CylinderGeometry(0.003, 0.003, len, 5), stem, jx + Math.sin(a) * lean * len * 0.5, top + 0.24 + Math.cos(lean) * len * 0.5, z - 0.05 + Math.cos(a) * lean * len * 0.5);
      s.rotation.set(Math.cos(a) * lean, 0, -Math.sin(a) * lean);
      const head = solid(scene, new THREE.SphereGeometry(0.03, 12, 8), petal, jx + Math.sin(a) * lean * len, top + 0.24 + Math.cos(lean) * len, z - 0.05 + Math.cos(a) * lean * len);
      head.scale.y = 0.55;
    }
    // A candle in a glass and an open book.
    const flame = candle(scene, 0.55, top, z + 0.05, 0.09, 0.035);
    solid(scene, new THREE.CylinderGeometry(0.06, 0.055, 0.16, 24, 1, true), new THREE.MeshStandardMaterial({ color: rgb([240, 240, 236]), roughness: 0.05, transparent: true, opacity: 0.22 }), 0.55, top + 0.08, z + 0.05).castShadow = false;
    const page = mat([244, 238, 224], { roughness: 0.9 });
    for (const side of [-1, 1]) {
      const p = box(scene, 0.15, 0.01, 0.21, page, 0.6 + side * 0.075, top + 0.012, z - 0.12);
      p.rotation.z = side * -0.06;
    }

    // A potted olive tree on the right.
    const ox = 1.55, oz = 0.45;
    lathe(scene, [[0, 0], [0.16, 0], [0.2, 0.36], [0.22, 0.4], [0, 0.4]], mat([178, 98, 64], { roughness: 0.85 }), ox, 0, oz);
    const trunk = mat([110, 96, 80], { roughness: 1 });
    const t1 = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.38, 0), new THREE.Vector3(0.04, 0.8, 0), new THREE.Vector3(-0.03, 1.2, 0.02), new THREE.Vector3(0.02, 1.45, 0)]);
    solid(scene, new THREE.TubeGeometry(t1, 20, 0.03, 8), trunk, ox, 0, oz);
    // Olive leaves: narrow, silvery, in loose sprays.
    const leafGeo = new THREE.SphereGeometry(0.03, 6, 4);
    leafGeo.scale(1, 0.12, 0.22);
    const leafMats = [mat([122, 138, 98], { roughness: 0.75 }), mat([150, 164, 128], { roughness: 0.6 })];
    const sprays = new THREE.Group();
    sprays.position.set(ox, 0, oz);
    scene.add(sprays);
    for (let i = 0; i < 360; i++) {
      const a = i * 2.39996, r = 0.05 + ((i * 7) % 23) / 23 * 0.32, y = 1.1 + ((i * 13) % 29) / 29 * 0.55 - r * 0.3;
      const leaf = new THREE.Mesh(leafGeo, leafMats[i % 2]!);
      leaf.position.set(Math.sin(a) * r, y, Math.cos(a) * r * 0.7);
      leaf.rotation.set(Math.sin(i) * 1.2, a, Math.cos(i * 1.7) * 0.9);
      leaf.castShadow = true;
      sprays.add(leaf);
    }
    for (const [a, l] of [[0.6, 0.35], [2.4, 0.3], [4.1, 0.32]] as const) {
      const twig = solid(scene, new THREE.CylinderGeometry(0.008, 0.014, l, 6), trunk, ox + Math.sin(a) * l * 0.4, 1.3, oz + Math.cos(a) * l * 0.3);
      twig.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
    }

    // An iron lantern on the left wall: the evening light.
    const lx = -1.35, ly = 1.75;
    const iron = mat([34, 32, 30], { roughness: 0.5, metalness: 0.6 });
    box(scene, 0.03, 0.03, 0.18, iron, lx, ly + 0.2, 0.09).castShadow = false;
    const glass = new THREE.MeshStandardMaterial({ color: rgb([255, 236, 210]), roughness: 0.2, transparent: true, opacity: 0.5, emissive: rgb([255, 180, 100]), emissiveIntensity: 0 });
    solid(scene, new THREE.CylinderGeometry(0.06, 0.07, 0.2, 6, 1, true), glass, lx, ly, 0.18).castShadow = false;
    solid(scene, new THREE.ConeGeometry(0.09, 0.08, 6), iron, lx, ly + 0.14, 0.18).castShadow = false;
    box(scene, 0.15, 0.015, 0.15, iron, lx, ly - 0.105, 0.18).castShadow = false;
    const bulb = new THREE.PointLight(0xffb070, 0, 0, 2);
    bulb.position.set(lx, ly, 0.22);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(1024, 1024);
    bulb.shadow.radius = 3;
    bulb.shadow.camera.near = 0.12;
    scene.add(bulb);

    // A record player on the table while music plays.
    const art = new AlbumArt();
    const deck = turntable(scene, art, mat([226, 218, 202], { roughness: 0.45 }), true);
    deck.group.position.set(-0.05, top, z + 0.05);

    const lampOn = (env: Environment) => clamp(env.lamp * 1.15);
    return {
      update(env) {
        const on = lampOn(env);
        bulb.intensity = 1.3 * on;
        bulb.visible = on > 0.01;
        glass.emissiveIntensity = 0.8 * on;
        flame.flame.visible = on > 0.05;
        return deck.update(env);
      },
      signature: (env) => [lampOn(env)],
      glows: [
        { at: new THREE.Vector3(lx, ly, 0.2), radius: 0.55, color: () => [255, 170, 90], level: (env) => lampOn(env) * 0.75 },
        { at: flame.at, radius: 0.2, color: () => [255, 176, 96], level: (env, t) => lampOn(env) * 0.7 * (0.85 + 0.15 * Math.sin(t * 8)) },
      ],
    };
  },
};
