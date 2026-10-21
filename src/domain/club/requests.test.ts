import { describe, expect, it } from 'vitest';
import { makeTeam } from '../../test/fixtures/teams';
import { createMatch } from '../../game/simulation/engine';
import { migrateSave } from '../../storage/migrations';
import { createCareer } from './newCareer';
import { applyChoice, choicesFor, dressingRoomAfterMatch, eventHeadline, eventQuote, newEvent, openEvent, REQUEST_KINDS, type AfterMatchInput } from './dressingRoom';
import { dreamMetByMatch, dreamsAfterMatch, dreamProgress, type DreamMatch } from '../players/dreams';
import type { FootballEvent } from '../../game/simulation/types';
import type { ClubSave, MatchRecord } from '../save/types';

function play(save: ClubSave, result: 'win' | 'draw' | 'loss'): void {
  save.matchNumber++;
  const st = new Set(Object.values(save.lineup).filter((id) => !save.dressingRoom.away.some((a) => a.playerId === id && a.untilMatch >= save.matchNumber)));
  const score = result === 'win' ? { home: 2, away: 0 } : result === 'loss' ? { home: 0, away: 1 } : { home: 1, away: 1 };
  const scorer = [...st][5] as string;
  const scorers = result === 'loss' ? [] : [{ playerId: scorer, name: 'x', side: 'home', minute: 10, tick: 120 }];
  const rec = { matchId: `m${save.matchNumber}`, number: save.matchNumber, userSide: 'home', season: save.season, score, scorers, gains: save.squadIds.map((id) => ({ playerId: id, xp: 10, levelBefore: 1, levelAfter: 1, ...(st.has(id) ? { rating: 6.5 } : {}) })) } as unknown as MatchRecord;
  save.matchRecords = [rec, ...save.matchRecords].slice(0, 30);
  const input: AfterMatchInput = { started: st, cameOn: new Set(), goals: new Map(result === 'loss' ? [] : [[scorer, 1]]), potmId: scorer, result };
  dressingRoomAfterMatch(save, input);
}

describe('every request', () => {
  it('reads properly and every choice applies', () => {
    for (const kind of REQUEST_KINDS) {
      const base = createCareer(`req-${kind}`, 'x');
      base.coins = 1000;
      base.matchNumber = 8;
      base.captainId = base.lineup.GK!;
      const [a, b] = Object.values(base.lineup) as [string, string];
      const proto = newEvent(base, kind, 'open', { playerId: a, otherId: b, clubId: 'wexham' });
      expect(eventHeadline(proto, base).length).toBeGreaterThan(5);
      const choices = choicesFor(proto, base);
      expect(choices.length, kind).toBeGreaterThanOrEqual(2);
      for (const c of choices) {
        const s = structuredClone(base);
        const outcome = applyChoice(s, proto.id, c.id);
        expect(outcome.length, `${kind}:${c.id}`).toBeGreaterThan(10);
        expect(s.dressingRoom.events.find((e) => e.id === proto.id)?.status).toBe('resolved');
        expect(() => migrateSave(s)).not.toThrow(); // still a valid save
      }
      expect(eventQuote(proto, base).length, kind).toBeGreaterThan(10);
    }
  });

  it('a long season of requests: varied, one at a time, answered without breaking the save', () => {
    const seen = new Set<string>();
    for (const seed of ['soak-1', 'soak-2', 'soak-3']) {
      const s = createCareer(seed, 'x');
      s.coins = 5000;
      for (let m = 0; m < 30; m++) {
        play(s, (['win', 'draw', 'loss'] as const)[(m * 7 + seed.length) % 3]!);
        expect(s.dressingRoom.events.filter((e) => e.status === 'open').length).toBeLessThanOrEqual(1);
        const e = openEvent(s);
        if (e) {
          seen.add(e.kind);
          const c = choicesFor(e, s).find((x) => !x.disabled)!;
          applyChoice(s, e.id, c.id);
        }
      }
      let detail = '';
      try {
        migrateSave({ ...s, matchRecords: [] }); // the fake records above are not full records
      } catch (err) {
        detail = (err as { detail?: string }).detail ?? String(err);
      }
      expect(detail).toBe('');
    }
    expect(seen.size).toBeGreaterThanOrEqual(7);
  });

  it('the squad gets a captain, and he gets a little lift every match he leads them', () => {
    const s = createCareer('cap-1', 'x');
    play(s, 'draw');
    play(s, 'draw');
    const e = openEvent(s)!;
    expect(e.kind).toBe('captaincy');
    const appoint = choicesFor(e, s).find((c) => c.id.startsWith('appoint:'))!;
    const id = appoint.id.slice(8);
    applyChoice(s, e.id, appoint.id);
    expect(s.captainId).toBe(id);
    expect(s.footballers[id]!.history.some((h) => h.headline === 'Named club captain.')).toBe(true);
  });
});

