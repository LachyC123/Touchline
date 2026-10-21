import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLUBS, DIVISION_ONE_CLUBS } from '../data/clubs';
import { colourDistance, KIT_CLASH_DISTANCE } from '../domain/club/onboarding';
import { createCareer } from '../domain/club/newCareer';
import { leagueTable, newLeague, ROUNDS_PER_SEASON, scheduleSeason, seasonComplete, seasonOutcome, simulateOtherFixtures } from '../domain/league/league';
import { prepareMatch } from '../domain/match/settle';
import { seasonAppearances } from '../domain/league/honours';
import { PLAYER_CLUB_ID } from '../domain/save/types';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { beginNextSeason, kickOff, loadSave, mutateSave, onboardingEvent, settleMatchOnce, startNewCareer } from './saveRepo';

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  db = new TouchlineDB(`league-${n++}`);
  setDbForTests(db);
  await db.open();
});
afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('fixture list', () => {
  it('is a fair double round robin: everyone plays once a round, each pair home and away', () => {
    const rounds = scheduleSeason('sched-1', 1, 0);
    expect(rounds).toHaveLength(ROUNDS_PER_SEASON);
    const pairs = new Map<string, number>();
    const homes = new Map<string, number>();
    for (const round of rounds) {
      expect(round).toHaveLength(4);
      const ids = round.flatMap((f) => [f.home, f.away]);
      expect(new Set(ids).size).toBe(8);
      for (const f of round) {
        pairs.set(`${f.home}>${f.away}`, (pairs.get(`${f.home}>${f.away}`) ?? 0) + 1);
        homes.set(f.home, (homes.get(f.home) ?? 0) + 1);
      }
    }
    expect(pairs.size).toBe(56); // 8×7 ordered pairs, each exactly once
    for (const v of pairs.values()) expect(v).toBe(1);
    for (const v of homes.values()) expect(v).toBe(7);
  });

  it('a career opens at home to the weakest club in the division', () => {
    for (const seed of ['open-1', 'open-2', 'open-3', 'open-4']) {
      const first = scheduleSeason(seed, 1, 0)[0]!.find((f) => f.home === PLAYER_CLUB_ID || f.away === PLAYER_CLUB_ID)!;
      expect(first).toEqual({ home: PLAYER_CLUB_ID, away: 'cinderfield' });
    }
  });

  it('is stable for a career and season, different across seasons', () => {
    expect(scheduleSeason('sched-2', 1, 0)).toEqual(scheduleSeason('sched-2', 1, 0));
    expect(scheduleSeason('sched-2', 2, 0)).not.toEqual(scheduleSeason('sched-2', 1, 0));
    expect(scheduleSeason('sched-2', 1, 1).flat().some((f) => f.home === 'halverton' || f.away === 'halverton')).toBe(true);
  });

  it('AI fixtures are simulated deterministically', () => {
    const league = newLeague('ai-fix', 1, 0);
    const a = simulateOtherFixtures('ai-fix', 1, league, 0);
    const b = simulateOtherFixtures('ai-fix', 1, league, 0);
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    for (const r of a) expect(r.scorers.filter((s) => s.clubId === r.home)).toHaveLength(r.hg);
  });

  it('every club kit reads against the pitch', () => {
    for (const c of [...CLUBS, ...DIVISION_ONE_CLUBS]) expect(colourDistance(c.kit.primary, '#1E8D70')).toBeGreaterThan(KIT_CLASH_DISTANCE);
  });
});

