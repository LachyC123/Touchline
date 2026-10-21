import type { ClubDef } from '../../data/clubs';
import { clubOf, cupGuestsOf, divisionIndexOf, divisionsOf, type World } from '../world/world';
import { lineupAtFullTime, matchSquad } from '../../game/simulation/fromSquad';
import { replayMatch } from '../../game/simulation/replay';
import type { MatchResult, TeamLineup } from '../../game/simulation/types';
import { opponentLineup } from '../club/opponents';
import { strengthLap } from '../league/league';
import { stream } from '../rng';
import { PLAYER_CLUB_ID, type ClubSave, type CupState, type CupTie, type LeagueScorer } from '../save/types';
import { penaltyShootout, type ShootoutResult } from './shootout';

/**
 * The County Cup: every club in both divisions (16), single-leg knockout ties, drawn round by
 * round from the career seed. Rounds are played between league rounds; a drawn tie goes to
 * penalties. When the player's club is out, the remaining rounds are simulated by the same
 * engine as the league fixtures.
 */

export const CUP_NAME = 'County Cup';
export const CUP_ROUNDS = ['First round', 'Quarter-final', 'Semi-final', 'Final'] as const;
/** Cup round k is played once this many league rounds are complete. */
export const CUP_AFTER_LEAGUE_ROUNDS: readonly number[] = [3, 6, 9, 12];
export const CUP_PRIZES = { progress: [60, 90, 140], winner: 400, winnerClubXp: 120 } as const;

export function cupRoundName(round: number): string {
  return CUP_ROUNDS[round] ?? 'Final';
}

export function cupEntrants(world: World): string[] {
  return [PLAYER_CLUB_ID, ...divisionsOf(world).flatMap((d) => d.clubs.map((c) => c.id)), ...cupGuestsOf(world).map((c) => c.id)];
}

/** Pairs entrants in a seeded order; the first drawn of each pair is at home. */
export function drawRound(careerSeed: string, season: number, round: number, entrants: readonly string[]): CupTie[] {
  const ids = [...entrants];
  const rng = stream(`${careerSeed}:cup:s${season}:r${round}`, 'cup');
  for (let i = ids.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [ids[i], ids[j]] = [ids[j] as string, ids[i] as string];
  }
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < ids.length; i += 2) ties.push({ home: ids[i] as string, away: ids[i + 1] as string });
  return ties;
}

export function newCup(careerSeed: string, world: World, season: number): CupState {
  return { season, rounds: [drawRound(careerSeed, season, 0, cupEntrants(world))], round: 0 };
}

export function cupFinished(cup: CupState | null): boolean {
  return !cup || cup.round >= CUP_ROUNDS.length;
}

export function cupWinner(cup: CupState | null): string | null {
  if (!cup || !cupFinished(cup)) return null;
  return cup.rounds[CUP_ROUNDS.length - 1]?.[0]?.winner ?? null;
}

/** The round the player's club went out in (or null while still in / if it won). */
export function eliminatedIn(cup: CupState | null): number | null {
  if (!cup) return null;
  for (let r = 0; r < cup.rounds.length; r++) {
    const tie = cup.rounds[r]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID);
    if (!tie) return r > 0 ? r - 1 : null;
    if (tie.winner && tie.winner !== PLAYER_CLUB_ID) return r;
  }
  return null;
}

/** Whether the current cup round should be played before the next league match. */
export function cupRoundDue(save: Pick<ClubSave, 'league' | 'cup'>): boolean {
  const cup = save.cup;
  if (!cup || cupFinished(cup)) return false;
  const after = CUP_AFTER_LEAGUE_ROUNDS[cup.round];
  return after !== undefined && save.league.round >= after;
}

export interface UserCupTie {
  club: ClubDef;
  home: boolean;
  cupRound: number;
  lap: number;
}

/** The player's tie in the current cup round, if it is due and the club is still in. */
export function userCupTie(save: Pick<ClubSave, 'league' | 'cup' | 'season' | 'world'>): UserCupTie | null {
  if (!cupRoundDue(save) || !save.cup) return null;
  const tie = save.cup.rounds[save.cup.round]?.find((t) => t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID);
  if (!tie || tie.winner) return null;
  const home = tie.home === PLAYER_CLUB_ID;
  const club = clubOf(save.world, home ? tie.away : tie.home);
  if (!club) throw new Error('Unknown club in the cup draw');
  return { club, home, cupRound: save.cup.round, lap: strengthLap(save.season) };
}

