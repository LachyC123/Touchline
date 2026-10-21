import type { ClubDef } from '../../data/clubs';
import { clubOf, divisionOf, divisionsOf, type World } from '../world/world';
import { matchSquad } from '../../game/simulation/fromSquad';
import { replayMatch } from '../../game/simulation/replay';
import type { MatchResult } from '../../game/simulation/types';
import { grantClubXp } from '../club/manager';
import { opponentLineup } from '../club/opponents';
import { awardSeasonHonours, seasonAppearances } from './honours';
import { fulfilDream } from '../players/dreams';
import { REP_GAIN } from '../club/reputation';
import { cupFinished, cupWinner, newCup, userCupTie } from '../cup/cup';
import { createRng } from '../rng';
import { PLAYER_CLUB_ID, type ClubSave, type Competition, type CupState, type LeagueFixture, type LeagueResult, type LeagueState, type SeasonSummary } from '../save/types';

export const ROUNDS_PER_SEASON = 14;
/** Squad strength added per season played (opponents improve over time too). */
export const SEASON_STRENGTH_STEP = 2;
export const MAX_SEASON_STRENGTH_STEPS = 5;

/**
 * Double round robin for 8 clubs (circle method): 7 rounds, then the same 7 with home and away
 * swapped. Club order is shuffled from the career seed + season, so every career has its own
 * calendar, and the same save always gets the same one.
 */
export function scheduleSeason(careerSeed: string, world: World, season: number, division: number): LeagueFixture[][] {
  const ids = [PLAYER_CLUB_ID, ...divisionOf(world, division).clubs.map((c) => c.id)];
  const rng = createRng(`${careerSeed}::league:s${season}:d${division}`);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  }
  const n = ids.length;
  const firstHalf: LeagueFixture[][] = [];
  let ring = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const round: LeagueFixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i] as string;
      const b = ring[n - 1 - i] as string;
      // Alternate so nobody plays long runs at home or away.
      const swap = (i === 0 && r % 2 === 1) || (i > 0 && (r + i) % 2 === 1);
      round.push(swap ? { home: b, away: a } : { home: a, away: b });
    }
    firstHalf.push(round);
    // Keep the first club fixed and rotate the rest.
    ring = [ring[0] as string, ring[n - 1] as string, ...ring.slice(1, n - 1)];
  }
  // A career's very first match is against the division's weakest side (a gentle opener):
  // swap whole rounds, so every club still plays everyone home and away.
  if (season === 1) {
    const weakest = [...divisionOf(world, division).clubs].sort((a, b) => a.baseOvr - b.baseOvr)[0]?.id;
    const k = firstHalf.findIndex((round) => round.some((f) => (f.home === PLAYER_CLUB_ID && f.away === weakest) || (f.away === PLAYER_CLUB_ID && f.home === weakest)));
    if (k > 0) [firstHalf[0], firstHalf[k]] = [firstHalf[k] as LeagueFixture[], firstHalf[0] as LeagueFixture[]];
    // …and at home.
    const opener = firstHalf[0]?.find((f) => f.away === PLAYER_CLUB_ID && f.home === weakest);
    if (opener) [opener.home, opener.away] = [opener.away, opener.home];
  }
  const secondHalf = firstHalf.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  return [...firstHalf, ...secondHalf];
}

export function newLeague(careerSeed: string, world: World, season: number, division: number): LeagueState {
  return { division, rounds: scheduleSeason(careerSeed, world, season, division), round: 0, results: [] };
}

export function seasonComplete(league: LeagueState): boolean {
  return league.round >= league.rounds.length;
}

/** Every league fixture and every cup round of the season has been played. */
export function seasonOver(save: Pick<ClubSave, 'league'> & Partial<Pick<ClubSave, 'cup'>>): boolean {
  return seasonComplete(save.league) && cupFinished(save.cup ?? null);
}

