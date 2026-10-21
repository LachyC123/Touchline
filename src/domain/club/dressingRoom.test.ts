import { describe, expect, it } from 'vitest';
import { buildTeamLineup } from '../../game/simulation/fromSquad';
import { lineupProblems } from './lineup';
import { createCareer } from './newCareer';
import { applyChoice, awayFor, choicesFor, COSTS, dressingRoomAfterMatch, openEvent, type AfterMatchInput } from './dressingRoom';
import { matchMoraleDelta, moraleBand, moraleEffect } from '../players/morale';
import type { ClubSave, MatchRecord } from '../save/types';

const none = (): AfterMatchInput => ({ started: new Set(), cameOn: new Set(), goals: new Map(), potmId: '', result: 'draw' });

function starters(save: ClubSave): Set<string> {
  return new Set(Object.values(save.lineup));
}
function benchIds(save: ClubSave): string[] {
  const s = starters(save);
  return save.squadIds.filter((id) => !s.has(id));
}

/** Plays a "match" on the draft: a record where the starters played and the bench sat. */
/** A career with a captain already named, so the armband request stays out of the way. */
function career(seed: string): ClubSave {
  const s = createCareer(seed, 'x');
  s.captainId = s.lineup.GK!;
  return s;
}

function play(save: ClubSave, result: 'win' | 'draw' | 'loss' = 'draw', extra: Partial<AfterMatchInput> = {}): ReturnType<typeof dressingRoomAfterMatch> {
  save.matchNumber++;
  const st = extra.started ?? starters(save);
  const score = result === 'win' ? { home: 1, away: 0 } : result === 'loss' ? { home: 0, away: 1 } : { home: 0, away: 0 };
  const rec = { matchId: `m${save.matchNumber}`, number: save.matchNumber, userSide: 'home', season: save.season, score, scorers: [], gains: save.squadIds.map((id) => ({ playerId: id, xp: 10, levelBefore: 1, levelAfter: 1, ...(st.has(id) ? { rating: 6.5 } : {}) })) } as unknown as MatchRecord;
  save.matchRecords = [rec, ...save.matchRecords];
  return dressingRoomAfterMatch(save, { ...none(), started: st, result, ...extra });
}

describe('morale', () => {
  it('bands map to a small, symmetric effect on composure, finishing and passing', () => {
    expect(moraleBand(60).band).toBe('content');
    expect(moraleEffect(60)).toEqual({});
    expect(moraleEffect(90)).toEqual({ composure: 4, finishing: 2, passing: 2 });
    expect(moraleEffect(10)).toEqual({ composure: -4, finishing: -2, passing: -2 });
  });

  it('his mood goes onto the pitch with him', () => {
    const save = createCareer('mood-1', 'x');
    const id = save.lineup.FWD_L!;
    const at = (m: number) => {
      save.footballers[id]!.morale = m;
      return buildTeamLineup({ clubId: 'p', name: 'P', shortName: 'P', kit: { primary: '#000000', secondary: '#ffffff' }, aiStyle: 'balanced' }, save.formationId, save.lineup, save.footballers).players.find((p) => p.id === id)!.attributes;
    };
    expect(at(90).composure - at(60).composure).toBe(4);
    expect(at(20).finishing - at(60).finishing).toBe(-2);
  });

  it('the bench stings the ambitious more than the loyal; starting, winning and scoring lift it', () => {
    const base = { morale: 40, personality: { type: 'ambitious', loyalty: 20, ambition: 90, professionalism: 50, confidence: 50, sociability: 50 } } as const;
    const loyal = { ...base, personality: { ...base.personality, loyalty: 95, ambition: 20 } };
    const unused = { started: false, cameOn: false, goals: 0, potm: false, result: 'win' as const };
    expect(matchMoraleDelta(base, unused).delta).toBeLessThan(matchMoraleDelta(loyal, unused).delta);
    const star = matchMoraleDelta(base, { started: true, cameOn: false, goals: 2, potm: true, result: 'win' });
    expect(star.delta).toBe(3 + 3 + 6 + 4);
    expect(star.reasons).toEqual(['started', 'won', '2 goals', 'player of the match']);
  });
});

