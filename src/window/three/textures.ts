/** Textures painted on 2D canvases at start-up, so the 3D rooms need no image files. */
import * as THREE from "three";

import { makeRng, type RGB } from "../util";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export function toTexture(c: HTMLCanvasElement, repeat?: [number, number], color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** Adds fine per-pixel grain. */
function grain(x: CanvasRenderingContext2D, w: number, h: number, amount: number, seed: number) {
  const rng = makeRng(seed), img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  x.putImageData(img, 0, 0);
}

/** Soft blotchy plaster that tiles. */
export function plaster(base: RGB, seed = 1) {
  const S = 512, [c, x] = canvas(S, S), rng = makeRng(seed);
  x.fillStyle = css(base);
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const r = 16 + rng() * 90, px = rng() * S, py = rng() * S, light = rng() < 0.5;
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S]) {
        const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
        g.addColorStop(0, light ? "rgba(255,255,255,0.022)" : "rgba(60,40,20,0.02)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        x.fillStyle = g;
        x.fillRect(px + dx - r, py + dy - r, r * 2, r * 2);
      }
  }
  grain(x, S, S, 5, seed + 1);
  return c;
}

/** Wood grain running along x. `planks` > 0 adds seams and a slightly different tone per plank. */
export function wood(base: RGB, seed = 2, planks = 0, w = 1024, h = 512) {
  const [c, x] = canvas(w, h), rng = makeRng(seed);
  x.fillStyle = css(base);
  x.fillRect(0, 0, w, h);
  const rows = planks || 1, ph = h / rows;
  for (let p = 0; p < rows; p++) {
    const tint = 0.9 + rng() * 0.2;
    x.fillStyle = css([base[0] * tint, base[1] * tint, base[2] * tint]);
    x.fillRect(0, p * ph, w, ph);
    for (let k = 0; k < 70; k++) {
      const y0 = p * ph + rng() * ph, a = 1 + rng() * 5, f = 0.002 + rng() * 0.006, phase = rng() * 6;
      x.strokeStyle = rng() < 0.65 ? `rgba(40,20,8,${0.06 + rng() * 0.14})` : `rgba(255,230,190,${0.04 + rng() * 0.07})`;
      x.lineWidth = 0.6 + rng() * 2.4;
      x.beginPath();
      for (let px = 0; px <= w; px += 8) {
        const y = y0 + Math.sin(px * f + phase) * a + Math.sin(px * f * 3.1 + phase * 2) * a * 0.3;
        if (px) x.lineTo(px, y);
        else x.moveTo(px, y);
      }
      x.stroke();
    }
    if (planks) {
      x.fillStyle = "rgba(20,10,4,0.55)";
      x.fillRect(0, p * ph, w, 2);
      const seam = rng() * w;
      x.fillRect(seam, p * ph, 2, ph);
    }
  }
  // Long streaks: a narrow noise strip stretched along the grain.
  const [n, nx] = canvas(16, h);
  nx.fillStyle = "#808080";
  nx.fillRect(0, 0, 16, h);
  grain(nx, 16, h, 60, seed + 5);
  x.globalAlpha = 0.12;
  x.globalCompositeOperation = "overlay";
  x.drawImage(n, 0, 0, w, h);
  x.globalAlpha = 1;
  x.globalCompositeOperation = "source-over";
  grain(x, w, h, 5, seed + 9);
  return c;
}

/** Vinyl grooves, seen from above. */
export function grooves() {
  const S = 1024, [c, x] = canvas(S, S), rng = makeRng(7);
  x.fillStyle = "#0b0b0c";
  x.fillRect(0, 0, S, S);
  for (let r = S * 0.17; r < S * 0.495; r += 1.5) {
    const v = 10 + rng() * 14;
    x.strokeStyle = `rgb(${v},${v},${v + 1})`;
    x.lineWidth = 1;
    x.beginPath();
    x.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    x.stroke();
  }
  // Gaps between tracks.
  for (const k of [0.27, 0.34, 0.4, 0.45]) {
    x.strokeStyle = "#040404";
    x.lineWidth = 3;
    x.beginPath();
    x.arc(S / 2, S / 2, S * k, 0, Math.PI * 2);
    x.stroke();
  }
  return c;
}

/** A quiet print for the wall: a low sun over layered hills, on warm paper. */
export function print(seed = 3) {
  const w = 600, h = 760, [c, x] = canvas(w, h), rng = makeRng(seed);
  x.fillStyle = "#efe6d6";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#c8693f";
  x.beginPath();
  x.arc(w * 0.62, h * 0.38, w * 0.17, 0, Math.PI * 2);
  x.fill();
  const hills: RGB[] = [[150, 160, 150], [96, 116, 112], [62, 80, 84], [40, 52, 58]];
  hills.forEach((col, i) => {
    x.fillStyle = css(col);
    x.beginPath();
    const base = h * (0.5 + i * 0.1);
    x.moveTo(0, h);
    for (let px = 0; px <= w; px += 10) x.lineTo(px, base - Math.sin(px * 0.008 + i * 1.7 + rng()) * 30 - Math.sin(px * 0.021 + i) * 12);
    x.lineTo(w, h);
    x.fill();
  });
  grain(x, w, h, 14, seed);
  return c;
}