/** How far the club went in this season's cup. */
export function cupRun(cup: CupState | null): SeasonSummary['cup'] | undefined {
  if (!cup) return undefined;
  let reached = 0;
  cup.rounds.forEach((ties, r) => {
    if (ties.some((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID)) reached = r;
  });
  return { reached, won: cupWinner(cup) === PLAYER_CLUB_ID };
}

export interface UserFixture {
  club: ClubDef;
  home: boolean;
  /** League round (for a cup tie: the league round it is played before). */
  round: number;
  /** Strength step for the opposition squad. */
  lap: number;
  competition: Competition;
  /** Cup round index, for cup ties. */
  cupRound?: number;
}

export function strengthLap(season: number): number {
  return Math.min(MAX_SEASON_STRENGTH_STEPS, Math.max(0, season - 1));
}

/** The player's next fixture (a due cup tie comes first), or null once the season is complete. */
export function userFixture(save: Pick<ClubSave, 'league' | 'season' | 'world'> & Partial<Pick<ClubSave, 'cup'>>): UserFixture | null {
  const tie = userCupTie({ league: save.league, season: save.season, cup: save.cup ?? null, world: save.world });
  if (tie) return { club: tie.club, home: tie.home, round: save.league.round, lap: tie.lap, competition: 'cup', cupRound: tie.cupRound };
  const round = save.league.rounds[save.league.round];
  if (!round) return null;
  const f = round.find((x) => x.home === PLAYER_CLUB_ID || x.away === PLAYER_CLUB_ID);
  if (!f) return null;
  const home = f.home === PLAYER_CLUB_ID;
  const club = clubOf(save.world, home ? f.away : f.home);
  if (!club) throw new Error('Unknown club in the fixture list');
  return { club, home, round: save.league.round, lap: strengthLap(save.season), competition: 'league' };
}

function scorersOf(result: MatchResult, homeId: string, awayId: string, names: Map<string, string>): LeagueResult['scorers'] {
  return result.events.flatMap((e) => (e.type === 'GOAL' ? [{ playerId: e.scorerId, name: names.get(e.scorerId) ?? 'Unknown', clubId: e.team === 'home' ? homeId : awayId }] : []));
}

/** Records the player's own result for the round (from the settled match). */
export function userLeagueResult(round: number, homeId: string, awayId: string, result: MatchResult, names: Map<string, string>): LeagueResult {
  return { round, home: homeId, away: awayId, hg: result.score.home, ag: result.score.away, scorers: scorersOf(result, homeId, awayId, names) };
}

/**
 * The other fixtures of a round, simulated by the same engine (both benches AI-managed) from a
 * seed tied to the career, season, round and clubs — so they never change once played.
 */
export function simulateOtherFixtures(careerSeed: string, world: World, season: number, league: LeagueState, round: number): LeagueResult[] {
  const fixtures = league.rounds[round] ?? [];
  const lap = strengthLap(season);
  const out: LeagueResult[] = [];
  for (const f of fixtures) {
    if (f.home === PLAYER_CLUB_ID || f.away === PLAYER_CLUB_ID) continue;
    const hc = clubOf(world, f.home);
    const ac = clubOf(world, f.away);
    if (!hc || !ac) continue;
    const home = opponentLineup(careerSeed, { number: round, club: hc, lap, home: true }, world).lineup;
    const away = opponentLineup(careerSeed, { number: round, club: ac, lap, home: false }, world).lineup;
    const seed = `${careerSeed}:s${season}:r${round}:${f.home}-v-${f.away}`;
    const result = replayMatch({ matchId: seed, seed, home, away, userSide: null }, []);
    const names = new Map([...matchSquad(home), ...matchSquad(away)].map((p) => [p.id, p.name] as const));
    out.push(userLeagueResult(round, f.home, f.away, result, names));
  }
  return out;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** Most recent last. */
  form: ('W' | 'D' | 'L')[];
}

/** Standings from the results alone: 3 for a win, 1 for a draw; then goal difference, goals, name. */
export function leagueTable(league: Pick<LeagueState, 'results' | 'rounds'>, nameOf: (id: string) => string): TableRow[] {
  const ids = new Set(league.rounds[0]?.flatMap((f) => [f.home, f.away]) ?? []);
  const rows = new Map<string, TableRow>([...ids].map((id) => [id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] }]));
  const sorted = [...league.results].sort((a, b) => a.round - b.round);
  for (const r of sorted) {
    const h = rows.get(r.home);
    const a = rows.get(r.away);
    if (!h || !a) continue;
    for (const [row, gf, ga] of [[h, r.hg, r.ag], [a, r.ag, r.hg]] as const) {
      row.played++;
      row.gf += gf;
      row.ga += ga;
      const res = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
      if (res === 'W') row.won++;
      else if (res === 'D') row.drawn++;
      else row.lost++;
      row.form = [...row.form, res].slice(-5) as TableRow['form'];
    }
  }
  for (const row of rows.values()) {
    row.gd = row.gf - row.ga;
    row.points = row.won * 3 + row.drawn;
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || nameOf(x.clubId).localeCompare(nameOf(y.clubId)));
}

