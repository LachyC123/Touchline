import { CLUB_BY_ID, type DivisionDef } from '../../data/clubs';
import { PLAYER_CLUB_ID, type ClubSave, type LeagueResult, type LeagueState } from '../save/types';
import { upcomingMilestones } from '../players/milestones';
import { CUP_NAME, CUP_ROUNDS, cupRoundName, divisionIndexOf } from '../cup/cup';
import { clubName, divisionOf, leagueTable, ordinal, topScorers, type TableRow, type UserFixture } from './league';

/**
 * Narrative built only from stored results: form, streaks, head-to-heads, what a fixture means
 * for the table, and when a season's fate is mathematically settled. Pure and deterministic, so
 * every screen tells the same story from the same save.
 */

export type FormLetter = 'W' | 'D' | 'L';

export interface FormEntry {
  round: number;
  res: FormLetter;
  opponentId: string;
  home: boolean;
  gf: number;
  ga: number;
}

/** A club's league results this season, oldest first. */
export function clubResults(league: Pick<LeagueState, 'results'>, clubId: string): FormEntry[] {
  return league.results
    .filter((r) => r.home === clubId || r.away === clubId)
    .sort((a, b) => a.round - b.round)
    .map((r) => {
      const home = r.home === clubId;
      const gf = home ? r.hg : r.ag;
      const ga = home ? r.ag : r.hg;
      return { round: r.round, res: gf > ga ? 'W' : gf === ga ? 'D' : 'L', opponentId: home ? r.away : r.home, home, gf, ga };
    });
}

export function clubForm(league: Pick<LeagueState, 'results'>, clubId: string, n = 5): FormEntry[] {
  return clubResults(league, clubId).slice(-n);
}

export interface Streak {
  kind: 'won' | 'unbeaten' | 'lost' | 'winless';
  length: number;
}

/** The most telling current run (wins beat unbeaten; defeats beat winless). Null under 2 games. */
export function currentStreak(results: readonly FormEntry[]): Streak | null {
  const run = (pred: (r: FormEntry) => boolean) => {
    let n = 0;
    for (let i = results.length - 1; i >= 0 && pred(results[i] as FormEntry); i--) n++;
    return n;
  };
  const won = run((r) => r.res === 'W');
  if (won >= 2) return { kind: 'won', length: won };
  const unbeaten = run((r) => r.res !== 'L');
  if (unbeaten >= 3) return { kind: 'unbeaten', length: unbeaten };
  const lost = run((r) => r.res === 'L');
  if (lost >= 2) return { kind: 'lost', length: lost };
  const winless = run((r) => r.res !== 'W');
  if (winless >= 3) return { kind: 'winless', length: winless };
  return null;
}

