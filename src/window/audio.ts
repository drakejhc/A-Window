/** Procedural Web Audio ambience. Continuous beds (rain, wind, room hum, fire) follow the environment;
 *  short events (taps on the glass, crackles, passing cars, crickets, birds, thunder) are scheduled on a
 *  100 ms tick. No audio files. Reads the environment, never writes it. */
import type { Environment } from "./environment";
import type { SoundMix } from "../scenes";
import type { AmbienceWeights } from "./types";
import { clamp } from "./util";

const TICK = 0.1;
type Bed = { gain: GainNode; filters: BiquadFilterNode[] };

export class Ambience {
  enabled = false;
  private ctx: AudioContext | null = null;
  private volume = 0.6;
  private duck = 1;
  private env: Environment | null = null;
  private weights: AmbienceWeights = { rain: 1, wind: 1, city: 1, fire: 1, crickets: 1, birds: 1 };
  private timer: number | undefined;
  private master!: GainNode;
  private white!: AudioBuffer;
  private brown!: AudioBuffer;
  private beds!: { rain: Bed; patter: Bed; wind: Bed; hum: Bed; fire: Bed; cafe: Bed; hiss: Bed };
  private mix: SoundMix = {};
  private gustDepth!: GainNode;
  private swellDepth!: GainNode;

  setEnv(env: Environment) {
    this.env = env;
  }
  setWeights(w: AmbienceWeights) {
    this.weights = w;
  }
  /** Your own levels for some sounds, in place of the scene's. */
  setMix(m: SoundMix) {
    this.mix = m;
  }

  /** Starts (or resumes) the sound. Browsers keep it silent until the page has had a click or key press. */
  start() {
    if (!this.ctx) this.build();
    this.enabled = true;
    void this.ctx?.resume().catch(() => {});
    this.applyVolume();
    this.timer ??= window.setInterval(() => this.tick(), TICK * 1000);
  }

  stop() {
    this.enabled = false;
    this.applyVolume();
    window.setTimeout(() => {
      if (!this.enabled) void this.ctx?.suspend().catch(() => {});
    }, 1200);
  }

  /** Called on a user gesture so a sound that was blocked by autoplay rules can begin. */
  unlock() {
    if (this.enabled && this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyVolume();
  }

  /** Turns the ambience down (0..1) while something else is playing, like your music. */
  setDuck(level: number) {
    if (level === this.duck) return;
    this.duck = level;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.enabled ? this.volume * this.duck : 0, this.ctx.currentTime, 0.8);
  }

  private build() {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.white = this.noiseBuffer(false);
    this.brown = this.noiseBuffer(true);
    this.beds = {
      rain: this.bed(this.white, [
        ["highpass", 380, 0.7],
        ["lowpass", 3200, 0.5],
      ]),
      patter: this.bed(this.white, [["bandpass", 1500, 0.6]]),
      wind: this.bed(this.brown, [["bandpass", 380, 0.9]]),
      hum: this.bed(this.brown, [["lowpass", 200, 0.7]]),
      fire: this.bed(this.brown, [["lowpass", 420, 0.7]]),
      // A room of voices too far off to make out: low, round and slowly swelling.
      cafe: this.bed(this.brown, [
        ["bandpass", 520, 0.8],
        ["lowpass", 1400, 0.6],
      ]),
      hiss: this.bed(this.white, [["highpass", 5200, 0.5]]),
    };
    const swell = ctx.createOscillator(),
      swellDepth = ctx.createGain();
    swell.frequency.value = 0.07;
    swellDepth.gain.value = 0;
    swell.connect(swellDepth).connect(this.beds.cafe.gain.gain);
    swell.start();
    this.swellDepth = swellDepth;
    // Wind: a slow sweep of the band, with gusts riding on the level.
    const sweep = ctx.createOscillator(),
      sweepDepth = ctx.createGain();
    sweep.frequency.value = 0.06;
    sweepDepth.gain.value = 160;
    sweep.connect(sweepDepth).connect(this.beds.wind.filters[0]!.frequency);
    sweep.start();
    const gust = ctx.createOscillator();
    this.gustDepth = ctx.createGain();
    this.gustDepth.gain.value = 0;
    gust.frequency.value = 0.11;
    gust.connect(this.gustDepth).connect(this.beds.wind.gain.gain);
    gust.start();
  }

