import { describe, expect, it } from 'vitest';
import type { MatchResult } from '../../game/simulation/types';
import { createCareer } from '../club/newCareer';
import { opponentLineup } from '../club/opponents';
import { CLUB_BY_ID } from '../../data/clubs';
import { PLAYER_CLUB_ID } from '../save/types';
import { catchUpCup, completeCupRound, CUP_AFTER_LEAGUE_ROUNDS, cupEntrants, cupFinished, cupWinner, drawRound, eliminatedIn, newCup, settleTie, userCupTie } from './cup';
import { kickChance, penaltyShootout } from './shootout';

const lineup = (id: string) => opponentLineup('pens', { number: 1, club: CLUB_BY_ID[id]!, lap: 0, home: true }).lineup;

describe('penalty shootout', () => {
  it('is deterministic, has a winner, and stops when it cannot be caught', () => {
    const home = lineup('harbour');
    const away = lineup('cinderfield');
    for (let i = 0; i < 40; i++) {
      const a = penaltyShootout(`seed-${i}`, home, away);
      expect(penaltyShootout(`seed-${i}`, home, away)).toEqual(a);
      expect(a.home).not.toBe(a.away);
      expect(a.winner).toBe(a.home > a.away ? 'home' : 'away');
      const h = a.kicks.filter((k) => k.side === 'home');
      const w = a.kicks.filter((k) => k.side === 'away');
      expect(h.filter((k) => k.scored)).toHaveLength(a.home);
      expect(w.filter((k) => k.scored)).toHaveLength(a.away);
      // Home always kicks first; sides never differ by more than one kick.
      expect(a.kicks[0]!.side).toBe('home');
      expect(h.length - w.length).toBeGreaterThanOrEqual(0);
      expect(h.length - w.length).toBeLessThanOrEqual(1);
      if (h.length > 5) expect(h.length).toBe(w.length); // sudden death is played in pairs
      if (h.length < 5) expect(Math.abs(a.home - a.away)).toBeGreaterThan(5 - Math.max(h.length, w.length) - 1);
    }
  });

  it('better takers against a weaker keeper convert more often', () => {
    const t = lineup('harbour').players.find((p) => p.role === 'FWD')!;
    const gk = lineup('cinderfield').players.find((p) => p.role === 'GK')!;
    const strong = { ...t, attributes: { ...t.attributes, finishing: 85, composure: 85 } };
    const weak = { ...t, attributes: { ...t.attributes, finishing: 35, composure: 35 } };
    expect(kickChance(strong, gk)).toBeGreaterThan(kickChance(weak, gk));
    expect(kickChance(strong, gk)).toBeLessThanOrEqual(0.92);
    expect(kickChance(weak, gk)).toBeGreaterThanOrEqual(0.55);
  });
});

describe('the County Cup', () => {
  it('draws all sixteen clubs into eight ties, the same way every time', () => {
    const r = drawRound('cup-1', 1, 0, cupEntrants());
    expect(r).toHaveLength(8);
    expect(new Set(r.flatMap((t) => [t.home, t.away])).size).toBe(16);
    expect(drawRound('cup-1', 1, 0, cupEntrants())).toEqual(r);
    expect(drawRound('cup-1', 2, 0, cupEntrants())).not.toEqual(r);
  });

  it('is played between league rounds, and only while we are still in it', () => {
    const save = createCareer('cup-2', 'x');
    expect(userCupTie(save)).toBeNull();
    save.league.round = CUP_AFTER_LEAGUE_ROUNDS[0]!;
    const tie = userCupTie(save)!;
    expect(tie.cupRound).toBe(0);
    // Lose our tie: the rest of the round is simulated and the next round drawn without us.
    const ours = save.cup!.rounds[0]!.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID)!;
    const fake = { score: ours.home === PLAYER_CLUB_ID ? { home: 0, away: 1 } : { home: 1, away: 0 }, events: [] } as unknown as MatchResult;
    const opp = lineup(tie.club.id);
    completeCupRound(save, settleTie(ours, fake, opp, opp, null));
    expect(save.cup!.round).toBe(1);
    expect(save.cup!.rounds[1]).toHaveLength(4);
    expect(save.cup!.rounds[1]!.some((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID)).toBe(false);
    expect(eliminatedIn(save.cup)).toBe(0);
    expect(userCupTie(save)).toBeNull();
    // As the league reaches the later cup dates, the rest of the cup plays out to a winner.
    save.league.round = 12;
    catchUpCup(save);
    expect(cupFinished(save.cup)).toBe(true);
    expect(save.cup!.rounds.map((r) => r.length)).toEqual([8, 4, 2, 1]);
    const winner = cupWinner(save.cup)!;
    expect(winner).not.toBe(PLAYER_CLUB_ID);
    for (const r of save.cup!.rounds) for (const t of r) {
      expect([t.home, t.away]).toContain(t.winner);
      if (t.hg === t.ag) expect(t.pens).toBeDefined();
    }
  });

  it('a fresh cup starts every season', () => {
    expect(newCup('cup-3', 4).season).toBe(4);
    expect(newCup('cup-3', 4).rounds[0]).toHaveLength(8);
  });
});
