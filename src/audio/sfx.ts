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
 *  - tear: ripping paper             (pack strip peel)
 *  - whoosh: soft air sweep          (card slides out)
 *  - reveal: sparkle arpeggio        (card turns face up; brighter for rarer tiers via revealTier)
 *  - stamp: rubber-stamp thunk       (WELCOME TO THE CLUB)
 *  - tackle: boot-on-boot clack      (won tackles)
 *  - ooh: crowd groan                (a miss / off the woodwork)
 *  - post: metallic ping             (woodwork)
 *  - cheer: short crowd lift         (win at full time, placing a new signing)
 *  - peep: one short whistle blast   (fouls)
 *  - swish: quick air flick          (skill moves)
 * Audio only starts after a user gesture (browser policy) and respects the SFX setting.
 */
export type SfxName = 'tap' | 'flip' | 'pop' | 'thud' | 'chime' | 'whistle' | 'kick' | 'goal' | 'save' | 'coin' | 'tear' | 'whoosh' | 'reveal' | 'stamp' | 'tackle' | 'ooh' | 'post' | 'cheer' | 'peep' | 'swish';

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

function noise(c: AudioContext, duration: number, from: number, to: number, peak: number, delay = 0, q = 1.2): void {
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
  f.Q.value = q;
  const t = c.currentTime + delay;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + duration);
  src.connect(f);
  f.connect(envGain(c, peak, duration * 0.3, duration * 0.7, t));
  src.start(t);
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
    case 'tear':
      // Several short, bright rips in quick succession read as paper.
      for (let i = 0; i < 5; i++) noise(c, 0.05 + (i % 2) * 0.03, 2400 + i * 300, 5200, 0.2, i * 0.045, 2.5);
      break;
    case 'whoosh':
      noise(c, 0.3, 300, 2400, 0.14);
      break;
    case 'reveal':
      revealArpeggio(c, 0);
      break;
    case 'stamp':
      tone(c, 'sine', 160, 70, 0.32, 0.003, 0.12);
      noise(c, 0.06, 700, 300, 0.16);
      break;
    case 'tackle':
      tone(c, 'square', 420, 180, 0.06, 0.002, 0.05);
      noise(c, 0.07, 1500, 600, 0.1);
      break;
    case 'ooh':
      noise(c, 0.9, 900, 380, 0.16, 0, 3);
      noise(c, 0.9, 1300, 520, 0.08, 0.04, 3);
      break;
    case 'post':
      tone(c, 'sine', 1880, 1840, 0.12, 0.002, 0.5);
      tone(c, 'sine', 2730, 2700, 0.05, 0.002, 0.35);
      break;
    case 'cheer':
      noise(c, 1.1, 700, 1600, 0.2, 0, 0.8);
      noise(c, 0.8, 1800, 2600, 0.08, 0.15, 1.5);
      break;
    case 'peep':
      tone(c, 'square', 2350, 2300, 0.06, 0.004, 0.16);
      break;
    case 'swish':
      noise(c, 0.16, 1800, 5200, 0.12, 0, 2);
      noise(c, 0.12, 2600, 6000, 0.08, 0.1, 2);
      break;
    case 'chime':
      tone(c, 'sine', 784, 784, 0.16, 0.01, 0.22);
      tone(c, 'sine', 1175, 1175, 0.16, 0.01, 0.3, 0.09);
      break;
  }
}

const TIER_STEPS: Readonly<Record<string, number>> = { street: 2, prospect: 3, breakout: 4, star: 5, phenomenon: 6 };

function revealArpeggio(c: AudioContext, extra: number): void {
  const notes = [784, 988, 1175, 1568, 1976, 2349];
  const steps = Math.min(notes.length, 3 + extra);
  for (let i = 0; i < steps; i++) tone(c, 'triangle', notes[i] as number, notes[i] as number, 0.09, 0.004, 0.22, i * 0.07);
}

/** The reveal sparkle grows one note per tier: rarity is heard as well as seen, never only colour. */
export function playReveal(tier: string): void {
  if (!enabled || !ctx || ctx.state !== 'running' || volume <= 0) return;
  revealArpeggio(ctx, (TIER_STEPS[tier] ?? 2) - 2);
  if ((TIER_STEPS[tier] ?? 0) >= 4) noise(ctx, 1.2, 700, 1700, 0.14, 0.25, 0.8);
}
