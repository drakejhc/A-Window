/** "Japanese room": clay walls between cedar posts, a low lattice window with shoji screens slid open, a low
 *  cabinet with a pine bonsai, a tea set and a branch of blossom, a hanging scroll and a paper floor lantern.
 *  For Japan and East Asia. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp, mixRGB } from "../util";
import { AlbumArt, box, lathe, mat, shell, sideWindows, solid, turntable, windowFrame, worldUV } from "./kit";
import { rgb, type Design } from "./room3d";
import { inkScroll, paper, plaster, tatami, toTexture, wood } from "./textures";

const opening = { w: 1.8, h: 1.25, sill: 0.72, depth: 0.16 };

export const japaneseRoom: Design = {
  id: "japanese",
  name: "Japanese room",
  opening,
  eye: 1.12,
  span: { w: 3.9, h: 2.3 },

  build(scene) {
    const wall = mat([255, 255, 255], { map: toTexture(plaster([206, 184, 146], 9), [1, 1]), roughness: 1 });
    const floor = mat([255, 255, 255], { map: toTexture(tatami(), [1, 1]), roughness: 0.85 });
    shell(scene, opening, { w: 5.4, h: 2.5, d: 10 }, wall, floor, mat([176, 140, 100], { roughness: 0.9 }), { wall: 1.5, floor: 1.8 });
    sideWindows(scene, 2.6, { z0: 0.4, z1: 2.4, y0: 0.4, y1: 2.0 }, 2.5, 0);

    const cedar = mat([255, 255, 255], { map: toTexture(wood([150, 104, 66], 22, 0, 512, 128), [1, 1]), roughness: 0.6 });
    const pale = mat([255, 255, 255], { map: toTexture(wood([214, 184, 140], 23, 0, 512, 128), [1, 1]), roughness: 0.55 });
    // Posts, the beam above the window, and a low skirting.
    for (const x of [-1.5, 1.5]) worldUV(box(scene, 0.11, 2.5, 0.11, cedar, x, 1.25, 0.04), 1);
    worldUV(box(scene, 3.1, 0.1, 0.06, cedar, 0, 2.12, 0.03), 1);
    box(scene, 5.4, 0.05, 0.02, cedar, 0, 0.025, 0.01);

    // A fine lattice window.
    windowFrame(scene, opening, pale, 0.08, 0.04, 6, 3);
    box(scene, opening.w + 0.1, 0.03, 0.22, pale, 0, opening.sill - 0.003, -0.04);

    // Shoji screens, slid open to either side of the window.
    const paperMat = new THREE.MeshStandardMaterial({ map: toTexture(paper()), roughness: 0.9, emissive: rgb([255, 244, 222]), emissiveIntensity: 0 });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * (opening.w / 2 + 0.2), opening.sill, 0.07);
      scene.add(g);
      const w = 0.62, h = 1.36;
      box(g, w - 0.02, h - 0.02, 0.004, paperMat, 0, h / 2, 0);
      for (const x of [-w / 2, w / 2]) box(g, 0.03, h, 0.03, pale, x, h / 2, 0.005);
      for (const y of [0, h]) box(g, w, 0.035, 0.03, pale, 0, y, 0.005);
      for (let i = 1; i < 3; i++) box(g, 0.012, h, 0.012, pale, -w / 2 + (w * i) / 3, h / 2, 0.006);
      for (let j = 1; j < 6; j++) box(g, w, 0.012, 0.012, pale, 0, (h * j) / 6, 0.006);
    }

    // A low cabinet below the window.
    const top = 0.42, D = 0.42, W = 1.9, z = D / 2 + 0.03;
    worldUV(box(scene, W, top, D, cedar, 0, top / 2, z), 1);
    for (const x of [-W / 4, W / 4]) box(scene, W / 2 - 0.04, top - 0.08, 0.005, paperMat, x, top / 2, z + D / 2 + 0.003);
    for (const x of [-W / 2 + 0.02, 0, W / 2 - 0.02]) box(scene, 0.02, top - 0.06, 0.012, cedar, x, top / 2, z + D / 2 + 0.006);

    // Pine bonsai on a small stand.
    const bx = -0.55, bz = z;
    box(scene, 0.34, 0.04, 0.24, mat([60, 40, 30], { roughness: 0.4 }), bx, top + 0.02, bz);
    box(scene, 0.3, 0.06, 0.18, mat([110, 96, 86], { roughness: 0.6 }), bx, top + 0.07, bz);
    const bark = mat([92, 72, 58], { roughness: 0.95 });
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.1, 0), new THREE.Vector3(-0.04, 0.2, 0.02), new THREE.Vector3(0.06, 0.3, 0), new THREE.Vector3(0.14, 0.34, 0)]);
    solid(scene, new THREE.TubeGeometry(curve, 24, 0.018, 8), bark, bx, top + 0.1, bz);
    // Foliage pads, each a cluster of small tufts.
    const needles = mat([56, 86, 50], { roughness: 1, flatShading: true });
    let n = 3;
    const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
    for (const [dx, dy, s] of [[0.15, 0.36, 0.09], [0.04, 0.33, 0.07], [-0.08, 0.24, 0.08], [0.1, 0.2, 0.06], [-0.02, 0.4, 0.06]] as const)
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2, r = rand() * s;
        const tuft = solid(scene, new THREE.IcosahedronGeometry(s * (0.35 + rand() * 0.25), 0), needles, bx + dx + Math.cos(a) * r * 1.3, top + 0.1 + dy + rand() * s * 0.25, bz + Math.sin(a) * r);
        tuft.scale.set(1.3, 0.6, 1.1);
        tuft.rotation.y = rand() * 3;
      }

    // A tea set on a tray.
    const tx = 0.58;
    box(scene, 0.36, 0.015, 0.22, cedar, tx, top + 0.0075, z + 0.02);
    const clay = mat([74, 62, 54], { roughness: 0.4 });
    lathe(scene, [[0, 0], [0.05, 0], [0.065, 0.04], [0.06, 0.08], [0.03, 0.095], [0.012, 0.1], [0, 0.1]], clay, tx - 0.06, top + 0.015, z + 0.02);
    solid(scene, new THREE.CylinderGeometry(0.008, 0.006, 0.06, 8), clay, tx - 0.12, top + 0.065, z + 0.02).rotation.z = 0.9;
    for (const dx of [0.07, 0.13]) lathe(scene, [[0, 0], [0.022, 0], [0.03, 0.045], [0.026, 0.045], [0.018, 0.006], [0, 0.006]], mat([214, 206, 188], { roughness: 0.35 }), tx + dx, top + 0.015, z + 0.04);

    // A branch of blossom in a tall vase.
    const vx = 0.84;
    lathe(scene, [[0, 0], [0.05, 0], [0.06, 0.08], [0.035, 0.22], [0.04, 0.26], [0, 0.26]], mat([62, 84, 92], { roughness: 0.3 }), vx, top, z);
    const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.24, 0), new THREE.Vector3(0.05, 0.42, 0), new THREE.Vector3(0.2, 0.58, -0.02), new THREE.Vector3(0.34, 0.62, 0)]);
    solid(scene, new THREE.TubeGeometry(branch, 20, 0.006, 6), bark, vx, top, z);
    const blossom = mat([240, 196, 204], { roughness: 0.7 });
    for (let i = 0; i < 18; i++) {
      const p = branch.getPoint(0.3 + (i / 18) * 0.7);
      solid(scene, new THREE.SphereGeometry(0.012 + (i % 3) * 0.003, 8, 6), blossom, vx + p.x + Math.sin(i * 3) * 0.02, top + p.y + Math.cos(i * 2) * 0.02, z + Math.sin(i) * 0.02);
    }

    // A hanging scroll on the left wall.
    const scroll = box(scene, 0.34, 1.0, 0.006, mat([255, 255, 255], { map: toTexture(inkScroll()), roughness: 0.85 }), -1.75, 1.42, 0.01);
    scroll.castShadow = false;
    solid(scene, new THREE.CylinderGeometry(0.012, 0.012, 0.4, 12), cedar, -1.75, 0.91, 0.02).rotation.z = Math.PI / 2;

    // A paper floor lantern on the right.
    const ax = 1.2, az = 0.62, ah = 0.62;
    const lanternPaper = new THREE.MeshStandardMaterial({ map: toTexture(paper(52)), roughness: 0.9, emissive: rgb([255, 200, 140]), emissiveIntensity: 0, side: THREE.DoubleSide });
    box(scene, 0.26, ah - 0.08, 0.26, lanternPaper, ax, 0.08 + (ah - 0.08) / 2, az).castShadow = false;
    for (const [dx, dz] of [[-0.135, -0.135], [0.135, -0.135], [-0.135, 0.135], [0.135, 0.135]] as const) box(scene, 0.02, ah, 0.02, cedar, ax + dx, ah / 2, az + dz);
    box(scene, 0.3, 0.02, 0.3, cedar, ax, ah, az);
    const bulb = new THREE.PointLight(0xffc080, 0, 0, 2);
    bulb.position.set(ax, 0.4, az);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(1024, 1024);
    bulb.shadow.radius = 3;
    bulb.shadow.camera.near = 0.15;
    scene.add(bulb);

    // A record player on the cabinet while music plays.
    const art = new AlbumArt();
    const deck = turntable(scene, art, mat([214, 184, 140], { roughness: 0.5 }), true);
    deck.group.position.set(0.15, top, z);

    const lampOn = (env: Environment) => clamp(env.lamp * 1.15);
    const day = (env: Environment) => clamp((env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
    return {
      update(env) {
        const on = lampOn(env);
        bulb.intensity = 1.4 * on;
        bulb.visible = on > 0.01;
        bulb.color.copy(rgb(mixRGB(env.lampColor, [255, 200, 140], 0.5)));
        lanternPaper.emissiveIntensity = 0.9 * on;
        // Daylight through the paper.
        paperMat.emissiveIntensity = 0.18 * day(env);
        return deck.update(env);
      },
      signature: (env) => [lampOn(env)],
      glows: [{ at: new THREE.Vector3(ax, 0.38, az), radius: 0.7, color: (env) => mixRGB(env.lampColor, [255, 190, 120], 0.5), level: (env) => lampOn(env) * 0.7 }],
    };
  },
};