function scorers(result: MatchResult, home: TeamLineup, away: TeamLineup, homeId: string, awayId: string): LeagueScorer[] {
  const names = new Map([...matchSquad(home), ...matchSquad(away)].map((p) => [p.id, p.name] as const));
  return result.events.flatMap((e) => (e.type === 'GOAL' ? [{ playerId: e.scorerId, name: names.get(e.scorerId) ?? 'Unknown', clubId: e.team === 'home' ? homeId : awayId }] : []));
}

/** Fills in a tie from a played match (penalties if level). */
export function settleTie(tie: CupTie, result: MatchResult, home: TeamLineup, away: TeamLineup, shootout: ShootoutResult | null): CupTie {
  const hg = result.score.home;
  const ag = result.score.away;
  const winner = hg > ag ? tie.home : ag > hg ? tie.away : shootout?.winner === 'home' ? tie.home : tie.away;
  return { ...tie, hg, ag, winner, scorers: scorers(result, home, away, tie.home, tie.away), ...(hg === ag && shootout ? { pens: { home: shootout.home, away: shootout.away } } : {}) };
}

/** An AI-vs-AI tie, simulated by the engine with both benches AI-managed. */
export function simulateTie(careerSeed: string, world: World, season: number, round: number, tie: CupTie): CupTie {
  const hc = clubOf(world, tie.home);
  const ac = clubOf(world, tie.away);
  if (!hc || !ac) throw new Error('Unknown club in the cup draw');
  const lap = strengthLap(season);
  const home = opponentLineup(careerSeed, { number: 100 + round, club: hc, lap, home: true }).lineup;
  const away = opponentLineup(careerSeed, { number: 100 + round, club: ac, lap, home: false }).lineup;
  const seed = `${careerSeed}:s${season}:cup${round}:${tie.home}-v-${tie.away}`;
  const result = replayMatch({ matchId: seed, seed, home, away, userSide: null }, []);
  const shootout = result.score.home === result.score.away ? penaltyShootout(seed, lineupAtFullTime(home, 'home', result.events), lineupAtFullTime(away, 'away', result.events)) : null;
  return settleTie(tie, result, home, away, shootout);
}

/**
 * Completes the current round on a save draft: the player's tie (already settled, if any) plus
 * every other tie, then draws the next round from the winners.
 */
export function completeCupRound(draft: Pick<ClubSave, 'careerSeed' | 'season' | 'cup' | 'world'>, userTie?: CupTie): void {
  const cup = draft.cup;
  if (!cup || cupFinished(cup)) return;
  const k = cup.round;
  const ties = cup.rounds[k] ?? [];
  cup.rounds[k] = ties.map((t) => {
    if (userTie && t.home === userTie.home && t.away === userTie.away) return userTie;
    return t.winner ? t : simulateTie(draft.careerSeed, draft.world, draft.season, k, t);
  });
  cup.round = k + 1;
  if (cup.round < CUP_ROUNDS.length) {
    cup.rounds.push(drawRound(draft.careerSeed, draft.season, cup.round, cup.rounds[k].map((t) => t.winner as string)));
  }
}

/** Plays every due cup round the player is not in (called after league progress). */
export function catchUpCup(draft: Pick<ClubSave, 'careerSeed' | 'season' | 'cup' | 'league' | 'world'>): void {
  while (cupRoundDue(draft) && !userCupTie(draft)) completeCupRound(draft);
}


/** A cup-night headline from the tie itself, or null to keep the match headline. */
export function cupHeadline(world: World, tie: CupTie, round: number, ownName: string, oppName: string, shootout: ShootoutResult | null, side: 'home' | 'away', ourDivision: number): string | null {
  const won = tie.winner === PLAYER_CLUB_ID;
  const us = ownName.toUpperCase();
  const them = oppName.toUpperCase();
  const final = round === CUP_ROUNDS.length - 1;
  if (won && final) return `${us} LIFT THE ${CUP_NAME.toUpperCase()}!`;
  if (shootout) {
    const ours = shootout[side];
    const theirs = shootout[side === 'home' ? 'away' : 'home'];
    return won ? `NERVES OF STEEL: ${us} WIN ${ours}–${theirs} ON PENALTIES.` : `HEARTBREAK FROM THE SPOT: OUT ${ours}–${theirs} ON PENALTIES TO ${them}.`;
  }
  const oppId = tie.home === PLAYER_CLUB_ID ? tie.away : tie.home;
  if (won && divisionIndexOf(world, oppId) > ourDivision) return `GIANT-KILLERS: ${us} KNOCK OUT ${them}.`;
  if (won) return `THROUGH: ${us} INTO THE ${cupRoundName(round + 1).toUpperCase()}.`;
  if (final) return `SO CLOSE: ${them} WIN THE ${CUP_NAME.toUpperCase()} FINAL.`;
  return null;
}
