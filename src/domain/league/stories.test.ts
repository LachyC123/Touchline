import { describe, expect, it } from 'vitest';
import { CLUB_BY_ID } from '../../data/clubs';
import { PLAYER_CLUB_ID, type ClubSave, type LeagueState, type MatchRecord } from '../save/types';
import { newLeague, userFixture } from './league';
import { clubForm, clubResults, currentStreak, fatesSealedIn, headToHead, preMatchStorylines, roundHeadline, roundSealed, seasonStory, settledFates, type FormEntry } from './stories';
import { divisionOf } from './league';

type Score = (home: string, away: string) => [number, number];

/** Fills rounds [from, to] with scripted scores. */
function play(league: LeagueState, to: number, score: Score, from = 0): LeagueState {
  const results = [...league.results];
  for (let r = from; r <= to; r++) {
    for (const f of league.rounds[r] ?? []) {
      const [hg, ag] = score(f.home, f.away);
      results.push({ round: r, home: f.home, away: f.away, hg, ag, scorers: [] });
    }
  }
  return { ...league, results, round: to + 1 };
}

/** We win 1–0, everyone else draws 0–0. */
const weWin: Score = (h, a) => (h === PLAYER_CLUB_ID ? [1, 0] : a === PLAYER_CLUB_ID ? [0, 1] : [0, 0]);
const weLose: Score = (h, a) => (h === PLAYER_CLUB_ID ? [0, 1] : a === PLAYER_CLUB_ID ? [1, 0] : [0, 0]);

function saveWith(league: LeagueState, matchRecords: Partial<MatchRecord>[] = []): Pick<ClubSave, 'league' | 'matchRecords' | 'club' | 'season'> {
  return { league, matchRecords: matchRecords as MatchRecord[], club: { name: 'Test Town', shortName: 'TST' } as ClubSave['club'], season: 1 };
}

const entry = (res: FormEntry['res']): FormEntry => ({ round: 0, res, opponentId: 'x', home: true, gf: 0, ga: 0 });

describe('form and streaks', () => {
  it('reads a club’s results oldest first and keeps the last five', () => {
    const league = play(newLeague('form-1', 1, 0), 6, weWin);
    const ours = clubResults(league, PLAYER_CLUB_ID);
    expect(ours).toHaveLength(7);
    expect(ours.map((r) => r.round)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ours.every((r) => r.res === 'W' && r.gf === 1 && r.ga === 0)).toBe(true);
    expect(clubForm(league, PLAYER_CLUB_ID)).toHaveLength(5);
  });

  it('names the most telling current run', () => {
    expect(currentStreak(['L', 'W', 'W', 'W'].map((r) => entry(r as FormEntry['res'])))).toEqual({ kind: 'won', length: 3 });
    expect(currentStreak(['L', 'W', 'D', 'W'].map((r) => entry(r as FormEntry['res'])))).toEqual({ kind: 'unbeaten', length: 3 });
    expect(currentStreak(['W', 'L', 'L'].map((r) => entry(r as FormEntry['res'])))).toEqual({ kind: 'lost', length: 2 });
    expect(currentStreak(['W', 'D', 'L', 'D'].map((r) => entry(r as FormEntry['res'])))).toEqual({ kind: 'winless', length: 3 });
    expect(currentStreak(['W', 'L', 'W'].map((r) => entry(r as FormEntry['res'])))).toBeNull();
    expect(currentStreak([])).toBeNull();
  });
});

describe('settled fates', () => {
  it('seals the title and promotion exactly when nobody can catch you', () => {
    // We win every game, the rest draw. After round r we have 3(r+1); the best chaser can reach
    // 40−2r before they have played us and 39−2r after: first unreachable at r = 8.
    const league = play(newLeague('fate-1', 1, 0), 13, weWin);
    expect(fatesSealedIn(league, 7)).toEqual([]);
    expect(fatesSealedIn(league, 8).sort()).toEqual(['champions', 'promoted']);
    expect(roundSealed(league, 'champions')).toBe(8);
    // Once sealed, it stays sealed.
    for (let r = 8; r <= 13; r++) expect(settledFates({ rounds: league.rounds, results: league.results.filter((x) => x.round <= r) }, divisionOf(0), PLAYER_CLUB_ID)).toContain('promoted');
  });

  it('relegation is only certain when six clubs are out of reach', () => {
    // We lose every game, the rest draw: rivals reach r+3, our ceiling is 3(13−r). First certain at r = 10.
    const league = play(newLeague('fate-2', 1, 1), 13, weLose);
    expect(roundSealed(league, 'relegated')).toBe(10);
    expect(settledFates({ rounds: league.rounds, results: league.results.filter((x) => x.round <= 9) }, divisionOf(1), PLAYER_CLUB_ID)).not.toContain('relegated');
    // Nobody is promoted out of the top division.
    const top = play(newLeague('fate-3', 1, 1), 13, weWin);
    expect(roundSealed(top, 'promoted')).toBeNull();
    expect(roundSealed(top, 'champions')).toBe(8);
    expect(roundSealed(top, 'safe')).not.toBeNull();
  });
});

