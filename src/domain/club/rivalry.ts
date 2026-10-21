import type { FootballEvent, TeamSide } from '../../game/simulation/types';
import type { ClubSave, Foe, MatchRecord } from '../save/types';
import { clubOf } from '../world/world';
import type { Footballer } from '../players/types';
import { opponentSquad } from './opponents';
import { strengthLap } from '../league/league';

/**
 * Rivalries from what actually happened: every opposition goal against the club is tallied by
 * scorer; whoever has scored most (at least twice) is the nemesis. Players the club sold come
 * back in their new club's colours. Pure functions on stored facts.
 */

export const NEMESIS_AT = 2;
const MAX_FOES = 40;

export function nemesisOf(save: Pick<ClubSave, 'foes' | 'squadIds'>): Foe | null {
  const live = save.foes.filter((f) => f.goals >= NEMESIS_AT && !save.squadIds.includes(f.playerId));
  return live.sort((a, b) => b.goals - a.goals || b.lastMatch - a.lastMatch || a.playerId.localeCompare(b.playerId))[0] ?? null;
}

/** Players this club sold who now play for `clubId`. */
export function exPlayersAt(save: Pick<ClubSave, 'world'>, clubId: string) {
  return save.world.arrivals.filter((a) => a.clubId === clubId);
}

export interface RivalryInput {
  events: readonly FootballEvent[];
  side: TeamSide;
  opponentId: string;
  number: number;
  /** Everyone of theirs who was on the pitch. */
  theirPlayers: ReadonlySet<string>;
  nameOf: (id: string) => string;
}

/** Updates the tally on a draft and says what this match meant for the club's rivalries. */
export function rivalryAfterMatch(draft: ClubSave, input: RivalryInput): NonNullable<MatchRecord['rivalry']> {
  const before = nemesisOf(draft);
  const theirGoals = input.events.filter((e): e is Extract<FootballEvent, { type: 'GOAL' }> => e.type === 'GOAL' && e.team !== input.side);
  const exIds = new Set(exPlayersAt(draft, input.opponentId).map((a) => a.player.id));
  const club = clubOf(draft.world, input.opponentId);
  for (const g of theirGoals) {
    let foe = draft.foes.find((f) => f.playerId === g.scorerId);
    if (!foe) {
      foe = { playerId: g.scorerId, name: input.nameOf(g.scorerId), clubId: input.opponentId, goals: 0, lastMatch: input.number, ...(exIds.has(g.scorerId) ? { former: true } : {}) };
      draft.foes.push(foe);
    }
    foe.goals++;
    foe.lastMatch = input.number;
    foe.clubId = input.opponentId;
  }
  draft.foes = draft.foes.sort((a, b) => b.goals - a.goals || b.lastMatch - a.lastMatch).slice(0, MAX_FOES);
  const after = nemesisOf(draft);
  const out: NonNullable<MatchRecord['rivalry']> = [];
  const scored = (id: string) => theirGoals.filter((g) => g.scorerId === id).length;
  if (after && (!before || before.playerId !== after.playerId)) {
    out.push({ kind: 'newNemesis', playerId: after.playerId, name: after.name, text: `${after.name} has now scored ${after.goals} against you. You have a nemesis.` });
  } else if (before && input.theirPlayers.has(before.playerId)) {
    const n = scored(before.playerId);
    out.push(
      n > 0
        ? { kind: 'nemesisAgain', playerId: before.playerId, name: before.name, text: `${before.name} does it again: ${after?.goals ?? before.goals + n} against you now.` }
        : { kind: 'nemesisQuiet', playerId: before.playerId, name: before.name, text: `You kept your nemesis ${before.name} quiet.` },
    );
  }
  for (const id of exIds) {
    if (!input.theirPlayers.has(id)) continue;
    const name = input.nameOf(id);
    const n = scored(id);
    out.push(
      n > 0
        ? { kind: 'exHaunts', playerId: id, name, text: `Old boy ${name} comes back to haunt you${n > 1 ? ` with ${n} goals` : ''} for ${club?.shortName ?? 'them'}.` }
        : { kind: 'exQuiet', playerId: id, name, text: `${name} faced his old club and didn’t score.` },
    );
  }
  return out.slice(0, 6);
}

/** A foe's card, when we can draw him: a former player, or someone in his club's current squad. */
export function foeFootballer(save: Pick<ClubSave, 'world' | 'footballers' | 'careerSeed' | 'season'>, foe: Pick<Foe, 'playerId' | 'clubId'>): Footballer | null {
  const ours = save.footballers[foe.playerId];
  if (ours) return ours;
  const club = clubOf(save.world, foe.clubId);
  if (!club) return null;
  return opponentSquad(save.careerSeed, club, strengthLap(save.season), save.world).find((p) => p.id === foe.playerId) ?? null;
}
