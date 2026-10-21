import { describe, expect, it } from 'vitest';
import { createCareer } from '../club/newCareer';
import { managerOf } from '../world/managers';
import { earnNicknames, hasEarnedNickname } from './nicknames';

describe('earned nicknames', () => {
  it('the fans name a player for what he did — once, deterministically, into his story', () => {
    const s = createCareer('nick-1', 'x');
    const gk = s.lineup.GK!;
    const fwd = s.lineup.FWD_L!;
    s.footballers[gk]!.stats.cleanSheets = 4;
    s.footballers[fwd]!.stats.goals = 2;
    const twin = structuredClone(s);
    const got = earnNicknames(s, [gk, fwd], { town: 'Wexham', hatTricks: new Set() });
    expect(got.map((g) => g.playerId)).toEqual([gk]);
    expect(['The Wall', 'The Cat', 'Safe Hands', 'The Octopus']).toContain(s.footballers[gk]!.nickname);
    expect(s.footballers[gk]!.history.at(-1)).toMatchObject({ kind: 'nickname' });
    expect(earnNicknames(twin, [gk, fwd], { town: 'Wexham', hatTricks: new Set() })[0]!.nickname).toBe(got[0]!.nickname);
    // One per player: more clean sheets don't rename him.
    s.footballers[gk]!.stats.cleanSheets = 20;
    expect(earnNicknames(s, [gk], { town: 'Wexham', hatTricks: new Set() })).toEqual([]);
    expect(hasEarnedNickname(s.footballers[gk]!)).toBe(true);
  });

  it('a hat-trick or a derby winner earns a name on the night', () => {
    const s = createCareer('nick-2', 'x');
    const a = s.lineup.FWD_L!;
    const b = s.lineup.FWD_R!;
    const got = earnNicknames(s, [a, b], { town: 'Wexham', hatTricks: new Set([a]), derbyWinnerId: b });
    expect(got.find((g) => g.playerId === a)?.reason).toMatch(/hat-trick/);
    expect(got.find((g) => g.playerId === b)?.reason).toMatch(/derby/);
  });
});

describe('opposition managers', () => {
  it('each club has its own manager, fixed for the career and different in another', () => {
    const club = { id: 'heronbrook-d0' };
    expect(managerOf('career-a', club)).toEqual(managerOf('career-a', club));
    const names = new Set(['a', 'b', 'c', 'd', 'e'].map((k) => managerOf(`career-${k}`, club).name));
    expect(names.size).toBeGreaterThan(2);
    expect(managerOf('career-a', club).habit.length).toBeGreaterThan(10);
  });
});
