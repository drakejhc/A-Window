/** "Listening room": a warm plaster room with a deep window and wooden blinds, a fluted walnut sideboard with a
 *  record player, a sleeve on a stand, a lamp, a snake plant and a print on the wall. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp, mixRGB } from "../util";
import { AlbumArt, blinds, books, box, lathe, mat, mug, rounded, shell, sideWindows, snakePlant, solid, turntable, windowFrame } from "./kit";
import { rgb, type Design } from "./room3d";
import { fabric, plaster, print, toTexture, wood } from "./textures";

const opening = { w: 1.7, h: 1.45, sill: 1.0, depth: 0.26 };

export const listeningRoom: Design = {
  id: "listening",
  name: "Listening room",
  opening,
  eye: 1.4,
  span: { w: 3.9, h: 2.5 },

  build(scene) {
    const wall = mat([255, 255, 255], { map: toTexture(plaster([236, 224, 204], 3), [1, 1]), roughness: 0.95 });
    const floor = mat([255, 255, 255], { map: toTexture(wood([150, 104, 66], 8, 8), [1, 1]), roughness: 0.55 });
    const ceiling = mat([240, 234, 224], { roughness: 1 });
    shell(scene, opening, { w: 5.6, h: 2.9, d: 10 }, wall, floor, ceiling);
    sideWindows(scene, 2.7, { z0: 0.5, z1: 2.3, y0: 0.9, y1: 2.6 }, 2.9, 22);

    const frame = mat([40, 36, 32], { roughness: 0.45 });
    windowFrame(scene, opening, frame, 0.17);
    // Interior sill.
    box(scene, opening.w + 0.12, 0.035, 0.26, mat([226, 216, 200], { roughness: 0.6 }), 0, opening.sill - 0.005, -0.07);
    const oak = mat([255, 255, 255], { map: toTexture(wood([196, 156, 112], 21, 0, 512, 64)), roughness: 0.55 });
    blinds(scene, opening, oak, 12, -0.06);
    // Skirting.
    box(scene, 5.6, 0.09, 0.015, mat([232, 222, 206], { roughness: 0.6 }), 0, 0.045, 0.0075);

    // Fluted walnut sideboard.
    const walnut = mat([255, 255, 255], { map: toTexture(wood([104, 64, 40], 5)), roughness: 0.5 });
    const W = 2.5, D = 0.46, top = 0.74, legs = 0.17, z = 0.02 + D / 2;
    rounded(scene, W, top - legs, D, 0.012, walnut, 0, (top + legs) / 2, z);
    const flute = new THREE.CylinderGeometry(0.012, 0.012, top - legs - 0.08, 10, 1, false, 0, Math.PI);
    const n = 80, inst = new THREE.InstancedMesh(flute, walnut, n), q = new THREE.Object3D();
    inst.castShadow = inst.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      q.position.set(-W / 2 + 0.06 + (i + 0.5) * ((W - 0.12) / n), (top + legs) / 2, z + D / 2);
      q.rotation.set(0, -Math.PI / 2, 0);
      q.updateMatrix();
      inst.setMatrixAt(i, q.matrix);
    }
    scene.add(inst);
    const gap = mat([24, 16, 12], { roughness: 1 });
    for (const x of [-W / 6, W / 6]) box(scene, 0.006, top - legs - 0.06, 0.03, gap, x, (top + legs) / 2, z + D / 2);
    const brass = mat([196, 160, 96], { metalness: 0.9, roughness: 0.3 });
    for (const x of [-W / 6 - 0.04, W / 6 + 0.04]) solid(scene, new THREE.SphereGeometry(0.012, 16, 12), brass, x, (top + legs) / 2 + 0.05, z + D / 2 + 0.02);
    for (const [x, zz] of [[-W / 2 + 0.08, 0.08], [W / 2 - 0.08, 0.08], [-W / 2 + 0.08, D - 0.04], [W / 2 - 0.08, D - 0.04]] as const)
      solid(scene, new THREE.CylinderGeometry(0.02, 0.013, legs, 16), walnut, x, legs / 2, zz);

    // Record player and the sleeve of what's on it.
    const art = new AlbumArt();
    const deck = turntable(scene, art, mat([206, 198, 184], { roughness: 0.42 }));
    deck.group.position.set(0.12, top, 0.25);
    deck.group.rotation.y = -0.05;
    const stand = mat([255, 255, 255], { map: toTexture(wood([186, 140, 96], 13, 0, 512, 64)), roughness: 0.5 });
    box(scene, 0.36, 0.02, 0.09, stand, -0.6, top + 0.01, 0.16);
    const sleeve = new THREE.Group();
    sleeve.position.set(-0.6, top + 0.02, 0.13);
    sleeve.rotation.x = -0.16;
    scene.add(sleeve);
    const card = mat([226, 220, 206], { roughness: 0.8 });
    box(sleeve, 0.315, 0.315, 0.004, [card, card, card, card, art.use(mat([255, 255, 255], { roughness: 0.55 })), card], 0, 0.1575, 0);
    box(scene, 0.36, 0.03, 0.012, stand, -0.6, top + 0.035, 0.2);

    // Lamp: a ceramic base and a linen shade that glows when it's on.
    const lx = -1.02, lz = 0.25;
    lathe(scene, [[0, 0], [0.07, 0], [0.09, 0.05], [0.1, 0.12], [0.08, 0.2], [0.03, 0.25], [0.02, 0.28], [0, 0.28]], mat([196, 112, 76], { roughness: 0.45 }), lx, top, lz);
    solid(scene, new THREE.CylinderGeometry(0.006, 0.006, 0.12, 12), brass, lx, top + 0.33, lz);
    const linen = toTexture(fabric([236, 226, 206]));
    const shade = new THREE.MeshStandardMaterial({ map: linen, color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, emissive: rgb([255, 190, 120]), emissiveIntensity: 0 });
    const shadeMesh = solid(scene, new THREE.CylinderGeometry(0.12, 0.17, 0.22, 64, 1, true), shade, lx, top + 0.43, lz);
    shadeMesh.castShadow = false;
    const bulb = new THREE.PointLight(0xffc68a, 0, 0, 2);
    bulb.position.set(lx, top + 0.42, lz);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(512, 512);
    bulb.shadow.bias = -0.002;
    bulb.shadow.camera.near = 0.18;
    scene.add(bulb);

    // A stack of books with a mug on top, and the plant.
    const h = books(scene, [{ w: 0.24, h: 0.035, d: 0.17, c: [58, 84, 92] }, { w: 0.21, h: 0.028, d: 0.15, c: [176, 92, 64] }, { w: 0.22, h: 0.03, d: 0.16, c: [222, 212, 190] }], 0.66, top, 0.27, false);
    mug(scene, mat([236, 230, 218], { roughness: 0.3 }), 0.66, top + h, 0.27);
    snakePlant(scene, mat([232, 226, 214], { roughness: 0.4 }), 7).position.set(1.03, top, 0.23);

    // A framed print to the right, and a floating shelf to the left.
    const pf = new THREE.Group();
    pf.position.set(1.62, 1.75, 0.02);
    scene.add(pf);
    box(pf, 0.58, 0.74, 0.03, mat([30, 26, 22], { roughness: 0.5 }), 0, 0, 0);
    box(pf, 0.54, 0.7, 0.002, mat([244, 240, 232], { roughness: 0.9 }), 0, 0, 0.0155);
    box(pf, 0.4, 0.52, 0.002, mat([255, 255, 255], { map: toTexture(print(4)), roughness: 0.85 }), 0, 0.01, 0.0165);
    box(pf, 0.54, 0.7, 0.002, mat([255, 255, 255], { transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.2 }), 0, 0, 0.018);
    box(scene, 0.66, 0.035, 0.2, walnut, -1.62, 1.58, 0.1);
    books(
      scene,
      [
        { w: 0.03, h: 0.24, d: 0.16, c: [120, 52, 46] },
        { w: 0.025, h: 0.21, d: 0.15, c: [210, 196, 168] },
        { w: 0.035, h: 0.26, d: 0.17, c: [52, 64, 82] },
        { w: 0.028, h: 0.22, d: 0.15, c: [150, 120, 70] },
        { w: 0.022, h: 0.2, d: 0.14, c: [88, 104, 80] },
      ],
      -1.9,
      1.5975,
      0.1,
      true,
    );
    lathe(scene, [[0, 0], [0.045, 0], [0.06, 0.06], [0.05, 0.13], [0.022, 0.17], [0.025, 0.19], [0, 0.19]], mat([214, 204, 186], { roughness: 0.6 }), -1.45, 1.5975, 0.1);
    for (let i = 0; i < 3; i++) {
      const stem = solid(scene, new THREE.CylinderGeometry(0.0025, 0.0025, 0.3, 6), mat([120, 96, 62]), -1.45 + (i - 1) * 0.03, 1.5975 + 0.3, 0.1);
      stem.rotation.z = (i - 1) * 0.25;
    }

    const lampOn = (env: Environment) => clamp(env.lamp * 1.15);
    return {
      update(env) {
        const on = lampOn(env);
        bulb.color.copy(rgb(mixRGB(env.lampColor, [255, 214, 160], 0.4)));
        bulb.intensity = 1.1 * on;
        bulb.visible = on > 0.01;
        shade.emissive.copy(rgb(env.lampColor));
        shade.emissiveIntensity = 0.45 * on;
        return deck.update(env);
      },
      signature: (env) => [lampOn(env), ...env.lampColor.map((v) => v / 255)],
      glows: [{ at: new THREE.Vector3(lx, top + 0.43, lz), radius: 0.6, color: (env) => env.lampColor, level: (env) => lampOn(env) * 0.8 }],
    };
  },
};