describe('pre-match storylines', () => {
  it('opening day, final day and derby lines', () => {
    const league = newLeague('story-1', 1, 0);
    const fx = userFixture({ league, season: 1 })!;
    const lines = preMatchStorylines(saveWith(league), fx);
    expect(lines.map((l) => l.kind)).toContain('opener');

    const late = play(league, 12, weWin);
    const finalFx = userFixture({ league: late, season: 1 })!;
    expect(finalFx.round).toBe(13);
    expect(preMatchStorylines(saveWith(late), finalFx).some((l) => l.kind === 'finalDay')).toBe(true);
  });

  it('tells you when a win would seal the title', () => {
    const league = play(newLeague('story-2', 1, 0), 7, weWin);
    const fx = userFixture({ league, season: 1 })!;
    const lines = preMatchStorylines(saveWith(league), fx);
    expect(lines[0]).toMatchObject({ kind: 'clinch', text: 'Win and the title is yours.' });
    expect(lines.some((l) => l.kind === 'ourRun' && l.text.includes('8 in a row'))).toBe(true);
  });

  it('remembers the last meeting: revenge after a defeat, derby for rivals', () => {
    const league = play(newLeague('story-3', 1, 0), 2, weWin);
    const fx = { club: CLUB_BY_ID.stagmoor!, round: 3, home: true };
    const lost = [{ opponentId: 'stagmoor', season: 1, round: 1, userSide: 'home', score: { home: 0, away: 2 } }] as Partial<MatchRecord>[];
    expect(headToHead(saveWith(league, lost), 'stagmoor')[0]).toMatchObject({ gf: 0, ga: 2 });
    expect(preMatchStorylines(saveWith(league, lost), fx).find((l) => l.kind === 'revenge')?.text).toBe('They beat you 2–0 in round 2. Revenge is on the menu.');

    const rival = { club: CLUB_BY_ID.copperton!, round: 3, home: false };
    expect(CLUB_BY_ID.copperton!.rival).toBe(true);
    expect(preMatchStorylines(saveWith(league), rival).some((l) => l.kind === 'derby')).toBe(true);
  });

  it('is deterministic and capped', () => {
    const league = play(newLeague('story-4', 1, 0), 5, (h, a) => [(h.length + a.length) % 3, (h.length * a.length) % 2]);
    const fx = userFixture({ league, season: 1 })!;
    const a = preMatchStorylines(saveWith(league), fx);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(preMatchStorylines(saveWith(league), fx)).toEqual(a);
  });
});

describe('around the league', () => {
  it('leads with the leaders slipping up', () => {
    const base = newLeague('round-1', 1, 0);
    // Round 0: one AI club wins big and goes top; round 1: they lose.
    const r0 = base.rounds[0]!.find((f) => f.home !== PLAYER_CLUB_ID && f.away !== PLAYER_CLUB_ID)!;
    const leader = r0.home;
    const league = play(base, 1, (h, a) => {
      if (h === leader || a === leader) {
        const leaderHome = h === leader;
        const inRound0 = (h === r0.home && a === r0.away);
        return inRound0 ? (leaderHome ? [5, 0] : [0, 5]) : leaderHome ? [0, 2] : [2, 0];
      }
      return [0, 0];
    });
    expect(roundHeadline(league, 1, 'Test Town')).toMatch(new RegExp(`^Leaders ${CLUB_BY_ID[leader]!.name} beaten 2–0 by `));
    expect(roundHeadline(league, 0, 'Test Town')).toMatch(/run riot: 5–0/);
  });
});

describe('season story', () => {
  it('finds the best win, longest run and the round it was sealed', () => {
    const league = play(newLeague('ss-1', 1, 0), 13, weWin);
    const story = seasonStory({ league, club: { name: 'Test Town' } as ClubSave['club'] }, 'champions');
    expect(story.longestWinRun).toBe(14);
    expect(story.sealedRound).toBe(8);
    expect(story.bestWin?.round).toBe(0);
    expect(story.homeRecord.won).toBe(7);
  });
});
