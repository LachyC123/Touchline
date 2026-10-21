/**
 * Deterministic seeded randomness.
 *
 * - `hashString` turns any string seed into four 32-bit words (cyrb128).
 * - `createRng` builds a mulberry32 stream from a string seed.
 * - Streams are separated by label (`stream(seed, 'identity')`) so that, for example,
 *   cosmetic choices can never shift football or reward outcomes.
 *
 * Pure module: no Date, no Math.random, no DOM.
 */

export function hashString(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** Approximately normal sample (Box–Muller), clamped to ±3.5σ. */
  normal(mean: number, sd: number): number;
  shuffle<T>(items: readonly T[]): T[];
  /** Number of values drawn so far — useful for checkpoint/replay assertions. */
  readonly draws: number;
}

class Mulberry32 implements Rng {
  private state: number;
  private count = 0;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  get draws(): number {
    return this.count;
  }

  next(): number {
    this.count++;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError(`Invalid int range ${min}..${max}`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Cannot pick from an empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of entries) {
      if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError('Weights must be finite and >= 0');
      total += w;
    }
    if (total <= 0) throw new RangeError('Weights must not all be zero');
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= w;
      if (roll < 0) return value;
    }
    // Floating-point fallthrough: return the last positively weighted entry.
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as readonly [T, number];
      if (entry[1] > 0) return entry[0];
    }
    throw new RangeError('Unreachable');
  }

  normal(mean: number, sd: number): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * Math.max(-3.5, Math.min(3.5, z));
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}

export function createRng(seed: string): Rng {
  const [a, b, c, d] = hashString(seed);
  return new Mulberry32((a ^ b ^ c ^ d) >>> 0);
}

/** Named, independent stream derived from a base seed. */
export type StreamLabel =
  | 'identity'
  | 'appearance'
  | 'attributes'
  | 'personality'
  | 'match'
  | 'reward'
  | 'visual'
  | 'roster'
  | 'shootout'
  | 'cup'
  | 'story';

export function stream(seed: string, label: StreamLabel | `${StreamLabel}:${string}`): Rng {
  return createRng(`${seed}::${label}`);
}

/** Deterministic RFC 4122-shaped id (version nibble 4) derived from a seed. */
export function seededUuid(seed: string): string {
  const words = hashString(`uuid::${seed}`);
  const extra = hashString(`uuid2::${seed}`);
  const hex = [...words, ...extra].map((w) => w.toString(16).padStart(8, '0')).join('');
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Non-deterministic entropy for brand-new careers only (never used in simulation). */
export function freshSeed(): string {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
