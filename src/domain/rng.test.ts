import { describe, expect, it } from 'vitest';
import { createRng, hashString, seededUuid, stream } from './rng';

describe('seeded RNG', () => {
  it('produces an identical sequence for the same seed', () => {
    const a = createRng('club-42');
    const b = createRng('club-42');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds and between named streams', () => {
    expect(createRng('a').next()).not.toEqual(createRng('b').next());
    expect(stream('x', 'identity').next()).not.toEqual(stream('x', 'appearance').next());
  });

  it('is pinned to known values (guards against accidental algorithm changes)', () => {
    expect(hashString('touchline')).toMatchInlineSnapshot(`
      [
        3312299922,
        1146973308,
        977028986,
        2027686325,
      ]
    `);
    const r = createRng('touchline');
    expect([r.int(1, 100), r.int(1, 100), r.int(1, 100)]).toMatchInlineSnapshot(`
      [
        20,
        22,
        80,
      ]
    `);
  });

  it('stays within bounds and tracks draws', () => {
    const r = createRng('bounds');
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(-3, 3);
      expect(Number.isInteger(n) && n >= -3 && n <= 3).toBe(true);
      const g = r.normal(50, 10);
      expect(g).toBeGreaterThanOrEqual(15);
      expect(g).toBeLessThanOrEqual(85);
    }
    expect(r.draws).toBe(5000 * 4);
  });

  it('weighted sampling follows weights', () => {
    const r = createRng('weights');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 30000; i++) counts[r.weighted([['a', 1], ['b', 2], ['c', 7]] as const)]++;
    expect(counts.a / 30000).toBeCloseTo(0.1, 1);
    expect(counts.b / 30000).toBeCloseTo(0.2, 1);
    expect(counts.c / 30000).toBeCloseTo(0.7, 1);
  });

  it('rejects invalid input', () => {
    const r = createRng('x');
    expect(() => r.pick([])).toThrow();
    expect(() => r.weighted([['a', 0]] as const)).toThrow();
    expect(() => r.int(5, 1)).toThrow();
  });

  it('builds stable RFC-4122 shaped ids', () => {
    const id = seededUuid('player-1');
    expect(id).toBe(seededUuid('player-1'));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