export function topScorers(league: Pick<LeagueState, 'results'>, limit = 10): { playerId: string; name: string; clubId: string; goals: number }[] {
  const tally = new Map<string, { playerId: string; name: string; clubId: string; goals: number }>();
  for (const r of league.results) {
    for (const s of r.scorers) {
      const t = tally.get(s.playerId) ?? { ...s, goals: 0 };
      t.goals++;
      tally.set(s.playerId, t);
    }
  }
  return [...tally.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, limit);
}

export const SEASON_PRIZES: readonly number[] = [600, 450, 350, 300, 250, 200, 175, 150];
export const SEASON_CLUB_XP: readonly number[] = [160, 130, 110, 100, 90, 80, 70, 60];

/** Final position, what it means and the prize, for a complete season (no mutation). */
export function seasonOutcome(save: Pick<ClubSave, 'league' | 'club' | 'season' | 'world'> & Partial<Pick<ClubSave, 'cup'>>): Omit<SeasonSummary, 'topScorer'> & { topScorer?: SeasonSummary['topScorer']; nextDivision: number } {
  const div = divisionOf(save.world, save.league.division);
  const table = leagueTable(save.league, (id) => clubName(save.world, id, save.club.name));
  const idx = table.findIndex((r) => r.clubId === PLAYER_CLUB_ID);
  const row = table[idx] as TableRow;
  const position = idx + 1;
  let outcome: SeasonSummary['outcome'] = 'stayed';
  let nextDivision = save.league.division;
  if (div.promote > 0 && position <= div.promote && nextDivision < divisionsOf(save.world).length - 1) {
    outcome = 'promoted';
    nextDivision++;
  } else if (div.relegate > 0 && position > table.length - div.relegate && nextDivision > 0) {
    outcome = 'relegated';
    nextDivision--;
  } else if (position === 1) {
    outcome = 'champions';
  }
  const ours = topScorers({ results: save.league.results.map((r) => ({ ...r, scorers: r.scorers.filter((x) => x.clubId === PLAYER_CLUB_ID) })) }, 1)[0];
  return {
    season: save.season,
    division: save.league.division,
    divisionName: div.name,
    position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    gf: row.gf,
    ga: row.ga,
    points: row.points,
    outcome,
    prizeCoins: SEASON_PRIZES[idx] ?? 100,
    ...(cupRun(save.cup ?? null) ? { cup: cupRun(save.cup ?? null) } : {}),
    ...(ours ? { topScorer: { name: ours.name, goals: ours.goals } } : {}),
    nextDivision,
  };
}

/** Closes the season on a draft: summary, prize, promotion/relegation, a fresh schedule. */
export function startNextSeason(draft: ClubSave): SeasonSummary {
  if (!seasonOver(draft)) throw new Error('The season is not finished yet.');
  if (draft.pendingMatch) throw new Error('Finish the current match first.');
  const { nextDivision, ...summary } = seasonOutcome(draft);
  const idx = summary.position - 1;
  const division = nextDivision;
  const prizeCoins = summary.prizeCoins;
  draft.seasons.push(summary);
  awardSeasonHonours(draft, summary);
  if (summary.position === 1) draft.club.reputation += REP_GAIN.champions;
  else if (summary.outcome === 'promoted') draft.club.reputation += REP_GAIN.promoted;
  // "Win promotion": comes true for everyone with that dream who played in a promotion season.
  if (summary.outcome === 'promoted' || (summary.position === 1 && divisionOf(draft.world, summary.division).promote > 0)) {
    for (const id of seasonAppearances(draft, summary.season)) if (draft.footballers[id]?.dreamId === 'promotion') fulfilDream(draft, id);
  }
  draft.coins += prizeCoins;
  grantClubXp(draft, SEASON_CLUB_XP[idx] ?? 50);
  draft.season++;
  draft.league = newLeague(draft.careerSeed, draft.world, draft.season, division);
  draft.cup = newCup(draft.careerSeed, draft.world, draft.season);
  return summary;
}

export { divisionOf };

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Display name for a club id (the player's own club takes its current name). */
export function clubName(world: World, id: string, ownName: string): string {
  return id === PLAYER_CLUB_ID ? ownName : (clubOf(world, id)?.name ?? id);
}