describe('a full season', () => {
  it('plays 14 rounds, keeps a table that adds up, then closes exactly once', async () => {
    await startNewCareer('season-run', db);
    await onboardingEvent('skip', db);
    for (let m = 0; m < ROUNDS_PER_SEASON; m++) {
      const pm = await kickOff(db);
      expect(pm.round).toBe(m);
      await settleMatchOnce(pm.matchId, db);
    }
    let s = (await loadSave(db))!;
    expect(seasonComplete(s.league)).toBe(true);
    expect(s.league.results).toHaveLength(ROUNDS_PER_SEASON * 4);
    const table = leagueTable(s.league, (id) => id);
    expect(table).toHaveLength(8);
    for (const r of table) {
      expect(r.played).toBe(ROUNDS_PER_SEASON);
      expect(r.won + r.drawn + r.lost).toBe(ROUNDS_PER_SEASON);
    }
    const goalsFor = table.reduce((sum, r) => sum + r.gf, 0);
    const goalsAgainst = table.reduce((sum, r) => sum + r.ga, 0);
    expect(goalsFor).toBe(goalsAgainst);
    const draws = s.league.results.filter((r) => r.hg === r.ag).length;
    expect(table.reduce((sum, r) => sum + r.points, 0)).toBe(3 * (s.league.results.length - draws) + 2 * draws);
    // Our results in the table match our match records.
    const ours = table.find((r) => r.clubId === PLAYER_CLUB_ID)!;
    const recordGoals = s.matchRecords.filter((r) => r.season === 1).reduce((sum, r) => sum + r.score[r.userSide], 0);
    expect(ours.gf).toBe(recordGoals);
    expect(() => prepareMatch(s)).toThrow(/season is over/i);

    const outcome = seasonOutcome(s);
    const coinsBefore = s.coins;
    const [x, y] = await Promise.all([beginNextSeason(db), beginNextSeason(db)]);
    expect([x.applied, y.applied].sort()).toEqual([false, true]);
    s = (await loadSave(db))!;
    expect(s.season).toBe(2);
    expect(s.seasons).toHaveLength(1);
    expect(s.seasons[0]!.position).toBe(outcome.position);
    expect(s.coins).toBe(coinsBefore + outcome.prizeCoins);
    expect(s.league.division).toBe(outcome.position <= 2 ? 1 : 0);
    expect(s.league.round).toBe(0);
    expect(s.league.results).toEqual([]);
    // Honours were stamped once, for the players who actually played.
    const played = seasonAppearances(s, 1);
    expect(played.size).toBeGreaterThanOrEqual(7);
    for (const p of Object.values(s.footballers)) {
      const hs = p.history.filter((h) => h.kind === 'honour').map((h) => h.headline);
      expect(new Set(hs).size).toBe(hs.length);
      const medal = hs.some((h) => /^(CHAMPIONS|PROMOTED):/.test(h));
      expect(medal).toBe(outcome.position <= 2 && played.has(p.id));
    }
    // Season 2 kicks off normally.
    const next = await kickOff(db);
    expect(next.season).toBe(2);
  });

  it('promotion and relegation follow the final position', async () => {
    await startNewCareer('promo', db);
    // Fake a finished Division Two season where we won every match.
    await mutateSave((s) => {
      s.league.results = s.league.rounds.flatMap((round, ri) => round.map((f) => ({ round: ri, home: f.home, away: f.away, hg: f.home === PLAYER_CLUB_ID ? 3 : 1, ag: f.away === PLAYER_CLUB_ID ? 3 : 1, scorers: [] })));
      s.league.round = s.league.rounds.length;
    }, {}, db);
    const { summary } = await beginNextSeason(db);
    expect(summary.position).toBe(1);
    expect(summary.outcome).toBe('promoted');
    expect((await loadSave(db))!.league.division).toBe(1);
    // …and a Division One season where we lost every match.
    await mutateSave((s) => {
      s.league.results = s.league.rounds.flatMap((round, ri) => round.map((f) => ({ round: ri, home: f.home, away: f.away, hg: f.away === PLAYER_CLUB_ID ? 2 : 0, ag: f.home === PLAYER_CLUB_ID ? 2 : 0, scorers: [] })));
      s.league.round = s.league.rounds.length;
    }, {}, db);
    const second = await beginNextSeason(db);
    expect(second.summary.outcome).toBe('relegated');
    expect((await loadSave(db))!.league.division).toBe(0);
  });

  it('a v4 save migrates into a fresh Division Two season', () => {
    const v5 = createCareer('league-mig', 'x');
    const { league: _l, seasons: _s, ...rest } = v5;
    const v4 = { ...rest, schemaVersion: 4, contentVersion: 'content-4', season: 2 };
    const m = migrateSave(v4);
    expect(m.schemaVersion).toBe(5);
    expect(m.league.division).toBe(0);
    expect(m.league.round).toBe(0);
    expect(m.league.rounds).toEqual(scheduleSeason('league-mig', 2, 0));
    expect(m.seasons).toEqual([]);
  });
});