/** Cover art for the record that sits on the player when nothing is playing. */
export function defaultSleeve() {
  const S = 512, [c, x] = canvas(S, S);
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#1d2b3a");
  g.addColorStop(1, "#0e141c");
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    x.strokeStyle = `rgba(232,${150 + i * 10},${90 + i * 8},${0.85 - i * 0.07})`;
    x.lineWidth = 7;
    x.beginPath();
    x.arc(S * 0.5, S * 0.62, S * (0.08 + i * 0.035), Math.PI, 0);
    x.stroke();
  }
  x.fillStyle = "rgba(240,226,200,0.85)";
  x.font = "italic 34px Georgia, serif";
  x.fillText("Slow Hours", S * 0.08, S * 0.15);
  grain(x, S, S, 10, 4);
  return c;
}

/** A snake-plant leaf: dark green bands with a pale edge. */
export function leaf() {
  const w = 64, h = 512, [c, x] = canvas(w, h), rng = makeRng(11);
  x.fillStyle = "#3f6a3c";
  x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6 + rng() * 10) {
    x.strokeStyle = rng() < 0.5 ? "rgba(20,44,24,0.55)" : "rgba(140,170,110,0.35)";
    x.lineWidth = 2 + rng() * 4;
    x.beginPath();
    for (let px = 0; px <= w; px += 4) {
      const yy = y + Math.sin(px * 0.2 + y) * 3;
      if (px) x.lineTo(px, yy);
      else x.moveTo(px, yy);
    }
    x.stroke();
  }
  x.fillStyle = "rgba(214,200,110,0.9)";
  x.fillRect(0, 0, 4, h);
  x.fillRect(w - 4, 0, 4, h);
  return c;
}

/** Plain fabric weave for lamp shades and cushions. */
export function fabric(base: RGB, seed = 5) {
  const S = 256, [c, x] = canvas(S, S);
  x.fillStyle = css(base);
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    x.fillStyle = "rgba(0,0,0,0.035)";
    x.fillRect(i, 0, 1, S);
    x.fillStyle = "rgba(255,255,255,0.03)";
    x.fillRect(0, i, S, 1);
  }
  grain(x, S, S, 10, seed);
  return c;
}

/** Stacked round logs with dark chinking between them, `n` logs to the texture. */
export function logs(base: RGB, n = 6, seed = 12) {
  const w = 1024, h = 1024, [c, x] = canvas(w, h), rng = makeRng(seed);
  x.drawImage(wood(base, seed, 0, w, h), 0, 0);
  const lh = h / n;
  for (let i = 0; i < n; i++) {
    const y0 = i * lh, g = x.createLinearGradient(0, y0, 0, y0 + lh);
    g.addColorStop(0, "rgba(20,10,4,0.75)");
    g.addColorStop(0.1, "rgba(20,10,4,0.15)");
    g.addColorStop(0.4, "rgba(255,230,190,0.08)");
    g.addColorStop(0.75, "rgba(20,10,4,0.05)");
    g.addColorStop(0.94, "rgba(20,10,4,0.45)");
    g.addColorStop(1, "rgba(20,10,4,0.8)");
    x.fillStyle = g;
    x.fillRect(0, y0, w, lh);
    // The odd knot and check.
    for (let k = 0; k < (rng() < 0.5 ? 1 : 0); k++) {
      const kx = rng() * w, ky = y0 + lh * (0.3 + rng() * 0.4), r = 4 + rng() * 6;
      x.fillStyle = "rgba(60,30,12,0.3)";
      x.beginPath();
      x.ellipse(kx, ky, r * 1.6, r, 0, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "rgba(200,190,170,0.55)";
    x.fillRect(0, y0 - 2, w, 4);
  }
  return c;
}

/** Woven tatami with a dark cloth border along the long edges. */
export function tatami() {
  const w = 512, h = 1024, [c, x] = canvas(w, h), rng = makeRng(31);
  x.fillStyle = "#c9c08e";
  x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) {
    x.fillStyle = `rgba(${90 + rng() * 40},${100 + rng() * 30},${50 + rng() * 20},${0.15 + rng() * 0.15})`;
    x.fillRect(0, y, w, 1.5);
  }
  for (let xx = 0; xx < w; xx += 16) {
    x.fillStyle = "rgba(60,60,30,0.12)";
    x.fillRect(xx, 0, 1, h);
  }
  x.fillStyle = "#22201c";
  x.fillRect(0, 0, 26, h);
  x.fillRect(w - 26, 0, 26, h);
  grain(x, w, h, 10, 32);
  return c;
}

/** Square terracotta tiles with pale grout. */
export function tiles(n = 4, seed = 41) {
  const S = 1024, [c, x] = canvas(S, S), rng = makeRng(seed), t = S / n;
  x.fillStyle = "#d8c8b0";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const k = 0.85 + rng() * 0.25;
      x.fillStyle = css([186 * k, 104 * k, 70 * k]);
      x.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
      const g = x.createRadialGradient(i * t + t * rng(), j * t + t * rng(), 0, i * t + t / 2, j * t + t / 2, t * 0.7);
      g.addColorStop(0, "rgba(255,220,180,0.12)");
      g.addColorStop(1, "rgba(80,30,10,0.12)");
      x.fillStyle = g;
      x.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
    }
  grain(x, S, S, 14, seed);
  return c;
}

