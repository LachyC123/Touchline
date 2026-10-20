import { describe, expect, it } from 'vitest';
import { ARCHETYPE_BY_ID } from '../../data/archetypes';
import { NAME_POOLS, isNameAllowed } from '../../data/names';
import { DREAM_BY_ID, ORIGIN_BY_ID } from '../../data/personality';
import { TIER_DEFS } from '../../data/tiers';
import { TRAIT_BY_ID } from '../../data/traits';
import { footballerSchema } from '../../storage/schema';
import { createRng } from '../rng';
import { GENERATOR_VERSION, archetypeSubtitle, generateFootballer, rollTier } from './generator';
import { POSITION_WEIGHTS, overall } from './rating';
import { ATTRIBUTE_KEYS, TIERS, type Footballer, type Tier } from './types';

describe('player generator — determinism', () => {
  it('same seed + version produces identical fields and visual ids', () => {
    const a = generateFootballer({ seed: 'career-x:starter:3' });
    const b = generateFootballer({ seed: 'career-x:starter:3' });
    expect(a).toEqual(b);
    expect(a.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it('is pinned for a known seed (catches unversioned generator changes)', () => {
    const p = generateFootballer({ seed: 'pinned-seed-001' });
    expect({
      name: `${p.firstName} ${p.lastName}`,
      position: p.primaryPosition,
      tier: p.tier,
      ovr: overall(p),
      appearance: p.appearance,
    }).toMatchSnapshot();
  });

  it('different seeds produce different players', () => {
    const a = generateFootballer({ seed: 'one' });
    const b = generateFootballer({ seed: 'two' });
    expect(a.id).not.toBe(b.id);
    expect(JSON.stringify(a.appearance) + a.firstName + a.lastName).not.toBe(JSON.stringify(b.appearance) + b.firstName + b.lastName);
  });

  it('honours requested tier, position, age range and target rating', () => {
    for (let i = 0; i < 50; i++) {
      const p = generateFootballer({ seed: `req-${i}`, tier: 'star', position: 'DEF', ageRange: [18, 20], targetOvr: 60 });
      expect(p.tier).toBe('star');
      expect(p.primaryPosition).toBe('DEF');
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(20);
      expect(Math.abs(overall(p) - 60)).toBeLessThanOrEqual(1);
    }
  });
});

describe('player generator — 10k diversity smoke test', () => {
  const N = 10_000;
  const players: Footballer[] = Array.from({ length: N }, (_, i) => generateFootballer({ seed: `diversity-${i}` }));

  it('every player passes the persisted-save schema (valid asset ids, bounded stats)', () => {
    for (const p of players) {
      const r = footballerSchema.safeParse(p);
      if (!r.success) throw new Error(`${p.generatedSeed}: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    }
  });

  it('has no duplicate ids and broad name / face variety', () => {
    expect(new Set(players.map((p) => p.id)).size).toBe(N);
    const names = new Set(players.map((p) => `${p.firstName} ${p.lastName}`));
    expect(names.size).toBeGreaterThan(N * 0.45);
    // What players actually notice: clashes inside one squad. 250 squads of 30.
    let squadsWithClash = 0;
    for (let s = 0; s < 250; s++) {
      const squad = players.slice(s * 30, s * 30 + 30).map((p) => `${p.firstName} ${p.lastName}`);
      if (new Set(squad).size < squad.length) squadsWithClash++;
    }
    expect(squadsWithClash / 250).toBeLessThan(0.15);
    const faces = new Set(players.map((p) => JSON.stringify(p.appearance)));
    expect(faces.size).toBeGreaterThan(N * 0.98);
    const hair = new Set(players.map((p) => p.appearance.hairId));
    expect(hair.size).toBeGreaterThanOrEqual(13);
  });

  it('never produces a forbidden name combination', () => {
    for (const p of players) {
      expect(isNameAllowed(`${p.firstName}${p.lastName}`)).toBe(true);
      if (p.nickname) expect(isNameAllowed(p.nickname)).toBe(true);
    }
    for (const pool of NAME_POOLS) {
      for (const n of [...pool.given, ...pool.family]) expect(isNameAllowed(n)).toBe(true);
    }
  });

  it('keeps stats realistic and roles coherent', () => {
    for (const p of players) {
      for (const k of ATTRIBUTE_KEYS) {
        const v = p.attributes[k];
        expect(Number.isInteger(v) && v >= 1 && v <= 99).toBe(true);
      }
      const ovr = overall(p);
      const tier = TIER_DEFS[p.tier];
      expect(ovr).toBeGreaterThanOrEqual(30);
      expect(ovr).toBeLessThanOrEqual(85);
      expect(p.potential).toBeGreaterThanOrEqual(ovr);
      expect(p.potential).toBeLessThanOrEqual(tier.potentialCap);
      expect(ARCHETYPE_BY_ID[p.archetypeId]?.position).toBe(p.primaryPosition);
      expect(p.traitIds.length).toBeGreaterThanOrEqual(1);
      for (const t of p.traitIds) expect(TRAIT_BY_ID[t]?.positions).toContain(p.primaryPosition);
      expect(DREAM_BY_ID[p.dreamId]?.positions).toContain(p.primaryPosition);
      const origin = ORIGIN_BY_ID[p.originStoryId];
      expect(origin).toBeDefined();
      expect(p.age).toBeGreaterThanOrEqual(origin!.minAge);
      expect(archetypeSubtitle(p)).not.toContain('{');
      if (p.age < 19) expect(['none', 'stubble']).toContain(p.appearance.facialHairId);
      if (p.appearance.hairColour === 'grey') expect(p.age).toBeGreaterThanOrEqual(31);
    }
  });

  it('goalkeepers are rated as goalkeepers and outfielders keep low keeping skills', () => {
    const gks = players.filter((p) => p.primaryPosition === 'GK');
    const fwds = players.filter((p) => p.primaryPosition === 'FWD');
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(gks.map((p) => p.attributes.reflexes))).toBeGreaterThan(avg(fwds.map((p) => p.attributes.reflexes)) + 25);
    expect(avg(fwds.map((p) => p.attributes.finishing))).toBeGreaterThan(avg(gks.map((p) => p.attributes.finishing)) + 25);
  });

  it('rarity does not dominate: tiers overlap heavily in current Overall', () => {
    const byTier = (t: Tier) => players.filter((p) => p.tier === t).map(overall);
    const streetMax = Math.max(...byTier('street'));
    const starMin = Math.min(...byTier('star'));
    expect(streetMax).toBeGreaterThan(starMin);
  });
});

describe('published tier odds', () => {
  it('match sampling over 100,000 draws within tolerance', () => {
    const rng = createRng('odds-check');
    const counts: Record<Tier, number> = { street: 0, prospect: 0, breakout: 0, star: 0, phenomenon: 0 };
    const draws = 100_000;
    for (let i = 0; i < draws; i++) counts[rollTier(rng)]++;
    for (const t of TIERS) {
      const expected = TIER_DEFS[t].odds / 100;
      const observed = counts[t] / draws;
      // 4 standard errors
      const tol = 4 * Math.sqrt((expected * (1 - expected)) / draws);
      expect(Math.abs(observed - expected)).toBeLessThanOrEqual(tol);
    }
    expect(TIERS.reduce((s, t) => s + TIER_DEFS[t].odds, 0)).toBeCloseTo(100, 6);
  });
});

describe('overall formula', () => {
  it('position weights sum to exactly 1', () => {
    for (const weights of Object.values(POSITION_WEIGHTS)) {
      const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('never leaves the supported 1–99 range, even with extreme attributes', () => {
    const base = generateFootballer({ seed: 'extremes' });
    for (const v of [1, 99]) {
      const attrs = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, v])) as Footballer['attributes'];
      for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as const) {
        const o = overall({ ...base, attributes: attrs, primaryPosition: pos });
        expect(o).toBeGreaterThanOrEqual(1);
        expect(o).toBeLessThanOrEqual(99);
      }
    }
  });
});