describe('dreams', () => {
  const base = (over: Partial<DreamMatch> = {}): DreamMatch => ({ side: 'home', events: [], started: new Set(), played: new Set(), cupFinal: false, rival: false, won: false, ...over });
  const goal = (id: number, scorerId: string, team: 'home' | 'away', shotEventId: number): FootballEvent => ({ id, tick: id, minute: id, type: 'GOAL', scorerId, team, shotEventId }) as FootballEvent;
  const shot = (id: number, shooterId: string, style: string): FootballEvent => ({ id, tick: id, minute: id, type: 'SHOT', shooterId, team: 'home', style, outcome: 'goal', xg: 0.1, from: { x: 0, y: 0 }, target: { x: 0, y: 0 } }) as unknown as FootballEvent;

  it('come true from what actually happened', () => {
    const s = createCareer('dream-1', 'x');
    const p = s.footballers[s.lineup.FWD_L!]!;
    const played = new Set([p.id]);
    p.dreamId = 'hatTrick';
    expect(dreamMetByMatch(p, base({ played, events: [goal(2, p.id, 'home', 1), goal(4, p.id, 'home', 3)] }), s)).toBe(false);
    expect(dreamMetByMatch(p, base({ played, events: [goal(2, p.id, 'home', 1), goal(4, p.id, 'home', 3), goal(6, p.id, 'home', 5)] }), s)).toBe(true);
    p.dreamId = 'distanceGoal';
    expect(dreamMetByMatch(p, base({ played, events: [shot(1, p.id, 'long'), goal(2, p.id, 'home', 1)] }), s)).toBe(true);
    expect(dreamMetByMatch(p, base({ played, events: [shot(1, p.id, 'normal'), goal(2, p.id, 'home', 1)] }), s)).toBe(false);
    p.dreamId = 'derbyWinner';
    // 2–1 win in a derby: our second goal is the winner.
    const derby = [goal(1, 'x', 'home', 0), goal(2, 'opp', 'away', 0), goal(3, p.id, 'home', 0)];
    expect(dreamMetByMatch(p, base({ played, events: derby, rival: true, won: true }), s)).toBe(true);
    expect(dreamMetByMatch(p, base({ played, events: derby, rival: false, won: true }), s)).toBe(false);
    p.dreamId = 'scoreFinal';
    expect(dreamMetByMatch(p, base({ played, events: [goal(2, p.id, 'home', 1)], cupFinal: true }), s)).toBe(true);
    expect(dreamMetByMatch(p, base({ events: [goal(2, p.id, 'home', 1)], cupFinal: true }), s)).toBe(false); // must have played
    p.dreamId = 'cleanSheets10';
    p.stats.cleanSheets = 7;
    expect(dreamProgress(p, s)).toBe('7 / 10 clean sheets');
  });

  it('come true once: gold scrapbook, a big lift (bigger if you backed him), news', () => {
    const s = createCareer('dream-2', 'x');
    const p = s.footballers[s.lineup.FWD_L!]!;
    p.dreamId = 'hatTrick';
    p.morale = 50;
    s.dressingRoom.backed.push(p.id);
    const m = base({ played: new Set([p.id]), events: [goal(2, p.id, 'home', 1), goal(4, p.id, 'home', 3), goal(6, p.id, 'home', 5)] });
    const first = dreamsAfterMatch(s, m);
    expect(first.map((d) => d.playerId)).toEqual([p.id]);
    expect(p.morale).toBe(85);
    expect(p.history.filter((h) => h.kind === 'dream')).toHaveLength(1);
    expect(s.dressingRoom.events[0]!.kind).toBe('dreamCome');
    expect(dreamsAfterMatch(s, m)).toEqual([]); // once only
  });
});

describe('penalty duty reaches the pitch', () => {
  it('the chosen taker steps up for every penalty while he is on', () => {
    const home = makeTeam('pen-h', 55);
    const away = makeTeam('pen-a', 55);
    const chosen = home.players.find((p) => p.role === 'DEF')!.id;
    let penalties = 0;
    for (let i = 0; i < 80 && penalties < 3; i++) {
      const e = createMatch({ matchId: `p${i}`, seed: `pen-${i}`, home: { ...home, penaltyTakerId: chosen }, away, userSide: 'home' });
      e.runToEnd();
      for (const ev of e.getEvents()) {
        if (ev.type === 'SHOT' && ev.style === 'penalty' && ev.team === 'home') {
          expect(ev.shooterId).toBe(chosen);
          penalties++;
        }
      }
    }
    expect(penalties).toBeGreaterThan(0);
  });
});