/** Shoji paper: warm white with faint fibres. */
export function paper(seed = 51) {
  const S = 256, [c, x] = canvas(S, S), rng = makeRng(seed);
  x.fillStyle = "#f3eee2";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    x.strokeStyle = `rgba(180,160,120,${0.08 + rng() * 0.1})`;
    x.lineWidth = 0.6;
    x.beginPath();
    const px = rng() * S, py = rng() * S;
    x.moveTo(px, py);
    x.quadraticCurveTo(px + (rng() - 0.5) * 30, py + (rng() - 0.5) * 30, px + (rng() - 0.5) * 50, py + (rng() - 0.5) * 50);
    x.stroke();
  }
  grain(x, S, S, 6, seed);
  return c;
}

/** Louvred shutter slats, painted. */
export function louvres(paint: RGB, n = 18) {
  const w = 256, h = 512, [c, x] = canvas(w, h), sh = h / n;
  for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(0, i * sh, 0, (i + 1) * sh);
    g.addColorStop(0, css([paint[0] * 1.15, paint[1] * 1.15, paint[2] * 1.15]));
    g.addColorStop(0.7, css(paint));
    g.addColorStop(1, css([paint[0] * 0.55, paint[1] * 0.55, paint[2] * 0.55]));
    x.fillStyle = g;
    x.fillRect(0, i * sh, w, sh);
  }
  grain(x, w, h, 12, 61);
  return c;
}

/** A hanging scroll: mountains in ink wash on silk, with a mounting border. */
export function inkScroll(seed = 71) {
  const w = 300, h = 900, [c, x] = canvas(w, h), rng = makeRng(seed);
  x.fillStyle = "#6f5b44";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#efe7d6";
  x.fillRect(24, 120, w - 48, h - 260);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = `rgba(40,40,44,${0.18 + i * 0.12})`;
    x.beginPath();
    const base = 300 + i * 120;
    x.moveTo(24, base + 200);
    for (let px = 24; px <= w - 24; px += 6) x.lineTo(px, base - Math.abs(Math.sin(px * 0.02 + i * 2 + rng())) * (80 - i * 12) - rng() * 6);
    x.lineTo(w - 24, base + 200);
    x.fill();
  }
  x.fillStyle = "#efe7d6";
  x.fillRect(24, h - 140 - 60, w - 48, 60);
  x.fillStyle = "#b03a2e";
  x.fillRect(w - 70, h - 230, 18, 18);
  grain(x, w, h, 10, seed);
  return c;
}

/** Cable knit, for cushions and throws. */
export function knit(base: RGB, seed = 81) {
  const S = 256, [c, x] = canvas(S, S);
  x.fillStyle = css(base);
  x.fillRect(0, 0, S, S);
  for (let col = 0; col < S; col += 32)
    for (let y = 0; y < S; y += 16) {
      for (const side of [-1, 1]) {
        x.fillStyle = side < 0 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.18)";
        x.beginPath();
        x.ellipse(col + 16 + side * 6, y + 8, 7, 9, side * 0.5, 0, Math.PI * 2);
        x.fill();
      }
    }
  grain(x, S, S, 14, seed);
  return c;
}

/** Fleece: lots of soft curls. */
export function fleece(seed = 91) {
  const S = 256, [c, x] = canvas(S, S), rng = makeRng(seed);
  x.fillStyle = "#ece4d4";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    x.strokeStyle = rng() < 0.5 ? "rgba(255,255,250,0.5)" : "rgba(150,130,100,0.25)";
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(rng() * S, rng() * S, 2 + rng() * 4, rng() * 6, rng() * 6 + 3);
    x.stroke();
  }
  return c;
}

/** Blue-and-white glaze: bands and a leafy scroll. */
export function blueware(seed = 101) {
  const w = 512, h = 256, [c, x] = canvas(w, h), rng = makeRng(seed);
  x.fillStyle = "#f2efe8";
  x.fillRect(0, 0, w, h);
  x.fillStyle = "#2f5a8e";
  x.fillRect(0, 20, w, 10);
  x.fillRect(0, h - 40, w, 8);
  x.strokeStyle = "#2f5a8e";
  x.lineWidth = 5;
  x.beginPath();
  for (let px = 0; px <= w; px += 4) x.lineTo(px, h / 2 + Math.sin(px * 0.05) * 30);
  x.stroke();
  for (let px = 10; px < w; px += 26) {
    x.fillStyle = "#3d6aa0";
    x.beginPath();
    x.ellipse(px, h / 2 + Math.sin(px * 0.05) * 30 - 18, 8, 14, rng(), 0, Math.PI * 2);
    x.fill();
  }
  return c;
}
