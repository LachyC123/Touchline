import { describe, expect, it } from 'vitest';
import { REAL_TOWNS } from '../../data/world';
import { createCareer } from '../club/newCareer';
import { clubNameProblem } from '../club/onboarding';
import { clubOfSchemaCheck } from './testing';
import { generateWorld } from './generateWorld';
import { cupEntrants } from '../cup/cup';
import { scheduleSeason } from '../league/league';
import { classicWorld, clubOf, divisionOf, divisionsOf } from './world';

describe('generated worlds', () => {
  it('the same seed builds the same world; different seeds build different ones', () => {
    expect(generateWorld('brothers-a')).toEqual(generateWorld('brothers-a'));
    const a = generateWorld('brothers-a');
    const b = generateWorld('brothers-b');
    const namesA = new Set(a.world.clubs.map((c) => c.name));
    const shared = b.world.clubs.filter((c) => namesA.has(c.name)).length;
    expect(shared).toBeLessThanOrEqual(2);
    expect(a.identity.name).not.toBe(b.identity.name);
  });

  it('every world is a playable league: 7 + 7 clubs, a guest, a 16-club cup, 14-round seasons, unique ids, names and codes, rivals in both divisions', () => {
    for (let i = 0; i < 60; i++) {
      const { world, identity } = generateWorld(`w-${i}`);
      expect(world.kind).toBe('generated');
      expect(divisionsOf(world).map((d) => d.clubs.length)).toEqual([7, 7]);
      expect(cupEntrants(world)).toHaveLength(16);
      for (const d of [0, 1]) {
        const rounds = scheduleSeason(`w-${i}`, world, 1, d);
        expect(rounds).toHaveLength(14);
        for (const r of rounds) expect(new Set(r.flatMap((f) => [f.home, f.away])).size).toBe(8);
      }
      expect(world.cupGuestIds).toHaveLength(1);
      const ids = world.clubs.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(world.clubs.map((c) => c.name)).size).toBe(world.clubs.length);
      expect(new Set([...world.clubs.map((c) => c.shortName), identity.shortName]).size).toBe(world.clubs.length + 1);
      for (const d of [0, 1]) expect(divisionOf(world, d).clubs.filter((c) => c.rival)).toHaveLength(1);
      for (const c of world.clubs) {
        expect(REAL_TOWNS.has(c.town ?? '')).toBe(false);
        expect(c.quirk).toBeTruthy();
        expect(clubOf(world, c.id)).toBe(c);
        expect(clubOfSchemaCheck(c)).toBe(true);
      }
      // Division One is stronger on average, and Division Two has a gentle opener.
      const avg = (n: number) => divisionOf(world, n).clubs.reduce((s, c) => s + c.baseOvr, 0) / divisionOf(world, n).clubs.length;
      expect(avg(1)).toBeGreaterThan(avg(0));
      expect(Math.min(...divisionOf(world, 0).clubs.map((c) => c.baseOvr))).toBeLessThanOrEqual(46);
      expect(clubNameProblem(identity.name)).toBeNull();
    }
  });

  it('a new career plays in its own world, starting at home against the weakest side', () => {
    const save = createCareer('own-world', 'x');
    expect(save.world).toEqual(generateWorld('own-world').world);
    expect(save.club.name).toBe(generateWorld('own-world').identity.name);
    const ids = new Set(save.world.clubs.map((c) => c.id));
    for (const f of save.league.rounds.flat()) for (const id of [f.home, f.away]) expect(id === 'player-club' || ids.has(id)).toBe(true);
    const weakest = [...divisionOf(save.world, 0).clubs].sort((a, b) => a.baseOvr - b.baseOvr)[0]!;
    expect(save.league.rounds[0]!.find((f) => f.home === 'player-club')?.away).toBe(weakest.id);
  });

  it('old careers keep the classic clubs', () => {
    const w = classicWorld();
    expect(w.kind).toBe('classic');
    expect(clubOf(w, 'copperton')?.rival).toBe(true);
  });
});
