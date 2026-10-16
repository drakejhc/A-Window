/** "Nordic cabin": log walls, a deep six-pane window with candles on the sill, a window bench with a sheepskin and
 *  knitted cushions, firewood, and the glow of a stove just out of sight. For the far north and cold places. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp } from "../util";
import { AlbumArt, box, candle, cushion, lathe, mat, mug, shell, sideWindows, solid, turntable, windowFrame, worldUV } from "./kit";
import { rgb, type Design } from "./room3d";
import { fleece, knit, logs, toTexture, wood } from "./textures";

const opening = { w: 1.5, h: 1.35, sill: 1.0, depth: 0.36 };

export const nordicCabin: Design = {
  id: "cabin",
  name: "Nordic cabin",
  opening,
  eye: 1.35,
  span: { w: 3.7, h: 2.45 },

  build(scene) {
    const wall = mat([255, 255, 255], { map: toTexture(logs([160, 112, 72]), [1, 1]), roughness: 0.75 });
    const floor = mat([255, 255, 255], { map: toTexture(wood([120, 84, 56], 9, 6), [1, 1]), roughness: 0.7 });
    shell(scene, opening, { w: 5.4, h: 2.8, d: 10 }, wall, floor, mat([110, 80, 56], { roughness: 0.9 }), { wall: 1.6, floor: 2 });
    sideWindows(scene, 2.6, { z0: 0.5, z1: 2.0, y0: 0.9, y1: 2.3 }, 2.8, 0);

    // A painted frame with six panes, and a wide plank sill.
    windowFrame(scene, opening, mat([232, 228, 218], { roughness: 0.5 }), 0.22, 0.055, 2, 3);
    const pine = mat([255, 255, 255], { map: toTexture(wood([196, 150, 100], 15, 0, 512, 128), [1, 1]), roughness: 0.6 });
    worldUV(box(scene, opening.w + 0.3, 0.05, 0.5, pine, 0, opening.sill - 0.025, -0.1), 1.2);
    // Trim around the opening.
    for (const side of [-1, 1]) box(scene, 0.09, opening.h + 0.09, 0.03, pine, side * (opening.w / 2 + 0.045), opening.sill + opening.h / 2 + 0.02, 0.015);
    box(scene, opening.w + 0.27, 0.09, 0.03, pine, 0, opening.sill + opening.h + 0.045, 0.015);

    // Candles and a lantern on the sill.
    const sill = opening.sill;
    const flames = [candle(scene, -0.5, sill, 0.0, 0.16, 0.035), candle(scene, -0.41, sill, 0.04, 0.1, 0.03), candle(scene, -0.58, sill, 0.06, 0.07, 0.028)];
    const glass = new THREE.MeshStandardMaterial({ color: rgb([255, 240, 220]), roughness: 0.1, transparent: true, opacity: 0.35, emissive: rgb([255, 190, 110]), emissiveIntensity: 0 });
    const iron = mat([36, 34, 32], { roughness: 0.5, metalness: 0.6 });
    const lx = 0.52, lz = 0.02;
    box(scene, 0.13, 0.015, 0.13, iron, lx, sill + 0.0075, lz);
    solid(scene, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 24, 1, true), glass, lx, sill + 0.095, lz).castShadow = false;
    for (const [dx, dz] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]] as const) box(scene, 0.008, 0.18, 0.008, iron, lx + dx, sill + 0.1, lz + dz);
    solid(scene, new THREE.ConeGeometry(0.085, 0.07, 4), iron, lx, sill + 0.22, lz).rotation.y = Math.PI / 4;
    const lanternFlame = candle(scene, lx, sill + 0.015, lz, 0.06, 0.02);
    const lantern = new THREE.PointLight(0xffb070, 0, 0, 2);
    lantern.position.set(lx, sill + 0.11, lz + 0.05);
    scene.add(lantern);

    // Window bench with a sheepskin, cushions and a mug.
    const benchTop = 0.48, D = 0.5, W = 2.6, bz = D / 2 + 0.02;
    box(scene, W, 0.05, D, pine, 0, benchTop - 0.025, bz);
    box(scene, W - 0.04, benchTop - 0.05, 0.03, mat([255, 255, 255], { map: toTexture(wood([150, 104, 66], 17, 5)), roughness: 0.7 }), 0, (benchTop - 0.05) / 2, D + 0.01);
    // A sheepskin: a squashed, lumpy hide that hangs a little over the front edge.
    const skinGeo = new THREE.SphereGeometry(0.5, 48, 24);
    const sp = skinGeo.attributes.position!;
    for (let i = 0; i < sp.count; i++) {
      const x = sp.getX(i), y = sp.getY(i), z = sp.getZ(i), a = Math.atan2(z, x);
      const k = 1 + 0.12 * Math.sin(a * 5) + 0.07 * Math.sin(a * 11 + 1);
      sp.setXYZ(i, x * k, y * (1 + 0.3 * Math.sin(x * 9) * Math.sin(z * 7)), z * k);
    }
    skinGeo.computeVertexNormals();
    const skin = new THREE.Mesh(skinGeo, mat([255, 255, 255], { map: toTexture(fleece(), [4, 3]), roughness: 1 }));
    skin.scale.set(0.9, 0.12, 0.46);
    skin.rotation.y = 0.12;
    skin.position.set(-0.25, benchTop + 0.03, bz + 0.03);
    skin.castShadow = skin.receiveShadow = true;
    scene.add(skin);
    const cream = mat([255, 255, 255], { map: toTexture(knit([226, 214, 192]), [2, 2]), roughness: 1 });
    const rust = mat([255, 255, 255], { map: toTexture(knit([168, 82, 56], 82), [2, 2]), roughness: 1 });
    cushion(scene, 0.42, 0.42, 0.14, cream, -0.95, benchTop + 0.2, 0.12).rotation.set(-0.25, 0.25, 0.08);
    cushion(scene, 0.36, 0.36, 0.13, rust, -0.62, benchTop + 0.17, 0.1).rotation.set(-0.3, 0.1, -0.1);
    cushion(scene, 0.4, 0.4, 0.14, cream, 1.02, benchTop + 0.19, 0.12).rotation.set(-0.25, -0.3, -0.06);
    mug(scene, mat([60, 72, 84], { roughness: 0.35 }), 0.62, benchTop, 0.32);

    // Record player on the bench while music plays.
    const art = new AlbumArt();
    const deck = turntable(scene, art, mat([150, 104, 66], { roughness: 0.5 }), true);
    deck.group.position.set(0.18, benchTop, 0.28);

    // Firewood stacked in a basket to the right, and a peg rail with a scarf.
    const bark = mat([92, 70, 52], { roughness: 0.95 });
    const endGrain = mat([214, 182, 136], { roughness: 0.9 });
    box(scene, 0.5, 0.28, 0.36, mat([126, 96, 64], { roughness: 0.9 }), 1.75, 0.14, 0.4);
    for (let i = 0; i < 7; i++) {
      const row = i < 4 ? 0 : 1, k = row ? i - 4 : i;
      const log = solid(scene, new THREE.CylinderGeometry(0.05, 0.05, 0.42, 14), [bark, endGrain, endGrain], 1.6 + k * 0.1 + row * 0.05, 0.33 + row * 0.085, 0.4);
      log.rotation.x = Math.PI / 2;
    }
    box(scene, 0.9, 0.06, 0.03, pine, 1.6, 1.85, 0.015);
    const peg = mat([120, 84, 56]);
    for (const x of [1.3, 1.6, 1.9]) solid(scene, new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), peg, x, 1.84, 0.06).rotation.x = Math.PI / 2;
    const scarf = box(scene, 0.16, 0.7, 0.02, mat([255, 255, 255], { map: toTexture(knit([150, 48, 44], 83), [1, 3]), roughness: 1 }), 1.3, 1.5, 0.08);
    scarf.rotation.z = 0.03;
    // A shelf on the left with jars and a small plant.
    box(scene, 0.7, 0.04, 0.2, pine, -1.75, 1.6, 0.1);
    const jar = new THREE.MeshStandardMaterial({ color: rgb([230, 236, 230]), roughness: 0.15, transparent: true, opacity: 0.5 });
    lathe(scene, [[0, 0], [0.05, 0], [0.055, 0.15], [0.04, 0.17], [0, 0.17]], jar, -1.95, 1.62, 0.1);
    lathe(scene, [[0, 0], [0.045, 0], [0.05, 0.11], [0.035, 0.125], [0, 0.125]], jar, -1.8, 1.62, 0.1);
    lathe(scene, [[0, 0], [0.06, 0], [0.07, 0.1], [0, 0.1]], mat([196, 186, 168], { roughness: 0.7 }), -1.58, 1.62, 0.1);
    for (let i = 0; i < 8; i++) {
      const sprig = solid(scene, new THREE.ConeGeometry(0.03, 0.22, 6), mat([52, 84, 60], { roughness: 0.8 }), -1.58 + Math.sin(i) * 0.03, 1.8, 0.1 + Math.cos(i) * 0.03);
      sprig.rotation.set(Math.cos(i * 2) * 0.4, 0, Math.sin(i * 2) * 0.4);
    }

    // The stove's firelight from the left, out of frame.
    const fire = new THREE.PointLight(0xff8a3c, 0, 0, 2);
    fire.position.set(-1.9, 0.35, 1.4);
    scene.add(fire);

    const lampOn = (env: Environment) => clamp(env.lamp * 1.15);
    const fireOn = (env: Environment) => clamp(Math.max(env.fire, env.lamp * 0.6));
    const flicker = (t: number, ph: number) => 0.8 + 0.12 * Math.sin(t * 7.3 + ph) + 0.08 * Math.sin(t * 13.1 + ph * 2);
    const candleColor = () => [255, 176, 96] as [number, number, number];
    return {
      update(env) {
        const on = lampOn(env);
        lantern.intensity = 0.5 * on;
        lantern.visible = on > 0.01;
        glass.emissiveIntensity = 0.6 * on;
        for (const f of [...flames, lanternFlame]) f.flame.visible = on > 0.05;
        fire.intensity = 4.5 * fireOn(env);
        fire.visible = fireOn(env) > 0.01;
        return deck.update(env);
      },
      signature: (env) => [lampOn(env), fireOn(env)],
      glows: [
        ...flames.map((f, i) => ({ at: f.at, radius: 0.22, color: candleColor, level: (env: Environment, t: number) => lampOn(env) * 0.7 * flicker(t, i * 1.7) })),
        { at: lanternFlame.at, radius: 0.3, color: candleColor, level: (env: Environment, t: number) => lampOn(env) * 0.8 * flicker(t, 5) },
        { at: new THREE.Vector3(-1.95, 0.25, 0.9), radius: 1.5, color: () => [255, 120, 50], level: (env: Environment, t: number) => fireOn(env) * 0.45 * flicker(t * 0.7, 0) },
      ],
    };
  },
};