  /** Twelve seconds of stereo noise that loops without a seam: the end is cross-faded into the start over a
   *  second at equal power, so the level never dips at the join. */
  private noiseBuffer(brown: boolean) {
    const ctx = this.ctx!,
      sr = ctx.sampleRate,
      len = sr * 12,
      fade = sr;
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const raw = new Float32Array(len + fade);
      let last = 0;
      for (let i = 0; i < raw.length; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          raw[i] = last * 3.5;
        } else raw[i] = w * 0.5;
      }
      const out = buf.getChannelData(ch);
      out.set(raw.subarray(0, len));
      for (let i = 0; i < fade; i++) {
        const u = (i / fade) * (Math.PI / 2);
        out[i] = raw[i]! * Math.sin(u) + raw[len + i]! * Math.cos(u);
      }
    }
    return buf;
  }

  private bed(buffer: AudioBuffer, chain: [BiquadFilterType, number, number][]): Bed {
    const ctx = this.ctx!;
    // Two copies of the loop, offset and at slightly different speeds, so its repeat is never heard.
    const mix = ctx.createGain();
    mix.gain.value = Math.SQRT1_2;
    for (const rate of [1, 0.971]) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.playbackRate.value = rate;
      src.connect(mix);
      src.start(0, Math.random() * buffer.duration);
    }
    let node: AudioNode = mix;
    const filters = chain.map(([type, freq, q]) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      node.connect(f);
      node = f;
      return f;
    });
    const gain = ctx.createGain();
    gain.gain.value = 0;
    node.connect(gain).connect(this.master);
    return { gain, filters };
  }

  private set(bed: Bed, v: number) {
    bed.gain.gain.setTargetAtTime(v, this.ctx!.currentTime, 1.2);
  }

  private tick() {
    const e = this.env,
      ctx = this.ctx;
    if (!this.enabled || !e || !ctx || ctx.state !== "running") return;
    const now = ctx.currentTime,
      mix = this.mix,
      base = this.weights;
    // Each sound at your level if you've set one, otherwise at the scene's.
    const w = {
      rain: mix.rain ?? base.rain,
      wind: mix.wind ?? base.wind,
      city: mix.city ?? base.city,
      fire: mix.fire ?? base.fire,
      crickets: mix.crickets ?? base.crickets,
      birds: mix.birds ?? base.birds,
      cafe: mix.cafe ?? base.cafe ?? 0,
      vinyl: mix.vinyl ?? base.vinyl ?? 0,
    };
    const wind = e.wind * 0.8 + e.snow * 0.1 + 0.04;
    this.set(this.beds.rain, e.rain * 0.32 * w.rain);
    this.set(this.beds.patter, e.rain * e.rain * 0.14 * w.rain);
    this.set(this.beds.wind, wind * 0.28 * w.wind);
    this.gustDepth.gain.setTargetAtTime(wind * 0.12 * w.wind, now, 1.2);
    this.set(this.beds.hum, (0.025 + 0.05 * e.dayness) * w.city * (1 - 0.5 * e.snow));
    this.set(this.beds.fire, e.fire * 0.07 * w.fire);
    this.set(this.beds.cafe, 0.09 * w.cafe);
    this.swellDepth.gain.setTargetAtTime(0.03 * w.cafe, now, 1.2);
    this.set(this.beds.hiss, 0.01 * w.vinyl);

    const chance = (perSecond: number) => Math.random() < perSecond * TICK;
    const at = () => now + Math.random() * TICK;
    if (chance(e.rain * 6 * w.rain)) this.tap(at());
    for (let i = 0; i < 3; i++) if (chance(e.fire * 5 * w.fire)) this.crackle(at());
    if (chance((0.03 + 0.05 * e.dayness) * (1 - e.snow * 0.6) * w.city)) this.carPass(at());
    if (chance(0.35 * w.cafe)) this.clink(at());
    for (let i = 0; i < 4; i++) if (chance(5 * w.vinyl)) this.pop(at());
    const dry = e.rain < 0.05 && e.snow < 0.05;
    const warmSeason =
      e.season === "summer" || e.season === "autumn" || (e.season === "spring" && e.temp > 16);
    if (dry && warmSeason && e.temp > 13 && e.night > 0.7 && chance(0.9 * w.crickets))
      this.cricket(at());
    const dawn = e.sunAlt > -4 && e.sunAlt < 14 && e.localHour < 12;
    if (
      dry &&
      (e.season === "spring" || e.season === "summer") &&
      e.dayness > 0.3 &&
      chance((dawn ? 0.3 : 0.05) * w.birds)
    )
      this.bird(at());
  }

  private panner(pan: number): AudioNode {
    const ctx = this.ctx!;
    if (!ctx.createStereoPanner) return ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    return p;
  }

  private burst(
    t: number,
    o: {
      dur: number;
      type: BiquadFilterType;
      freq: number;
      q?: number;
      peak: number;
      pan?: number;
      brown?: boolean;
    },
  ) {
    const ctx = this.ctx!,
      src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = o.brown ? this.brown : this.white;
    f.type = o.type;
    f.frequency.value = o.freq;
    f.Q.value = o.q ?? 1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src
      .connect(f)
      .connect(g)
      .connect(this.panner(o.pan ?? 0))
      .connect(this.master);
    src.start(t, Math.random() * 3, o.dur + 0.05);
  }

  private tap(t: number) {
    this.burst(t, {
      dur: 0.03,
      type: "bandpass",
      freq: 2200 + Math.random() * 3500,
      q: 6,
      peak: 0.05 + Math.random() * 0.08,
      pan: Math.random() * 1.4 - 0.7,
    });
  }

  /** A cup set down on a saucer somewhere across the room. */
  private clink(t: number) {
    const ctx = this.ctx!,
      o = ctx.createOscillator(),
      g = ctx.createGain(),
      f = 2400 + Math.random() * 2200;
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.985, t + 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.018, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.panner(Math.random() * 1.6 - 0.8)).connect(this.master);
    o.start(t);
    o.stop(t + 0.4);
  }

  /** A speck of dust under the needle. */
  private pop(t: number) {
    this.burst(t, {
      dur: 0.004 + Math.random() * 0.006,
      type: "highpass",
      freq: 2500 + Math.random() * 3000,
      peak: 0.02 + Math.random() * Math.random() * 0.1,
      pan: (Math.random() - 0.5) * 0.3,
    });
  }

  private crackle(t: number) {
    this.burst(t, {
      dur: 0.012 + Math.random() * 0.02,
      type: "highpass",
      freq: 1200 + Math.random() * 2000,
      peak: 0.03 + Math.random() * Math.random() * 0.22,
      pan: -0.55 + Math.random() * 0.3,
    });
  }

  private carPass(t: number) {
    const ctx = this.ctx!,
      src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    const p = this.panner(0),
      dir = Math.random() < 0.5 ? -1 : 1,
      dur = 5 + Math.random() * 3;
    src.buffer = this.brown;
    src.loop = true;
    f.type = "bandpass";
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(720, t + dur / 2);
    f.frequency.linearRampToValueAtTime(280, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t + dur / 2);
    g.gain.linearRampToValueAtTime(0, t + dur);
    if (p instanceof StereoPannerNode) {
      p.pan.setValueAtTime(-0.85 * dir, t);
      p.pan.linearRampToValueAtTime(0.85 * dir, t + dur);
    }
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.1);
  }

  private cricket(t: number) {
    const ctx = this.ctx!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.value = 4300 + Math.random() * 500;
    g.gain.value = 0;
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.065;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.012, s + 0.008);
      g.gain.linearRampToValueAtTime(0, s + 0.03);
    }
    o.connect(g)
      .connect(this.panner(Math.random() * 1.6 - 0.8))
      .connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  private bird(t: number) {
    const ctx = this.ctx!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    g.gain.value = 0;
    let s = t;
    const notes = 2 + ((Math.random() * 4) | 0),
      base = 2600 + Math.random() * 1500;
    for (let i = 0; i < notes; i++) {
      const d = 0.06 + Math.random() * 0.06,
        f0 = base + (Math.random() - 0.5) * 900;
      o.frequency.setValueAtTime(f0, s);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.75 + Math.random() * 0.6), s + d);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.018, s + 0.01);
      g.gain.linearRampToValueAtTime(0, s + d);
      s += d + 0.04 + Math.random() * 0.05;
    }
    o.connect(g)
      .connect(this.panner(Math.random() * 1.6 - 0.8))
      .connect(this.master);
    o.start(t);
    o.stop(s + 0.05);
  }

  /** distance 0 (close) .. 1 (far): further strikes arrive later, quieter and duller. */
  thunder(distance: number) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.6 + distance * 4;
    const src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    const peak = 0.5 * (1 - distance * 0.55),
      dur = 4 + Math.random() * 2;
    src.buffer = this.brown;
    src.loop = true;
    f.type = "lowpass";
    f.frequency.setValueAtTime(220 - distance * 80, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.1);
    if (distance < 0.4)
      this.burst(t - 0.05, { dur: 0.5, type: "lowpass", freq: 1400, peak: 0.25, brown: true });
  }

  /** A soft bell for the end of a session; plays even when the ambience is off. */
  chime() {
    if (!this.ctx) this.build();
    const ctx = this.ctx;
    if (!ctx) return;
    void ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.05,
      vol = Math.max(0.3, this.volume);
    for (const [fr, a] of [
      [523.25, 0.12],
      [1046.5, 0.05],
      [1568, 0.03],
    ] as const) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = fr;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 3.6);
    }
  }
}