describe('requests and promises', () => {
  it('three games on the bench and he knocks on the door; same career, same request', () => {
    const make = () => {
      const save = career('room-1');
      for (const id of benchIds(save)) save.footballers[id]!.morale = 56;
      for (let i = 0; i < 3; i++) play(save, 'win');
      return save;
    };
    const a = make();
    const e = openEvent(a)!;
    expect(e.kind).toBe('playingTime');
    expect(benchIds(a)).toContain(e.playerId);
    expect(make().dressingRoom.events).toEqual(a.dressingRoom.events);
    // Only one request at a time.
    play(a, 'win');
    play(a, 'win');
    expect(a.dressingRoom.events.filter((x) => x.status === 'open')).toHaveLength(1);
  });

  it('a promise kept: he starts, he flies, and the scrapbook remembers', () => {
    const save = career('room-2');
    for (const id of benchIds(save)) save.footballers[id]!.morale = 50;
    for (let i = 0; i < 3; i++) play(save, 'win');
    const e = openEvent(save)!;
    const id = e.playerId!;
    const before = save.footballers[id]!.morale;
    applyChoice(save, e.id, 'promise');
    expect(save.footballers[id]!.morale).toBe(before + 5);
    expect(() => applyChoice(save, e.id, 'promise')).toThrow(/already/);
    const swings = play(save, 'draw', { started: new Set([...starters(save), id]) });
    const kept = save.dressingRoom.events.find((x) => x.kind === 'promiseKept')!;
    expect(kept.status).toBe('news');
    expect(kept.outcome).toMatch(/kept your word/);
    expect(save.dressingRoom.promises).toEqual([]);
    expect(swings.find((s) => s.playerId === id && s.reasons.includes('promise kept'))?.delta).toBe(15);
    expect(save.footballers[id]!.history.some((h) => /kept his word/.test(h.headline))).toBe(true);
  });

  it('a promise broken: two matches without a start, he is furious and the bench notices', () => {
    const save = career('room-3');
    for (const id of benchIds(save)) save.footballers[id]!.morale = 50;
    for (let i = 0; i < 3; i++) play(save, 'win');
    const e = openEvent(save)!;
    applyChoice(save, e.id, 'promise');
    const other = benchIds(save).find((x) => x !== e.playerId)!;
    play(save, 'win');
    expect(save.dressingRoom.promises).toHaveLength(1); // one match left
    const otherBefore = save.footballers[other]!.morale;
    const himBefore = save.footballers[e.playerId!]!.morale;
    play(save, 'win');
    const broken = save.dressingRoom.events.find((x) => x.kind === 'promiseBroken')!;
    expect(broken.outcome).toMatch(/didn’t deliver/);
    expect(save.footballers[e.playerId!]!.morale).toBeLessThan(himBefore - 15);
    expect(save.footballers[other]!.morale).toBeLessThan(otherBefore - 2);
  });

  it('a few days at home: he misses the next match (the lineup says so), then he is back', () => {
    const save = career('room-4');
    const id = save.lineup.MID_L!;
    save.dressingRoom.events = [{ id: '00000000-0000-4000-8000-000000000001', kind: 'homesick', playerId: id, atMatch: 0, status: 'open' }];
    applyChoice(save, '00000000-0000-4000-8000-000000000001', 'daysOff');
    expect(awayFor(save).has(id)).toBe(true);
    expect(lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds, awayFor(save)).join(' ')).toMatch(/is away/);
    play(save, 'draw', { started: new Set([...starters(save)].filter((x) => x !== id)) });
    expect(awayFor(save).has(id)).toBe(false);
  });

  it('three defeats: a flat squad; the choices cost what they say and split by character', () => {
    const save = career('room-5');
    for (let i = 0; i < 3; i++) play(save, 'loss');
    const e = openEvent(save)!;
    expect(e.kind).toBe('flatSquad');
    save.coins = COSTS.nightOut - 1;
    expect(choicesFor(e, save).find((c) => c.id === 'nightOut')?.disabled).toBeDefined();
    expect(() => applyChoice(save, e.id, 'nightOut')).toThrow(/coins/);
    const pros = save.squadIds.filter((id) => save.footballers[id]!.personality.professionalism >= 60);
    const before = Object.fromEntries(save.squadIds.map((id) => [id, save.footballers[id]!.morale]));
    applyChoice(save, e.id, 'toughLove');
    for (const id of save.squadIds) {
      const d = save.footballers[id]!.morale - (before[id] as number);
      expect(d).toBe(pros.includes(id) ? Math.min(6, 100 - (before[id] as number)) : -Math.min(5, before[id] as number));
    }
  });
});
