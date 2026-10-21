import { describe, expect, it } from 'vitest';
import { CLUB_BY_ID } from '../../data/clubs';
import { createCareer } from '../club/newCareer';
import { CUP_AFTER_LEAGUE_ROUNDS } from '../cup/cup';
import { userFixture, type UserFixture } from '../league/league';
import { PLAYER_CLUB_ID } from '../save/types';
import { bigMatch } from './bigMatch';

const fx = (club: string, extra: Partial<UserFixture> = {}): UserFixture => ({ club: CLUB_BY_ID[club]!, home: true, round: 3, lap: 0, competition: 'league', ...extra });

describe('big matches', () => {
  it('every cup tie gets a walk-out; the final is billed as one', () => {
    const save = createCareer('big-1', 'x');
    save.league.round = CUP_AFTER_LEAGUE_ROUNDS[0]!;
    const tie = userFixture(save)!;
    expect(tie.competition).toBe('cup');
    expect(bigMatch(save, tie)?.kind).toBe('cup');
    expect(bigMatch(save, { ...tie, cupRound: 3 })).toMatchObject({ kind: 'cupFinal', title: 'County Cup final' });
  });

  it('a derby is big, an ordinary mid-season league game is not', () => {
    const save = createCareer('big-2', 'x');
    // Give the league some history so it is not opening day.
    save.league.results = save.league.rounds[0]!.map((f) => ({ round: 0, home: f.home, away: f.away, hg: 1, ag: 1, scorers: [] }));
    save.league.round = 1;
    expect(bigMatch(save, fx('copperton'))).toMatchObject({ kind: 'derby', title: 'Derby day' });
    expect(bigMatch(save, fx('beacon'))).toBeNull();
  });

  it('the final day of the season gets a walk-out', () => {
    const save = createCareer('big-3', 'x');
    save.league.results = save.league.rounds.slice(0, 13).flatMap((round, r) => round.map((f) => ({ round: r, home: f.home, away: f.away, hg: f.home === PLAYER_CLUB_ID ? 0 : 1, ag: 0, scorers: [] })));
    save.league.round = 13;
    save.cup = null;
    const last = userFixture(save)!;
    expect(bigMatch(save, last)?.kind).toMatch(/finalDay|decider|derby|summit/);
  });
});
