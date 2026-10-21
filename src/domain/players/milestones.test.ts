import { describe, expect, it } from 'vitest';
import { createCareer } from '../club/newCareer';
import { awardSeasonHonours, clubHonours } from '../league/honours';
import { scoringRuns } from '../league/stories';
import { PLAYER_CLUB_ID, type MatchRecord, type SeasonSummary } from '../save/types';
import { matchMilestones, upcomingMilestones } from './milestones';
import type { Footballer } from './types';

const stats = (matches: number, goals = 0, assists = 0, cleanSheets = 0): Footballer['stats'] => ({ matches, goals, assists, cleanSheets });

describe('match milestones', () => {
  it('debut, first goal and a hat-trick in one afternoon', () => {
    const m = matchMilestones(stats(0), stats(1, 3), { goals: 3, opponent: 'Cinderfield FC', firstGoalMinute: 12, keeper: false });
    expect(m.map((x) => x.kind)).toEqual(['hatTrick', 'firstGoal', 'debut']);
    expect(m[0]!.headline).toBe('HAT-TRICK HERO: three goals against Cinderfield FC.');
    expect(m[1]!.headline).toBe("First goal for the club (12') against Cinderfield FC.");
  });

  it('round numbers only when crossed, and the highest one crossed', () => {
    expect(matchMilestones(stats(9, 4), stats(10, 6), { goals: 2, opponent: 'X', keeper: false }).map((x) => x.kind)).toEqual(['goals', 'apps']);
    expect(matchMilestones(stats(10, 6), stats(11, 6), { goals: 0, opponent: 'X', keeper: false })).toEqual([]);
    expect(matchMilestones(stats(3, 0, 4), stats(4, 0, 5), { goals: 0, opponent: 'X', keeper: false })[0]!.kind).toBe('assists');
  });

  it('first clean sheet is a keeper’s moment; landmarks count for defenders too', () => {
    expect(matchMilestones(stats(1, 0, 0, 0), stats(2, 0, 0, 1), { goals: 0, opponent: 'X', keeper: true }).map((x) => x.kind)).toEqual(['firstCleanSheet']);
    expect(matchMilestones(stats(1, 0, 0, 0), stats(2, 0, 0, 1), { goals: 0, opponent: 'X', keeper: false })).toEqual([]);
    expect(matchMilestones(stats(8, 0, 0, 4), stats(9, 0, 0, 5), { goals: 0, opponent: 'X', keeper: false }).map((x) => x.kind)).toEqual(['cleanSheets']);
  });

  it('flags landmarks one game away for the starting seven', () => {
    const save = createCareer('ms-1', 'x');
    const [a, b] = Object.values(save.footballers) as [Footballer, Footballer];
    a.stats = stats(9, 0);
    b.stats = stats(3, 4);
    const up = upcomingMilestones([a, b]);
    expect(up.map((u) => u.playerId)).toEqual([b.id, a.id]);
    expect(up[0]!.text).toBe(`${b.lastName} is one goal from 5 for the club.`);
    expect(up[1]!.text).toBe(`${a.lastName} is set for his 10th appearance for the club.`);
  });
});

describe('season honours', () => {
  const summary = (position: number, outcome: SeasonSummary['outcome']): SeasonSummary => ({ season: 1, division: 0, divisionName: 'County League Division Two', position, played: 14, won: 10, drawn: 2, lost: 2, gf: 30, ga: 10, points: 32, outcome, prizeCoins: 600 });

  it('medals for everyone who played, the Golden Boot for our top scorer, nothing for a mid-table finish', () => {
    const save = createCareer('hon-1', 'x');
    const [p1, p2, p3] = save.squadIds as [string, string, string];
    save.matchRecords = [{ season: 1, gains: [{ playerId: p1, xp: 10, levelBefore: 1, levelAfter: 1, rating: 7 }, { playerId: p2, xp: 10, levelBefore: 1, levelAfter: 1, rating: 6 }, { playerId: p3, xp: 4, levelBefore: 1, levelAfter: 1 }] } as MatchRecord];
    save.league.results = [{ round: 0, home: PLAYER_CLUB_ID, away: 'cinderfield', hg: 2, ag: 0, scorers: [{ playerId: p2, name: 'Two', clubId: PLAYER_CLUB_ID }, { playerId: p2, name: 'Two', clubId: PLAYER_CLUB_ID }] }];
    const seq = save.nextSeq;
    expect(awardSeasonHonours(save, summary(1, 'promoted'))).toBe(3);
    expect(save.nextSeq).toBe(seq + 3);
    const honours = (id: string) => save.footballers[id]!.history.filter((h) => h.kind === 'honour').map((h) => h.headline);
    expect(honours(p1)).toEqual(['CHAMPIONS: County League Division Two title winner, season 1.']);
    expect(honours(p2)).toEqual(['CHAMPIONS: County League Division Two title winner, season 1.', 'GOLDEN BOOT: 2 league goals, top scorer in County League Division Two.']);
    expect(honours(p3)).toEqual([]); // on the bench all season

    const mid = createCareer('hon-2', 'x');
    mid.matchRecords = save.matchRecords;
    expect(awardSeasonHonours(mid, summary(4, 'stayed'))).toBe(0);
  });

  it('the trophy cabinet counts a league win once and a runners-up promotion separately', () => {
    expect(clubHonours([summary(1, 'promoted'), { ...summary(2, 'promoted'), season: 2 }, { ...summary(5, 'stayed'), season: 3 }, { ...summary(1, 'champions'), season: 4 }]).map((h) => `${h.season}:${h.kind}`)).toEqual(['1:title', '2:promotion', '4:title']);
  });

  it('scoring runs come from consecutive recent matches this season', () => {
    const rec = (scorers: string[], played: string[]) => ({ season: 1, userSide: 'home', scorers: scorers.map((id) => ({ playerId: id, name: id, side: 'home', minute: 1, tick: 1 })), gains: played.map((id) => ({ playerId: id, xp: 1, levelBefore: 1, levelAfter: 1, rating: 6 })) }) as unknown as MatchRecord;
    // Newest first: A scored in the last three, B in the last one (missed the one before).
    const runs = scoringRuns({ season: 1, matchRecords: [rec(['A', 'B'], ['A', 'B']), rec(['A'], ['A', 'B']), rec(['A', 'B'], ['A', 'B'])] });
    expect(runs).toEqual([
      { playerId: 'A', name: 'A', games: 3 },
      { playerId: 'B', name: 'B', games: 1 },
    ]);
  });
});
