/** "Lofi desk": an illustrated study at night. A desk under a big window, an angled lamp pooling warm light on a
 *  row of books and an open notebook, a cat sitting on the desk watching the city, a chair, big-leaf plants and
 *  pictures. Toon-shaded, so it reads as a drawing with real perspective. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp, mixRGB, type RGB } from "../util";
import { AlbumArt, box, rounded, shell, solid, toon, turntable, windowFrame } from "./kit";
import { rgb, type Design } from "./room3d";
import { print, toTexture } from "./textures";

const opening = { w: 2.0, h: 1.3, sill: 0.95, depth: 0.2 };

/** A cat sitting up, seen from behind, looking out of the window. Origin: where it sits. */
export function sittingCat(parent: THREE.Object3D, fur: RGB) {
  const g = new THREE.Group();
  parent.add(g);
  const m = toon(fur);
  const body = solid(g, new THREE.SphereGeometry(0.1, 48, 32), m, 0, 0.1, 0);
  body.scale.set(1, 1.15, 0.9);
  const chest = solid(g, new THREE.SphereGeometry(0.075, 20, 14), m, 0, 0.2, -0.03);
  chest.scale.set(1, 1.1, 0.9);
  solid(g, new THREE.SphereGeometry(0.065, 24, 16), m, 0, 0.3, -0.02);
  for (const side of [-1, 1]) {
    const ear = solid(g, new THREE.ConeGeometry(0.025, 0.055, 4), m, side * 0.038, 0.36, -0.02);
    ear.rotation.z = -side * 0.25;
  }
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.02, 0.06), new THREE.Vector3(0.16, 0.01, 0.08), new THREE.Vector3(0.22, 0.01, 0.0), new THREE.Vector3(0.2, 0.015, -0.08)]);
  solid(g, new THREE.TubeGeometry(tail, 20, 0.018, 8), m, 0, 0, 0);
  return g;
}

/** A big-leafed houseplant in a pot. Origin: the floor under the pot. */
export function leafyPlant(parent: THREE.Object3D, leafColor: RGB, potColor: RGB, height: number, seed = 1) {
  const g = new THREE.Group();
  parent.add(g);
  solid(g, new THREE.CylinderGeometry(0.17, 0.13, 0.32, 24), toon(potColor), 0, 0.16, 0);
  const leafM = toon(leafColor, { side: THREE.DoubleSide });
  const stemM = toon(mixRGB(leafColor, [0, 0, 0], 0.3));
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, lean = 0.3 + rand() * 0.5, len = height * (0.45 + rand() * 0.55);
    const tip = new THREE.Vector3(Math.sin(a) * Math.sin(lean) * len, 0.3 + Math.cos(lean) * len, Math.cos(a) * Math.sin(lean) * len * 0.6);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(tip.x * 0.3, tip.y * 0.9, tip.z * 0.3), tip);
    solid(g, new THREE.TubeGeometry(curve, 10, 0.008, 5), stemM, 0, 0, 0);
    const shape = new THREE.Shape(), L = 0.22 + rand() * 0.14, W = L * 0.42;
    shape.moveTo(0, 0);
    shape.bezierCurveTo(W, L * 0.2, W * 0.9, L * 0.8, 0, L);
    shape.bezierCurveTo(-W * 0.9, L * 0.8, -W, L * 0.2, 0, 0);
    const leaf = solid(g, new THREE.ShapeGeometry(shape, 10), leafM, tip.x, tip.y, tip.z);
    leaf.rotation.set(-0.5 - rand() * 0.6, a, (rand() - 0.5) * 1.2);
  }
  return g;
}

