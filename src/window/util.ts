/** Small maths and colour helpers shared by the live window. */
export type RGB = [number, number, number];

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const mapRGB = (c: RGB, fn: (v: number, i: number) => number): RGB => [
  fn(c[0], 0),
  fn(c[1], 1),
  fn(c[2], 2),
];
export const scaleRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
/** Frame-rate independent easing toward a target with time constant tau (seconds). */
export const ease = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / tau));

export function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rng = ReturnType<typeof makeRng>;

/** Smooth 1D noise from a few summed sines; values roughly in [-1, 1]. */
export function makeNoise1D(rng: Rng, octaves = 4) {
  const waves = Array.from({ length: octaves }, (_, i) => ({
    f: Math.pow(2, i) * (0.8 + rng() * 0.4),
    p: rng() * Math.PI * 2,
    a: 1 / Math.pow(1.9, i),
  }));
  const norm = waves.reduce((s, w) => s + w.a, 0);
  return (x: number) =>
    waves.reduce((s, w) => s + Math.sin(x * w.f * Math.PI * 2 + w.p) * w.a, 0) / norm;
}
