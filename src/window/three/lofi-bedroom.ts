/** "Cozy bedroom": an illustrated bedroom at night. A deep bed faces a wide window with a ledge of cushions, books,
 *  candles and fairy lights; a fire burns in a fireplace on the right wall. */
import * as THREE from "three";

import type { Environment } from "../environment";
import { clamp, mixRGB, type RGB } from "../util";
import { AlbumArt, box, cushion, rounded, shell, solid, toon, turntable, windowFrame } from "./kit";
import { leafyPlant } from "./lofi-desk";
import { rgb, type Design, type Glow } from "./room3d";

const opening = { w: 2.8, h: 1.65, sill: 0.62, depth: 0.32 };
const WARM: RGB = [255, 184, 110];

export const lofiBedroom: Design = {
  id: "lofi-bedroom",
  name: "Cozy bedroom",
  opening,
  eye: 1.5,
  look: 1.05,
  span: { w: 4.0, h: 2.75 },
  turn: { x: -0.55, lookX: 0.35 },
  style: "illustrated",
  sideSun: false,

  build(scene) {
    shell(scene, opening, { w: 3.9, h: 2.8, d: 9 }, toon([104, 82, 96]), toon([86, 60, 52]), toon([96, 70, 62]));
    windowFrame(scene, opening, toon([60, 42, 38]), 0.18, 0.07, 3, 2, 0.22);
    const glows: Glow[] = [];
    const flick = (t: number, ph: number) => 0.82 + 0.1 * Math.sin(t * 7.1 + ph) + 0.08 * Math.sin(t * 12.7 + ph * 2);
    const lit = (env: Environment) => clamp(Math.max(env.lamp * 1.15, env.night * 0.9, 0.2));

    // A deep window ledge, with cushions, books, candles, a mug and a plant.
    const ledge = opening.sill;
    box(scene, opening.w + 0.3, 0.06, 0.62, toon([128, 92, 72]), 0, ledge - 0.02, -0.02);
    const ivory = toon([232, 220, 200]), rose = toon([196, 132, 120]), sage = toon([150, 160, 130]);
    cushion(scene, 0.42, 0.4, 0.14, ivory, -1.15, ledge + 0.21, 0.02).rotation.set(-0.3, 0.3, 0.1);
    cushion(scene, 0.36, 0.34, 0.13, rose, -0.85, ledge + 0.18, 0.06).rotation.set(-0.3, 0.1, -0.12);
    cushion(scene, 0.4, 0.38, 0.14, sage, 1.2, ledge + 0.2, 0.04).rotation.set(-0.3, -0.25, -0.08);
    let by = ledge + 0.01;
    for (const [w, h, c] of [[0.28, 0.05, [168, 84, 70]], [0.25, 0.04, [222, 206, 176]], [0.27, 0.05, [92, 104, 140]]] as [number, number, RGB][]) {
      box(scene, w, h, 0.2, toon(c), 0.55, by + h / 2, 0.08);
      by += h;
    }
    const candleM = toon([240, 226, 200]);
    const flameM = new THREE.MeshBasicMaterial({ color: rgb([255, 216, 140]), toneMapped: false });
    for (const [x, z, h] of [[-0.35, 0.12, 0.14], [-0.26, 0.05, 0.09], [-0.44, 0.02, 0.07], [0.82, 0.12, 0.11], [0.92, 0.05, 0.07]] as const) {
      solid(scene, new THREE.CylinderGeometry(0.028, 0.028, h, 20), candleM, x, ledge + 0.01 + h / 2, z);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), flameM);
      f.scale.set(1, 2.2, 1);
      f.position.set(x, ledge + 0.03 + h, z);
      scene.add(f);
      glows.push({ at: f.position.clone(), radius: 0.22, color: () => WARM, level: (env, t) => lit(env) * 0.7 * flick(t, x * 9) });
    }
    solid(scene, new THREE.CylinderGeometry(0.04, 0.036, 0.09, 20), toon([70, 80, 96]), 0.2, ledge + 0.055, 0.14);
    const plant = leafyPlant(scene, [60, 92, 76], [176, 120, 96], 0.35, 3);
    plant.scale.setScalar(0.6);
    plant.position.set(-1.45, ledge + 0.01, -0.02);
    const candleLight = new THREE.PointLight(0xffb070, 0, 0, 2);
    candleLight.position.set(0, ledge + 0.35, 0.45);
    scene.add(candleLight);

    // Fairy lights: a swag along the top of the window and a strand down the right side.
    const bulbM = new THREE.MeshBasicMaterial({ color: rgb([255, 214, 150]), toneMapped: false });
    const wire = toon([40, 34, 30]);
    const top = opening.sill + opening.h - 0.04;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28, swag = Math.sin(u * Math.PI * 3);
      pts.push(new THREE.Vector3(-opening.w / 2 + u * opening.w, top - 0.08 * Math.abs(swag), 0.04));
    }
    for (let i = 1; i <= 10; i++) pts.push(new THREE.Vector3(opening.w / 2 + 0.05 + Math.sin(i) * 0.02, top - i * 0.13, 0.05));
    solid(scene, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.003, 4), wire, 0, 0, 0).castShadow = false;
    pts.forEach((p, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), bulbM);
      b.position.copy(p).add(new THREE.Vector3(0, -0.015, 0.005));
      scene.add(b);
      glows.push({ at: b.position.clone(), radius: 0.09, color: () => [255, 200, 130], level: (env, t) => lit(env) * (0.75 + 0.25 * Math.sin(t * (0.7 + (i % 5) * 0.2) + i)) });
    });

    // The fireplace on the right wall.
    const fp = new THREE.Group();
    fp.position.set(1.95, 0, 1.15);
    fp.rotation.y = -Math.PI / 2;
    scene.add(fp);
    const stone = toon([214, 200, 182]);
    box(fp, 0.28, 1.0, 0.4, stone, -0.43, 0.5, 0.2);
    box(fp, 0.28, 1.0, 0.4, stone, 0.43, 0.5, 0.2);
    box(fp, 0.58, 0.42, 0.4, stone, 0, 0.79, 0.2);
    box(fp, 0.62, 0.6, 0.04, toon([34, 26, 24]), 0, 0.3, 0.02);
    box(fp, 1.3, 0.05, 0.55, toon([90, 64, 52]), 0, 0.025, 0.27);
    box(fp, 1.3, 0.06, 0.48, toon([120, 84, 64]), 0, 1.03, 0.22);
    box(fp, 0.95, 1.74, 0.32, stone, 0, 1.93, 0.16);
    const logM = toon([92, 60, 44]);
    for (const [x, r] of [[-0.1, 0.4], [0.1, -0.4]] as const) {
      const log = solid(fp, new THREE.CylinderGeometry(0.045, 0.045, 0.4, 12), logM, x, 0.1, 0.2);
      log.rotation.set(Math.PI / 2, 0, r);
    }
    const fireM = [new THREE.MeshBasicMaterial({ color: rgb([255, 120, 40]), toneMapped: false }), new THREE.MeshBasicMaterial({ color: rgb([255, 200, 90]), toneMapped: false })];
    for (const [x, h, k] of [[-0.12, 0.26, 0], [0, 0.34, 0], [0.12, 0.24, 0], [-0.05, 0.18, 1], [0.06, 0.2, 1]] as const) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 - k * 0.025, h, 10), fireM[k]!);
      f.position.set(x, 0.13 + h / 2, 0.2 + k * 0.03);
      fp.add(f);
    }
    for (const [x, h] of [[-0.45, 0.12], [-0.37, 0.08], [0.42, 0.1]] as const) {
      solid(fp, new THREE.CylinderGeometry(0.03, 0.03, h, 16), candleM, x, 1.06 + h / 2, 0.25);
    }
    const fire = new THREE.PointLight(0xff8a40, 0, 0, 2);
    fp.add(fire);
    fire.position.set(0, 0.3, 1.0);
    fp.updateMatrixWorld(true);
    const fireAt = fp.localToWorld(new THREE.Vector3(0, 0.3, 0.3));
    const fireOn = (env: Environment) => clamp(Math.max(env.fire, lit(env) * 0.9));
    glows.push({ at: fireAt, radius: 0.7, color: () => [255, 130, 60], level: (env, t) => fireOn(env) * 0.6 * flick(t * 0.8, 0) });

    // The bed, looking toward the window.
    const bx = -0.4, bz0 = 1.15, bz1 = 3.2, bw = 1.9, cz = (bz0 + bz1) / 2, L = bz1 - bz0;
    box(scene, bw + 0.08, 0.28, L + 0.04, toon([110, 78, 62]), bx, 0.14, cz);
    rounded(scene, bw, 0.22, L, 0.05, toon([226, 214, 196]), bx, 0.39, cz);
    // A big, rumpled duvet.
    const duvetGeo = new THREE.BoxGeometry(bw + 0.14, 0.16, L * 0.78, 40, 4, 40);
    const dp = duvetGeo.attributes.position!;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), y = dp.getY(i), z = dp.getZ(i);
      const bump = 0.028 * Math.sin(x * 6 + z * 2) + 0.022 * Math.sin(z * 7 - x * 3) + 0.012 * Math.sin(x * 13 + z * 11);
      const edge = Math.min(1, (bw / 2 + 0.07 - Math.abs(x)) / 0.25);
      dp.setY(i, y > 0 ? y + bump * edge + 0.04 * edge : y - (1 - edge) * 0.12);
    }
    duvetGeo.computeVertexNormals();
    solid(scene, duvetGeo, toon([238, 226, 210]), bx, 0.56, bz0 + L * 0.39 - 0.02);
    // Pillows at the near end, and a knitted throw across the foot.
    cushion(scene, 0.7, 0.4, 0.18, toon([240, 232, 218]), bx - 0.45, 0.66, bz1 - 0.25).rotation.set(-1.2, 0, 0.05);
    cushion(scene, 0.7, 0.4, 0.18, toon([230, 220, 204]), bx + 0.4, 0.66, bz1 - 0.22).rotation.set(-1.2, 0, -0.05);

    // A little light in the ceiling.
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), bulbM);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(-0.4, 2.79, 1.0);
    scene.add(ceil);
    glows.push({ at: ceil.position.clone(), radius: 0.25, color: () => [255, 210, 150], level: (env) => lit(env) * 0.7 });

    // A record player on the ledge while music plays.
    const art = new AlbumArt();
    const deck = turntable(scene, art, toon([196, 160, 130]), true);
    deck.group.position.set(-0.05, ledge + 0.01, 0.06);

    return {
      update(env) {
        const on = lit(env);
        candleLight.intensity = 1.2 * on;
        candleLight.color.copy(rgb(mixRGB(env.lampColor, WARM, 0.5)));
        fire.intensity = 1.8 * fireOn(env);
        bulbM.color.copy(rgb(mixRGB([150, 140, 120], [255, 214, 150], on)));
        return deck.update(env);
      },
      signature: (env) => [lit(env), fireOn(env), ...env.lampColor.map((v) => v / 255)],
      glows,
    };
  },
};