/** Longest winning run in a list of results. */
export function longestWinRun(results: readonly FormEntry[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    cur = r.res === 'W' ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

export interface Meeting {
  season: number;
  round: number;
  gf: number;
  ga: number;
  home: boolean;
}

/** Previous meetings with a club from the stored match records (newest first). */
export function headToHead(save: Pick<ClubSave, 'matchRecords'>, opponentId: string): Meeting[] {
  return save.matchRecords
    .filter((m) => m.opponentId === opponentId && m.season !== undefined)
    .map((m) => {
      const them = m.userSide === 'home' ? 'away' : 'home';
      return { season: m.season as number, round: m.round ?? 0, gf: m.score[m.userSide], ga: m.score[them], home: m.userSide === 'home' };
    });
}

/** Our players on a scoring run: consecutive most recent matches (this season) with a goal. */
export function scoringRuns(save: Pick<ClubSave, 'matchRecords' | 'season'>): { playerId: string; name: string; games: number }[] {
  const recent = save.matchRecords.filter((m) => m.season === save.season);
  const runs = new Map<string, { playerId: string; name: string; games: number }>();
  const broken = new Set<string>();
  for (const m of recent) {
    const scorers = new Map(m.scorers.filter((s) => s.side === m.userSide).map((s) => [s.playerId, s.name] as const));
    const played = new Set(m.gains.filter((g) => g.rating !== undefined).map((g) => g.playerId));
    for (const id of played) {
      if (broken.has(id)) continue;
      const name = scorers.get(id);
      if (name) runs.set(id, { playerId: id, name, games: (runs.get(id)?.games ?? 0) + 1 });
      else broken.add(id);
    }
  }
  return [...runs.values()].sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
}

// ── Clinching ───────────────────────────────────────────────────────────────────────────────

export type Fate = 'champions' | 'promoted' | 'safe' | 'relegated';

function remainingFor(league: Pick<LeagueState, 'rounds'>, row: TableRow): number {
  return Math.max(0, league.rounds.length - row.played);
}

/**
 * Which outcomes are already certain for a club, whatever happens in the remaining fixtures.
 * Conservative: any club that could finish level on points counts as finishing above.
 */
export function settledFates(league: Pick<LeagueState, 'rounds' | 'results'>, div: Pick<DivisionDef, 'promote' | 'relegate'>, clubId: string): Fate[] {
  const table = leagueTable(league, (id) => id);
  const us = table.find((r) => r.clubId === clubId);
  if (!us) return [];
  const others = table.filter((r) => r.clubId !== clubId);
  const n = table.length;
  // How many clubs could still finish level with or above us, and how many are out of reach above.
  const canCatch = others.filter((r) => r.points + 3 * remainingFor(league, r) >= us.points).length;
  const ourMax = us.points + 3 * remainingFor(league, us);
  const outOfReach = others.filter((r) => r.points > ourMax).length;
  const fates: Fate[] = [];
  if (canCatch === 0) fates.push('champions');
  if (div.promote > 0 && canCatch < div.promote) fates.push('promoted');
  if (div.relegate > 0) {
    if (canCatch < n - div.relegate) fates.push('safe');
    if (outOfReach >= n - div.relegate) fates.push('relegated');
  }
  return fates;
}

/** Results up to (and including) a round. */
export function throughRound<T extends Pick<LeagueState, 'rounds' | 'results'>>(league: T, round: number): Pick<LeagueState, 'rounds' | 'results'> {
  return { rounds: league.rounds, results: league.results.filter((r) => r.round <= round) };
}

/** Outcomes that became certain in this round (for the result screen and season story). */
export function fatesSealedIn(league: Pick<LeagueState, 'rounds' | 'results' | 'division'>, round: number, clubId = PLAYER_CLUB_ID): Fate[] {
  const div = divisionOf(league.division);
  const before = new Set(settledFates(throughRound(league, round - 1), div, clubId));
  return settledFates(throughRound(league, round), div, clubId).filter((f) => !before.has(f));
}

/** The round in which a fate was sealed this season, if it has been. */
export function roundSealed(league: Pick<LeagueState, 'rounds' | 'results' | 'division'>, fate: Fate, clubId = PLAYER_CLUB_ID): number | null {
  const last = Math.max(-1, ...league.results.map((r) => r.round));
  for (let r = 0; r <= last; r++) if (fatesSealedIn(league, r, clubId).includes(fate)) return r;
  return null;
}

// ── Pre-match storylines ───────────────────────────────────────────────────────────────────

export type StoryKind = 'finalDay' | 'opener' | 'clinch' | 'survive' | 'summit' | 'leapfrog' | 'chase' | 'scrap' | 'derby' | 'revenge' | 'meeting' | 'ourRun' | 'theirRun' | 'ourScorer' | 'theirScorer' | 'milestone' | 'hotStreak' | 'cupRound' | 'cupFinal' | 'giantKilling' | 'bananaSkin' | 'knockout';

export interface Storyline {
  kind: StoryKind;
  /** hype = an opportunity, warn = a threat, info = colour. */
  tone: 'hype' | 'warn' | 'info';
  text: string;
  /** Higher sorts first. */
  weight: number;
}

function runText(name: string, s: Streak, ours: boolean): string {
  const subject = ours ? 'You have' : `${name} have`;
  if (s.kind === 'won') return `${subject} won ${s.length} in a row.`;
  if (s.kind === 'unbeaten') return `${subject} gone ${s.length} unbeaten.`;
  if (s.kind === 'lost') return ours ? `${s.length} defeats on the bounce. Time to respond.` : `${name} have lost ${s.length} straight. Catch them while they’re down.`;
  return ours ? `No win in ${s.length}. Somebody needs to step up.` : `${name} haven’t won in ${s.length}.`;
}

function score(m: Meeting): string {
  return `${m.gf}–${m.ga}`;
}

/**
 * Up to `limit` short lines that make the next fixture matter: what it means for the table,
 * form, the last meeting, and who is scoring. Built only from stored results.
 */
export function preMatchStorylines(save: Pick<ClubSave, 'league' | 'matchRecords' | 'club' | 'season'> & Partial<Pick<ClubSave, 'footballers' | 'lineup'>>, fixture: Pick<UserFixture, 'club' | 'round' | 'home'>, limit = 3): Storyline[] {
  const league = save.league;
  const div = divisionOf(league.division);
  const opp = fixture.club;
  const them = opp.shortName;
  const out: Storyline[] = [];
  const add = (kind: StoryKind, tone: Storyline['tone'], text: string, weight: number) => out.push({ kind, tone, text, weight });
  const lastRound = fixture.round === league.rounds.length - 1;
  const played = league.results.length > 0;

  if (lastRound) add('finalDay', 'hype', 'Final day of the season. Everything is decided today.', 95);
  if (!played) add('opener', 'info', `Opening day of season ${save.season}. Every club starts on zero.`, 60);

  if (played) {
    const table = leagueTable(league, (id) => clubName(id, save.club.name));
    const ourIdx = table.findIndex((r) => r.clubId === PLAYER_CLUB_ID);
    const theirIdx = table.findIndex((r) => r.clubId === opp.id);
    const us = table[ourIdx] as TableRow;
    const theirs = table[theirIdx] as TableRow;
    const n = table.length;

    // What a win would seal: add our three points and this game to the table, keep the rest open.
    const hypothetical: Pick<LeagueState, 'rounds' | 'results'> = {
      rounds: league.rounds,
      results: [...league.results, { round: fixture.round, home: fixture.home ? PLAYER_CLUB_ID : opp.id, away: fixture.home ? opp.id : PLAYER_CLUB_ID, hg: fixture.home ? 1 : 0, ag: fixture.home ? 0 : 1, scorers: [] }],
    };
    const now = new Set(settledFates(league, div, PLAYER_CLUB_ID));
    const withWin = settledFates(hypothetical, div, PLAYER_CLUB_ID).filter((f) => !now.has(f));
    if (withWin.includes('champions')) add('clinch', 'hype', 'Win and the title is yours.', 100);
    else if (withWin.includes('promoted')) add('clinch', 'hype', 'Win and promotion is sealed.', 99);
    else if (withWin.includes('safe')) add('survive', 'hype', 'Win and you are safe from relegation.', 90);

    if (ourIdx <= 1 && theirIdx <= 1) add('summit', 'hype', `Top-of-the-table clash: ${ordinal(ourIdx + 1)} against ${ordinal(theirIdx + 1)}.`, 85);
    else if (ourIdx === 0) add('summit', 'info', `You’re top of the table. Keep it that way.`, 55);
    else if (theirIdx < ourIdx && theirs.points - us.points <= 2) add('leapfrog', 'hype', `${them} are ${theirs.points - us.points === 0 ? 'level on points' : `${theirs.points - us.points} point${theirs.points - us.points === 1 ? '' : 's'} ahead`}. Win and you go above them.`, 75);

    if (div.promote > 0 && ourIdx >= div.promote) {
      const line = table[div.promote - 1] as TableRow;
      const gap = line.points - us.points;
      if (gap <= 6) add('chase', 'warn', gap === 0 ? 'Level on points with the promotion places.' : `${gap} point${gap === 1 ? '' : 's'} off the promotion places.`, 70);
    }
    if (div.relegate > 0) {
      const dropIdx = n - div.relegate;
      if (ourIdx >= dropIdx - 1 && theirIdx >= dropIdx - 1) add('scrap', 'warn', 'A six-pointer at the bottom. Losing this one hurts twice.', 80);
      else if (ourIdx >= dropIdx) add('scrap', 'warn', `You’re in the relegation places (${ordinal(ourIdx + 1)}).`, 72);
    }

    const ourRun = currentStreak(clubResults(league, PLAYER_CLUB_ID));
    if (ourRun) add('ourRun', ourRun.kind === 'won' || ourRun.kind === 'unbeaten' ? 'hype' : 'warn', runText(save.club.shortName, ourRun, true), 40 + ourRun.length * 4);
    const theirRun = currentStreak(clubResults(league, opp.id));
    if (theirRun) add('theirRun', theirRun.kind === 'won' || theirRun.kind === 'unbeaten' ? 'warn' : 'hype', runText(them, theirRun, false), 36 + theirRun.length * 4);

    const scorers = topScorers(league, 50);
    const ourTop = scorers.find((s) => s.clubId === PLAYER_CLUB_ID);
    const theirTop = scorers.find((s) => s.clubId === opp.id);
    const leader = scorers[0];
    if (ourTop && ourTop.goals >= 2) {
      const tops = leader && ourTop.goals === leader.goals;
      add('ourScorer', 'hype', `${ourTop.name} has ${ourTop.goals} league goals${tops ? ' — joint top of the scoring charts' : ''}.`, tops ? 45 : 30);
    }
    if (theirTop && theirTop.goals >= 2) add('theirScorer', 'warn', `Watch ${theirTop.name}: ${theirTop.goals} goals for ${them} this season.`, 32 + theirTop.goals);
  }

  // Our own players: landmarks one game away, and anyone scoring in match after match.
  const starters = Object.values(save.lineup ?? {}).flatMap((id) => (save.footballers?.[id] ? [save.footballers[id]] : []));
  const next = upcomingMilestones(starters)[0];
  if (next) add('milestone', 'hype', next.text, next.weight + 20);
  const hot = scoringRuns(save)[0];
  if (hot && hot.games >= 2 && starters.some((p) => p.id === hot.playerId)) add('hotStreak', 'hype', `${hot.name} has scored in ${hot.games === 2 ? 'both' : `each`} of his last ${hot.games === 2 ? 'two' : hot.games} games.`, 46 + hot.games * 3);

  const meetings = headToHead(save, opp.id);
  const last = meetings[0];
  if (opp.rival) {
    if (last && last.gf < last.ga) add('revenge', 'hype', `Derby day — and they won the last one ${score({ ...last, gf: last.ga, ga: last.gf })}. Time for revenge.`, 88);
    else if (last && last.gf > last.ga) add('derby', 'hype', `Derby day. You won the last one ${score(last)}; they’ll want it back.`, 84);
    else add('derby', 'hype', 'Derby day. The town has had this one circled for weeks.', 82);
  } else if (last) {
    const when = last.season === save.season ? `in round ${last.round + 1}` : `in season ${last.season}`;
    if (last.gf < last.ga) add('revenge', 'hype', `They beat you ${last.ga}–${last.gf} ${when}. Revenge is on the menu.`, 65);
    else if (last.gf > last.ga) add('meeting', 'info', `You won ${score(last)} ${when}.`, 35);
    else add('meeting', 'info', `It finished ${score(last)} ${when}.`, 33);
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

// ── Around the league ──────────────────────────────────────────────────────────────────────

/**
 * One headline for the other fixtures of a round: a shock result, the leaders slipping, or a
 * thrashing. Null when nothing stands out.
 */
export function roundHeadline(league: Pick<LeagueState, 'rounds' | 'results'>, round: number, ownName: string): string | null {
  const others = league.results.filter((r) => r.round === round && r.home !== PLAYER_CLUB_ID && r.away !== PLAYER_CLUB_ID);
  if (others.length === 0) return null;
  const nameOf = (id: string) => clubName(id, ownName);
  const strength = (id: string) => CLUB_BY_ID[id]?.baseOvr ?? 0;
  const winner = (r: LeagueResult) => (r.hg > r.ag ? r.home : r.ag > r.hg ? r.away : null);
  const loser = (r: LeagueResult) => (r.hg > r.ag ? r.away : r.ag > r.hg ? r.home : null);

  const before = leagueTable(throughRound(league, round - 1), nameOf);
  const leader = round > 0 ? before[0]?.clubId : undefined;
  const leaderGame = leader && leader !== PLAYER_CLUB_ID ? others.find((r) => r.home === leader || r.away === leader) : undefined;
  if (leaderGame && winner(leaderGame) !== leader) {
    const gf = leaderGame.home === leader ? leaderGame.hg : leaderGame.ag;
    const ga = leaderGame.home === leader ? leaderGame.ag : leaderGame.hg;
    const opp = leaderGame.home === leader ? leaderGame.away : leaderGame.home;
    return gf < ga ? `Leaders ${nameOf(leader as string)} beaten ${ga}–${gf} by ${nameOf(opp)}.` : `Leaders ${nameOf(leader as string)} held ${gf}–${ga} by ${nameOf(opp)}.`;
  }
  const upsets = others
    .filter((r) => winner(r) && strength(loser(r) as string) - strength(winner(r) as string) >= 4)
    .sort((a, b) => strength(loser(b) as string) - strength(winner(b) as string) - (strength(loser(a) as string) - strength(winner(a) as string)));
  const upset = upsets[0];
  if (upset) {
    const w = winner(upset) as string;
    return `Shock result: ${nameOf(w)} beat ${nameOf(loser(upset) as string)} ${Math.max(upset.hg, upset.ag)}–${Math.min(upset.hg, upset.ag)}.`;
  }
  const rout = [...others].sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag))[0];
  if (rout && Math.abs(rout.hg - rout.ag) >= 3) return `${nameOf(winner(rout) as string)} run riot: ${Math.max(rout.hg, rout.ag)}–${Math.min(rout.hg, rout.ag)} against ${nameOf(loser(rout) as string)}.`;
  const goals = others.reduce((s, r) => s + r.hg + r.ag, 0);
  if (goals === 0) return 'Goalless all round. Defences on top this week.';
  return null;
}

// ── Season story ───────────────────────────────────────────────────────────────────────────

export interface SeasonStory {
  bestWin: (FormEntry & { opponentName: string }) | null;
  longestWinRun: number;
  sealedRound: number | null;
  homeRecord: { won: number; drawn: number; lost: number };
}

/** Highlights of the player's current season (best win, longest run, when it was sealed). */
export function seasonStory(save: Pick<ClubSave, 'league' | 'club'>, fate: Fate | null): SeasonStory {
  const results = clubResults(save.league, PLAYER_CLUB_ID);
  const best = [...results].filter((r) => r.res === 'W').sort((a, b) => b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.round - b.round)[0];
  const home = results.filter((r) => r.home);
  return {
    bestWin: best ? { ...best, opponentName: clubName(best.opponentId, save.club.name) } : null,
    longestWinRun: longestWinRun(results),
    sealedRound: fate ? roundSealed(save.league, fate) : null,
    homeRecord: { won: home.filter((r) => r.res === 'W').length, drawn: home.filter((r) => r.res === 'D').length, lost: home.filter((r) => r.res === 'L').length },
  };
}

// ── Cup ties ───────────────────────────────────────────────────────────────────────────────

/** Build-up for a County Cup tie: what the round is worth, who they are, and the last meeting. */
export function cupStorylines(save: Pick<ClubSave, 'league' | 'matchRecords' | 'club' | 'season'> & Partial<Pick<ClubSave, 'footballers' | 'lineup'>>, fixture: Pick<UserFixture, 'club' | 'cupRound'>, limit = 3): Storyline[] {
  const out: Storyline[] = [];
  const add = (kind: StoryKind, tone: Storyline['tone'], text: string, weight: number) => out.push({ kind, tone, text, weight });
  const k = fixture.cupRound ?? 0;
  const final = k === CUP_ROUNDS.length - 1;
  const them = fixture.club.name;
  if (final) add('cupFinal', 'hype', `${CUP_NAME} final at the County Ground. Win and the cup is yours.`, 100);
  else if (k > 0) add('cupRound', 'hype', `Win and you're in the ${cupRoundName(k + 1).toLowerCase()}.`, 80);
  else add('knockout', 'info', 'Knockout football: level after 90 minutes means penalties.', 70);
  const ours = save.league.division;
  const theirs = divisionIndexOf(fixture.club.id);
  if (theirs > ours) add('giantKilling', 'hype', `Giant-killing chance: ${them} play in ${divisionOf(theirs).name}.`, 88);
  else if (theirs < 0) add('bananaSkin', 'warn', `Banana skin: ${them} are non-league part-timers with nothing to lose.`, 78);
  else if (theirs < ours) add('bananaSkin', 'warn', `Banana skin: ${them} are from the division below and would love to knock you out.`, 76);
  else add('meeting', 'info', `A league rival in the cup: you meet ${them} in ${divisionOf(ours).name} too.`, 45);
  const last = headToHead(save, fixture.club.id)[0];
  if (last && last.gf < last.ga) add('revenge', 'hype', `They beat you ${last.ga}–${last.gf} last time. Revenge is on the menu.`, 65);
  const starters = Object.values(save.lineup ?? {}).flatMap((id) => (save.footballers?.[id] ? [save.footballers[id]] : []));
  const next = upcomingMilestones(starters)[0];
  if (next) add('milestone', 'hype', next.text, next.weight + 20);
  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

/** The right build-up for whichever competition the fixture is in. */
export function fixtureStorylines(save: Parameters<typeof preMatchStorylines>[0], fixture: UserFixture, limit = 3): Storyline[] {
  return fixture.competition === 'cup' ? cupStorylines(save, fixture, limit) : preMatchStorylines(save, fixture, limit);
}
