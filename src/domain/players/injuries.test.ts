import { describe, expect, it } from 'vitest';
import { createCareer } from '../club/newCareer';
import { lineupProblems } from '../club/lineup';
import { matchArgs, prepareMatch, settleMatch } from '../match/settle';
import { replayMatch } from '../../game/simulation/replay';
import type { FootballEvent } from '../../game/simulation/types';
import type { ClubSave, Injury } from '../save/types';
import { INJURY, isFragile, knocksFor, proneness, treatInjury, treatmentOptions, unavailableFor } from './injuries';

function injure(save: ClubSave, playerId: string, outFor = 2): Injury {
  const i: Injury = { id: '00000000-0000-4000-8000-0000000000aa', playerId, kind: 'ankle', matchId: 'm1', atMatch: save.matchNumber, minute: 30, byName: 'Someone', outFor, untilMatch: save.matchNumber + outFor, treatment: null };
  save.injuries = [i, ...save.injuries];
  return i;
}

describe('injuries', () => {
  it('knocks come from fouls suffered and tackles taken, nothing else', () => {
    const ev = [
      { type: 'FOUL', minute: 10, foulerId: 'x', victimId: 'me', booked: false },
      { type: 'FOUL', minute: 20, foulerId: 'x', victimId: 'me', booked: true },
      { type: 'TACKLE', minute: 30, challengerId: 'y', carrierId: 'me', won: true, style: 'slide' },
      { type: 'TACKLE', minute: 40, challengerId: 'y', carrierId: 'me', won: false, style: 'slide' },
      { type: 'FOUL', minute: 50, foulerId: 'me', victimId: 'z', booked: false },
    ] as unknown as FootballEvent[];
    expect(knocksFor(ev, 'me').map((k) => k.weight)).toEqual([INJURY.foul, INJURY.foul + INJURY.bookedFoulExtra, INJURY.slideTaken]);
  });

  it('settlement injures from real knocks, the same way every time, at a sensible rate', () => {
    let injuries = 0;
    let matches = 0;
    for (let i = 0; i < 60; i++) {
      const s = createCareer(`inj-${i}`, 'x');
      const pm = prepareMatch(s);
      const result = replayMatch(matchArgs(pm), []);
      const a = structuredClone(s);
      const b = structuredClone(s);
      const ra = settleMatch(a, pm, result);
      settleMatch(b, pm, result);
      expect(a.injuries).toEqual(b.injuries);
      matches++;
      injuries += ra.injuries?.length ?? 0;
      for (const inj of a.injuries) {
        // Every injury is traceable to a knock that player took in this match.
        expect(knocksFor(result.events, inj.playerId).some((k) => k.minute === inj.minute)).toBe(true);
        expect(a.footballers[inj.playerId]!.history.at(-1)?.kind).toBe('injury');
        expect(unavailableFor(a).get(inj.playerId)).toMatch(/is injured/);
      }
    }
    const rate = injuries / matches;
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.7);
  });

  it('an injured starter blocks kick-off until replaced; the last keeper plays through', () => {
    const s = createCareer('inj-lineup', 'x');
    const mid = s.lineup.MID_L!;
    injure(s, mid);
    expect(lineupProblems(s.lineup, s.formationId, s.footballers, s.squadIds, unavailableFor(s)).join(' ')).toMatch(/is injured \(twisted ankle, out 2 more matches\)/);
    expect(() => prepareMatch(s)).toThrow(/injured/);
    const keeper = s.lineup.GK!;
    expect(s.squadIds.filter((id) => s.footballers[id]!.primaryPosition === 'GK')).toEqual([keeper]);
    injure(s, keeper);
    expect(unavailableFor(s).has(keeper)).toBe(false);
  });

  it('the physio: a specialist costs coins and saves a match; rushing back makes him fragile; only before the next match', () => {
    const s = createCareer('inj-treat', 'x');
    const id = s.lineup.FWD_L!;
    s.coins = 500;
    const i = injure(s, id, 3);
    const opts = treatmentOptions(s, i);
    expect(opts.find((o) => o.id === 'specialist')?.cost).toBe(INJURY.specialistPerMatch * 3);
    treatInjury(s, i.id, 'specialist');
    expect(s.coins).toBe(500 - INJURY.specialistPerMatch * 3);
    expect(i.untilMatch).toBe(s.matchNumber + 2);
    expect(() => treatInjury(s, i.id, 'rush')).toThrow(/decided/);

    const t = createCareer('inj-rush', 'x');
    const j = injure(t, t.lineup.FWD_L!, 2);
    treatInjury(t, j.id, 'rush');
    expect(unavailableFor(t).has(j.playerId)).toBe(false);
    expect(isFragile(t, j.playerId)).toBe(true);
    const p = t.footballers[j.playerId]!;
    expect(proneness(p, true)).toBeCloseTo(proneness(p, false) * INJURY.fragileFactor, 5);
    t.matchNumber += INJURY.fragileMatches;
    expect(isFragile(t, j.playerId)).toBe(false);

    const u = createCareer('inj-late', 'x');
    const k = injure(u, u.lineup.FWD_L!, 2);
    u.matchNumber++;
    expect(treatmentOptions(u, k).every((o) => o.disabled)).toBe(true);
  });

  it('strong young pros shake knocks off more easily than old, slight players', () => {
    const base = { personality: { professionalism: 50 } } as Parameters<typeof proneness>[0];
    const strong = proneness({ ...base, age: 24, attributes: { strength: 80 } } as Parameters<typeof proneness>[0], false);
    const slight = proneness({ ...base, age: 33, attributes: { strength: 35 } } as Parameters<typeof proneness>[0], false);
    expect(strong).toBeLessThan(slight);
  });
});

describe('covering absences', () => {
  it('only the missing starters are replaced, keepers by keepers, the rest untouched', async () => {
    const { coverAbsences } = await import('../club/lineup');
    const s = createCareer('cover-1', 'x');
    const before = { ...s.lineup };
    const mid = s.lineup.MID_L!;
    injure(s, mid);
    const { lineup, swaps } = coverAbsences(s.lineup, s.formationId, s.footballers, s.squadIds, unavailableFor(s));
    expect(swaps).toHaveLength(1);
    expect(swaps[0]).toMatchObject({ slotId: 'MID_L', outId: mid });
    expect(Object.values(lineup)).not.toContain(mid);
    for (const [slot, id] of Object.entries(before)) if (slot !== 'MID_L') expect(lineup[slot]).toBe(id);
    expect(lineupProblems(lineup, s.formationId, s.footballers, s.squadIds, unavailableFor(s))).toEqual([]);
  });
});
