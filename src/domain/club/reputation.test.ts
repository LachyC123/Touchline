import { describe, expect, it } from 'vitest';
import { TIER_ORDER } from '../../data/tiers';
import { matchArgs, prepareMatch, settleMatch } from '../match/settle';
import { replayMatch } from '../../game/simulation/replay';
import { createCareer } from './newCareer';
import { vary } from './dressingRoom';
import { attendance, gateMoney, GROUND_LEVELS, groundBlocker, matchAttendance, nextRepTier, REP_TIERS, repTier, scoutOdds, upgradeGround } from './reputation';

describe('reputation', () => {
  it('tiers climb with reputation and say what is next', () => {
    expect(repTier(0).id).toBe('local');
    expect(repTier(14).id).toBe('local');
    expect(repTier(15).id).toBe('rising');
    expect(repTier(500).id).toBe('famous');
    expect(nextRepTier(20)?.id).toBe('respected');
    expect(nextRepTier(500)).toBeNull();
  });

  it('scout odds always add up to 100 and only get better with reputation', () => {
    let prev = scoutOdds(0);
    for (const t of REP_TIERS) {
      const odds = scoutOdds(t.from);
      const sum = TIER_ORDER.reduce((n, k) => n + odds[k], 0);
      expect(sum).toBeCloseTo(100, 5);
      for (const k of TIER_ORDER) expect(odds[k]).toBeGreaterThan(0);
      for (const k of TIER_ORDER.filter((x) => x !== 'street')) expect(odds[k]).toBeGreaterThanOrEqual(prev[k]);
      prev = odds;
    }
  });

  it('the crowd grows with reputation, more for big games, never past capacity; the gate pays', () => {
    const s = createCareer('rep-1', 'x');
    s.club.reputation = 0;
    expect(attendance(s, false)).toBe(260);
    expect(attendance(s, true)).toBeGreaterThan(attendance(s, false));
    s.club.reputation = 200;
    expect(attendance(s, false)).toBe(GROUND_LEVELS[0].capacity);
    s.club.stadiumLevel = 5;
    expect(attendance(s, true)).toBeLessThanOrEqual(GROUND_LEVELS[4].capacity);
    expect(gateMoney(600)).toBe(24);
    const rival = s.world.clubs.find((c) => c.rival)!;
    s.club.reputation = 10;
    s.club.stadiumLevel = 2;
    expect(matchAttendance(s, { userSide: 'away', opponentId: rival.id })).toBe(0);
    expect(matchAttendance(s, { userSide: 'home', opponentId: rival.id })).toBe(attendance(s, true));
  });

  it('a ground upgrade needs the reputation and the coins, and costs exactly what it says', () => {
    const s = createCareer('rep-2', 'x');
    s.club.reputation = 0;
    s.coins = 10_000;
    expect(groundBlocker(s)).toMatch(/reputation/);
    expect(() => upgradeGround(s)).toThrow(/reputation/);
    s.club.reputation = 15;
    s.coins = 599;
    expect(groundBlocker(s)).toMatch(/600 coins/);
    s.coins = 700;
    expect(upgradeGround(s).level).toBe(2);
    expect(s.coins).toBe(100);
    expect(s.club.stadiumLevel).toBe(2);
    s.club.stadiumLevel = 5;
    expect(groundBlocker(s)).toMatch(/finished/);
  });

  it('a home match pays gate receipts into the coins line-up and a win earns reputation', () => {
    let checkedHome = false;
    let checkedWin = false;
    for (let i = 0; i < 20 && !(checkedHome && checkedWin); i++) {
      const s = createCareer(`rep-gate-${i}`, 'x');
      const pm = prepareMatch(s);
      const result = replayMatch(matchArgs(pm), []);
      const draft = structuredClone(s);
      const record = settleMatch(draft, pm, result);
      expect(record.rewards.coins).toBe(record.rewards.lines.reduce((n, l) => n + l.coins, 0));
      const gate = record.rewards.lines.find((l) => l.label.startsWith('Gate receipts'));
      if (pm.userSide === 'home') {
        checkedHome = true;
        expect(record.attendance).toBe(matchAttendance(s, pm));
        expect(gate?.coins).toBe(gateMoney(record.attendance!));
      } else {
        expect(gate).toBeUndefined();
        expect(record.attendance).toBeUndefined();
      }
      expect(draft.club.reputation).toBe(s.club.reputation + (record.repGain ?? 0));
      const us = pm.userSide === 'home' ? result.score.home : result.score.away;
      const them = pm.userSide === 'home' ? result.score.away : result.score.home;
      if (us > them) {
        checkedWin = true;
        expect(record.repGain).toBeGreaterThanOrEqual(2);
      }
    }
    expect(checkedHome).toBe(true);
    expect(checkedWin).toBe(true);
  });

  it('a win that crosses a tier is recorded as the moment the club moved up (and only then)', () => {
    let seen = 0;
    for (let i = 0; i < 30 && seen < 2; i++) {
      const s = createCareer(`rep-tier-${i}`, 'x');
      s.club.reputation = 13;
      const pm = prepareMatch(s);
      const result = replayMatch(matchArgs(pm), []);
      const draft = structuredClone(s);
      const record = settleMatch(draft, pm, result);
      if (draft.club.reputation >= 15) {
        seen++;
        expect(record.repTier).toBe('rising');
      } else expect(record.repTier).toBeUndefined();
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('request quotes vary between events but never on a re-read', () => {
    const lines = ['a', 'b', 'c'];
    const picks = new Set(Array.from({ length: 30 }, (_, i) => vary({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }, lines)));
    expect(picks.size).toBe(3);
    const e = { id: '11111111-0000-4000-8000-000000000000' };
    expect(vary(e, lines)).toBe(vary(e, lines));
  });
});
