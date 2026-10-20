/**
 * Tiny procedural sound grammar (Web Audio, no sample files, nothing to license).
 *  - tap:   short woody tick         (every button)
 *  - flip:  airy card whoosh         (card flip / page turn)
 *  - pop:   bright pluck             (toggle on, favourite)
 *  - thud:  soft low knock           (toggle off, back)
 *  - chime: two-note rise            (success / save secured)
 *  - whistle: referee trill          (kick-off, half-time, full time)
 *  - kick: short leather thud        (shots)
 *  - goal: crowd swell + rising triad
 *  - save: low glove thump
 *  - coin: bright tick               (reward count-up)
 * Audio only starts after a user gesture (browser policy) and respects the SFX setting.
 */
export type SfxName = 'tap' | 'flip' | 'pop' | 'thud' | 'chime' | 'whistle' | 'kick' | 'goal' | 'save' | 'coin';

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.7;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.7));
}

/** Call from a user gesture handler. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function envGain(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * volume), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(c.destination);
  return g;
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number, delay = 0): void {
  const o = c.createOscillator();
  o.type = type;
  const t = c.currentTime + delay;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  o.connect(envGain(c, peak, attack, decay, t));
  o.start(t);
  o.stop(t + attack + decay + 0.05);
}

function noise(c: AudioContext, duration: number, from: number, to: number, peak: number): void {
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + duration);
  src.connect(f);
  f.connect(envGain(c, peak, duration * 0.3, duration * 0.7));
  src.start();
}

export function playSfx(name: SfxName): void {
  if (!enabled || !ctx || ctx.state !== 'running' || volume <= 0) return;
  const c = ctx;
  switch (name) {
    case 'tap':
      tone(c, 'triangle', 900, 520, 0.18, 0.004, 0.06);
      break;
    case 'flip':
      noise(c, 0.22, 600, 3200, 0.22);
      break;
    case 'pop':
      tone(c, 'sine', 660, 990, 0.2, 0.005, 0.12);
      break;
    case 'thud':
      tone(c, 'sine', 220, 120, 0.22, 0.005, 0.1);
      break;
    case 'whistle':
      for (let i = 0; i < 3; i++) tone(c, 'square', 2300, 2250, 0.05, 0.005, 0.07, i * 0.09);
      tone(c, 'square', 2300, 2200, 0.06, 0.005, 0.28, 0.3);
      break;
    case 'kick':
      tone(c, 'sine', 180, 60, 0.35, 0.003, 0.09);
      noise(c, 0.05, 1800, 900, 0.12);
      break;
    case 'goal':
      noise(c, 1.4, 500, 1400, 0.22);
      tone(c, 'triangle', 523, 523, 0.14, 0.02, 0.4, 0.05);
      tone(c, 'triangle', 659, 659, 0.14, 0.02, 0.4, 0.2);
      tone(c, 'triangle', 784, 784, 0.16, 0.02, 0.6, 0.35);
      break;
    case 'save':
      tone(c, 'sine', 140, 90, 0.3, 0.004, 0.12);
      noise(c, 0.08, 900, 400, 0.12);
      break;
    case 'coin':
      tone(c, 'sine', 1320, 1760, 0.08, 0.003, 0.06);
      break;
    case 'chime':
      tone(c, 'sine', 784, 784, 0.16, 0.01, 0.22);
      tone(c, 'sine', 1175, 1175, 0.16, 0.01, 0.3, 0.09);
      break;
  }
}
