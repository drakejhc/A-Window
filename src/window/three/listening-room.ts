/** "Listening room": after Vinyl for Mac. A warm, dim room at a wooden sideboard: a record player in the middle,
 *  the album that's playing on a stand to its left, a stack of records and a ribbed glass mushroom lamp to its right,
 *  under a wide window. The lamp is the key light, so the wall glows amber around it. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp, mixRGB } from "../util";
import { AlbumArt, blinds, box, lathe, mat, rounded, shell, sideWindows, snakePlant, solid, turntable, windowFrame } from "./kit";
import { rgb, type Design } from "./room3d";
import { defaultSleeve, plaster, toTexture, wood } from "./textures";

const opening = { w: 1.6, h: 0.74, sill: 1.0, depth: 0.22 };

export const listeningRoom: Design = {
  id: "listening",
  name: "Listening room",
  opening,
  eye: 1.3,
  look: 0.98,
  span: { w: 2.2, h: 1.6 },

  build(scene) {
    const wall = mat([255, 255, 255], { map: toTexture(plaster([226, 200, 172], 3), [1, 1]), roughness: 0.95 });
    const floor = mat([255, 255, 255], { map: toTexture(wood([150, 104, 66], 8, 8), [1, 1]), roughness: 0.55 });
    shell(scene, opening, { w: 5.6, h: 2.9, d: 10 }, wall, floor, mat([240, 234, 224], { roughness: 1 }));
    sideWindows(scene, 2.7, { z0: 0.5, z1: 2.3, y0: 0.9, y1: 2.6 }, 2.9, 22);

    windowFrame(scene, opening, mat([40, 34, 30], { roughness: 0.45 }), 0.15, 0.045, 3, 1);
    box(scene, opening.w + 0.1, 0.03, 0.24, mat([214, 200, 180], { roughness: 0.6 }), 0, opening.sill - 0.003, -0.06);
    blinds(scene, opening, mat([255, 255, 255], { map: toTexture(wood([196, 156, 112], 21, 0, 512, 64)), roughness: 0.55 }), 3, -0.06);

    // A walnut sideboard with a fluted front, its top waxed enough to catch the lamp.
    const walnut = mat([255, 255, 255], { map: toTexture(wood([104, 64, 40], 5)), roughness: 0.4 });
    const W = 2.8, D = 0.95, top = 0.76, legs = 0.17, z = 0.02 + D / 2;
    rounded(scene, W, top - legs, D, 0.012, walnut, 0, (top + legs) / 2, z);
    const flute = new THREE.CylinderGeometry(0.012, 0.012, top - legs - 0.08, 10, 1, false, 0, Math.PI);
    const n = 90, inst = new THREE.InstancedMesh(flute, walnut, n), q = new THREE.Object3D();
    inst.castShadow = inst.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      q.position.set(-W / 2 + 0.06 + (i + 0.5) * ((W - 0.12) / n), (top + legs) / 2, z + D / 2);
      q.rotation.set(0, -Math.PI / 2, 0);
      q.updateMatrix();
      inst.setMatrixAt(i, q.matrix);
    }
    scene.add(inst);

    // The record player, on a walnut base, and the sleeve of what's playing on a stand.
    const art = new AlbumArt();
    const oak = mat([255, 255, 255], { map: toTexture(wood([170, 120, 80], 13, 0, 512, 64)), roughness: 0.45 });
    // A touch larger than life, as product shots are, so the player reads from across the room.
    const deck = turntable(scene, art, mat([222, 214, 198], { roughness: 0.4 }));
    deck.group.scale.setScalar(1.18);
    box(scene, 0.58, 0.03, 0.46, walnut, -0.02, top + 0.015, 0.42);
    deck.group.position.set(-0.02, top + 0.03, 0.42);
    box(scene, 0.4, 0.022, 0.1, oak, -0.74, top + 0.011, 0.36);
    const sleeve = new THREE.Group();
    sleeve.position.set(-0.74, top + 0.022, 0.33);
    sleeve.rotation.x = -0.13;
    sleeve.scale.setScalar(1.1);
    scene.add(sleeve);
    const card = mat([226, 220, 206], { roughness: 0.8 });
    box(sleeve, 0.315, 0.315, 0.004, [card, card, card, card, art.use(mat([255, 255, 255], { roughness: 0.55 })), card], 0, 0.1575, 0);
    box(scene, 0.4, 0.032, 0.012, oak, -0.74, top + 0.038, 0.385);

    // A loose stack of records to the right.
    const stackArt = mat([255, 255, 255], { map: toTexture(defaultSleeve()), roughness: 0.6 });
    const sleeves = [mat([238, 234, 226], { roughness: 0.8 }), mat([60, 48, 44], { roughness: 0.7 }), mat([170, 150, 120], { roughness: 0.8 }), mat([236, 232, 222], { roughness: 0.8 })];
    sleeves.forEach((m, i) => {
      const sl = box(scene, 0.315, 0.005, 0.315, i === sleeves.length - 1 ? [m, m, stackArt, m, m, m] : m, 0.52 + (i % 2 ? 0.012 : -0.01), top + 0.0025 + i * 0.006, 0.5);
      sl.rotation.y = 0.18 + (i - 2) * 0.05;
    });

    // The mushroom lamp: a brass foot and a ribbed glass dome that glows.
    const lx = 0.96, lz = 0.36;
    const brass = mat([190, 150, 92], { metalness: 0.9, roughness: 0.3 });
    lathe(scene, [[0, 0], [0.075, 0], [0.08, 0.012], [0.05, 0.03], [0.018, 0.05], [0.014, 0.17], [0, 0.17]], brass, lx, top, lz);
    const profile = new THREE.SplineCurve([[0.11, 0.14], [0.128, 0.2], [0.124, 0.27], [0.104, 0.325], [0.064, 0.36], [0.001, 0.372]].map(([r, y]) => new THREE.Vector2(r!, y!)));
    const domeGeo = new THREE.LatheGeometry(profile.getPoints(28), 120);
    const dp = domeGeo.attributes.position!;
    for (let i = 0; i < dp.count; i++) {
      // Vertical ribs pressed into the glass.
      const x = dp.getX(i), zz = dp.getZ(i), a = Math.atan2(zz, x), k = 1 + 0.03 * Math.abs(Math.cos(a * 14));
      dp.setX(i, x * k);
      dp.setZ(i, zz * k);
    }
    domeGeo.computeVertexNormals();
    const glass = new THREE.MeshStandardMaterial({ color: rgb([250, 222, 186]), roughness: 0.3, transparent: true, opacity: 0.94, side: THREE.DoubleSide, emissive: rgb([255, 176, 96]), emissiveIntensity: 0 });
    const dome = solid(scene, domeGeo, glass, lx, top, lz);
    dome.castShadow = false;
    const bulb = new THREE.PointLight(0xffb070, 0, 0, 2);
    bulb.position.set(lx, top + 0.25, lz);
    bulb.castShadow = true;
    bulb.shadow.mapSize.set(1024, 1024);
    bulb.shadow.bias = -0.002;
    bulb.shadow.radius = 4;
    bulb.shadow.camera.near = 0.15;
    scene.add(bulb);
    const fill = new THREE.PointLight(0xff9a50, 0, 0, 2);
    fill.position.set(lx - 0.2, top + 0.6, 0.9);
    scene.add(fill);

    // A snake plant at the far left edge.
    snakePlant(scene, mat([232, 226, 214], { roughness: 0.4 }), 7).position.set(-1.12, top, 0.3);

    // The lamp is nearly always on here: full at night, softly glowing on a dull day.
    const lampOn = (env: Environment) => {
      const day = clamp((env.ambient[0] + env.ambient[1] + env.ambient[2]) / 3);
      return clamp(Math.max(env.lamp * 1.15, 0.75 * (1 - day)) + 0.12);
    };
    return {
      update(env) {
        const on = lampOn(env);
        // A deep amber, so the wall glows orange rather than washing out to yellow.
        const c = rgb(mixRGB(env.lampColor, [255, 138, 56], 0.65));
        bulb.color.copy(c);
        bulb.intensity = 1.25 * on;
        fill.color.copy(c);
        fill.intensity = 0.3 * on;
        glass.emissive.copy(rgb(mixRGB(env.lampColor, [255, 150, 70], 0.7)));
        glass.emissiveIntensity = 0.7 * on;
        return deck.update(env);
      },
      signature: (env) => [lampOn(env), ...env.lampColor.map((v) => v / 255)],
      glows: [
        { at: new THREE.Vector3(lx, top + 0.26, lz), radius: 0.3, color: () => [255, 196, 130], level: (env) => lampOn(env) * 0.6 },
        { at: new THREE.Vector3(lx, top + 0.3, lz - 0.05), radius: 1.1, color: (env) => mixRGB(env.lampColor, [255, 120, 50], 0.7), level: (env) => lampOn(env) * 0.5 },
      ],
    };
  },
};
