import { describe, expect, it } from 'vitest';
import { createCareer } from './newCareer';
import { claimRoadStep, ROAD, roadClaimId, roadReady, roadState } from './road';

describe('reputation road', () => {
  it('steps open as reputation grows; each pays exactly what it says, once', () => {
    const s = createCareer('road-1', 'x');
    s.club.reputation = 0;
    expect(roadReady(s)).toEqual([]);
    expect(() => claimRoadStep(s, 5)).toThrow(/Reach 5/);
    s.club.reputation = 45;
    expect(roadReady(s).map((x) => x.at)).toEqual([5, 10, 15, 22, 30, 40]);
    const coins = s.coins;
    claimRoadStep(s, 5);
    s.rewardClaimIds.push(roadClaimId(5));
    expect(s.coins).toBe(coins + 100);
    expect(roadState(s, ROAD[0]!)).toBe('claimed');
    expect(() => claimRoadStep(s, 5)).toThrow(/Already/);
    const packs = s.packs.length;
    const r = claimRoadStep(s, 40);
    expect(s.packs.length).toBe(packs + 1);
    const pack = s.packs.find((p) => p.id === r.packId)!;
    expect(pack.kind).toBe('gold-scout');
    expect(['breakout', 'star', 'phenomenon']).toContain(pack.recruit!.tier);
  });
});