export const lofiDesk: Design = {
  id: "lofi-desk",
  name: "Lofi desk",
  opening,
  eye: 1.3,
  look: 1.18,
  span: { w: 3.8, h: 2.6 },
  style: "illustrated",
  sideSun: false,

  build(scene) {
    const wall = toon([92, 84, 122]);
    shell(scene, opening, { w: 4.4, h: 2.7, d: 9 }, wall, toon([70, 52, 60]), toon([60, 56, 84]));
    const frame = toon([58, 44, 52]);
    windowFrame(scene, opening, frame, 0.1, 0.06, 2, 2, 0.16);
    box(scene, opening.w + 0.16, 0.05, 0.3, toon([110, 76, 76]), 0, opening.sill + 0.0, -0.06);

    // The desk.
    const wood = toon([150, 92, 72]), dark = toon([104, 62, 54]);
    const top = 0.76, W = 2.6, D = 0.62, z = D / 2 + 0.02;
    rounded(scene, W, 0.05, D, 0.01, wood, 0, top - 0.025, z);
    box(scene, W - 0.1, 0.16, 0.02, dark, 0, top - 0.13, z + D / 2 - 0.03);
    for (const x of [-W / 6, W / 6]) box(scene, 0.008, 0.14, 0.01, wood, x, top - 0.13, z + D / 2 - 0.015);
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) box(scene, 0.06, top - 0.05, D - 0.06, dark, x, (top - 0.05) / 2, z);

    // A row of books against the window, in muted colours.
    const spines: RGB[] = [[168, 84, 70], [214, 170, 120], [92, 104, 140], [196, 120, 84], [120, 70, 92], [222, 206, 176], [80, 112, 110], [176, 96, 80]];
    let bx = -0.82;
    for (let i = 0; i < 13; i++) {
      const w = 0.03 + ((i * 7) % 5) * 0.006, h = 0.2 + ((i * 5) % 7) * 0.018;
      const b = box(scene, w, h, 0.16, toon(spines[i % spines.length]!), bx + w / 2, top + h / 2, 0.14);
      if (i === 12) b.rotation.z = -0.25;
      bx += w + 0.003;
    }
    // A stack on the right with a little box on top.
    let by = top;
    for (const [w, h, c] of [[0.3, 0.05, [92, 104, 140]], [0.27, 0.04, [214, 170, 120]], [0.29, 0.06, [168, 84, 70]], [0.25, 0.04, [222, 206, 176]]] as [number, number, RGB][]) {
      box(scene, w, h, 0.2, toon(c), 0.95, by + h / 2, 0.17);
      by += h;
    }
    box(scene, 0.16, 0.09, 0.12, toon([70, 74, 96]), 0.95, by + 0.045, 0.17);

    // An open notebook, a pencil and a phone.
    const pageM = toon([238, 226, 200]);
    for (const side of [-1, 1]) {
      const p = box(scene, 0.2, 0.012, 0.28, pageM, 0.42 + side * 0.1, top + 0.008, 0.38);
      p.rotation.z = side * -0.05;
    }
    const lines = toon([170, 150, 140]);
    for (let i = 0; i < 6; i++) for (const side of [-1, 1]) box(scene, 0.14, 0.001, 0.006, lines, 0.42 + side * 0.1, top + 0.016, 0.28 + i * 0.035);
    box(scene, 0.16, 0.01, 0.012, toon([214, 168, 70]), 0.68, top + 0.006, 0.44).rotation.y = 0.5;
    box(scene, 0.08, 0.012, 0.15, toon([40, 40, 52]), -0.55, top + 0.006, 0.48).rotation.y = -0.2;

    // The cat.
    sittingCat(scene, [52, 50, 68]).position.set(-0.05, top, 0.3);

    // The lamp: base, two arms and a shade tipped toward the desk.
    const lampM = toon([96, 36, 40]);
    const baseX = -0.95, baseZ = 0.3;
    solid(scene, new THREE.CylinderGeometry(0.09, 0.1, 0.03, 32), lampM, baseX, top + 0.015, baseZ);
    const elbow = new THREE.Vector3(baseX - 0.12, top + 0.5, baseZ - 0.05), head = new THREE.Vector3(baseX + 0.22, top + 0.62, baseZ);
    const arm = (a: THREE.Vector3, b: THREE.Vector3) => {
      const len = a.distanceTo(b), m = solid(scene, new THREE.CylinderGeometry(0.012, 0.012, len, 10), lampM, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    };
    arm(new THREE.Vector3(baseX, top + 0.03, baseZ), elbow);
    arm(elbow, head);
    const shade = new THREE.Group();
    shade.position.copy(head);
    shade.rotation.z = -0.9;
    scene.add(shade);
    solid(shade, new THREE.CylinderGeometry(0.035, 0.13, 0.17, 32, 1, true), toon([110, 40, 44], { side: THREE.DoubleSide }), 0, -0.08, 0);
    const bulbM = new THREE.MeshBasicMaterial({ color: rgb([255, 226, 160]), toneMapped: false });
    const bulbMesh = solid(shade, new THREE.CircleGeometry(0.12, 32), bulbM, 0, -0.165, 0);
    bulbMesh.rotation.x = Math.PI / 2;
    bulbMesh.castShadow = false;
    const spot = new THREE.SpotLight(0xffc27a, 0, 0, 0.75, 0.7, 2);
    spot.position.copy(head).add(new THREE.Vector3(0.06, -0.05, 0));
    spot.target.position.set(baseX + 0.6, top, 0.32);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.001;
    spot.shadow.radius = 3;
    scene.add(spot, spot.target);
    const room = new THREE.PointLight(0xff9a6a, 0, 0, 2);
    room.position.set(baseX + 0.4, top + 0.3, 0.6);
    scene.add(room);

    // The chair, from behind, in the foreground.
    const chairM = toon([120, 52, 56]);
    const cx = 0.85, cz = 0.98;
    box(scene, 0.5, 0.05, 0.46, chairM, cx, 0.47, cz);
    for (const dx of [-0.23, 0.23]) box(scene, 0.04, 0.55, 0.04, chairM, cx + dx, 0.75, cz + 0.22);
    box(scene, 0.5, 0.06, 0.04, chairM, cx, 1.02, cz + 0.22);
    for (let i = 0; i < 4; i++) box(scene, 0.06, 0.42, 0.02, chairM, cx - 0.15 + i * 0.1, 0.74, cz + 0.22);
    for (const [dx, dz] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]] as const) box(scene, 0.035, 0.47, 0.035, chairM, cx + dx, 0.235, cz + dz);

    // Plants at either side, pictures on the walls.
    leafyPlant(scene, [44, 78, 82], [70, 60, 84], 1.1, 5).position.set(-1.75, 0, 0.55);
    leafyPlant(scene, [40, 72, 76], [84, 62, 70], 0.9, 9).position.set(1.8, 0, 0.7);
    const pic = (x: number, y: number, w: number, h: number) => {
      box(scene, w, h, 0.03, toon([44, 36, 44]), x, y, 0.015);
      box(scene, w - 0.06, h - 0.06, 0.004, new THREE.MeshToonMaterial({ map: toTexture(print(x > 0 ? 6 : 8)) }), x, y, 0.032);
    };
    pic(1.65, 1.7, 0.5, 0.66);
    pic(-1.65, 1.95, 0.42, 0.52);

    // A record player on the desk while music plays.
    const art = new AlbumArt();
    const deck = turntable(scene, art, toon([214, 196, 170]), true);
    deck.group.position.set(0.42, top, 0.36);

    const lampOn = (env: Environment) => clamp(Math.max(env.lamp * 1.15, 0.25));
    return {
      update(env) {
        const on = lampOn(env);
        spot.intensity = 9 * on;
        spot.color.copy(rgb(mixRGB(env.lampColor, [255, 200, 130], 0.5)));
        room.intensity = 0.5 * on;
        bulbM.color.copy(rgb(mixRGB([200, 190, 170], [255, 226, 160], on)));
        return deck.update(env);
      },
      signature: (env) => [lampOn(env), ...env.lampColor.map((v) => v / 255)],
      glows: [{ at: head.clone().add(new THREE.Vector3(0.08, -0.1, 0.05)), radius: 0.5, color: (env) => mixRGB(env.lampColor, [255, 200, 130], 0.5), level: (env) => lampOn(env) * 0.8 }],
    };
  },
};
