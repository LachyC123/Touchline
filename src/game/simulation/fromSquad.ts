import { FORMATION_DEFS, type FormationId } from '../../domain/formations';
import { overallAt } from '../../domain/players/rating';
import { moraleEffect } from '../../domain/players/morale';
import type { Footballer } from '../../domain/players/types';
import type { AiStyle, FootballEvent, LineupPlayer, SimAttributes, TeamLineup, TeamSide } from './types';

/** The attributes he takes onto the pitch: his own, nudged by his morale (see players/morale). */
export function simAttributes(p: Footballer): SimAttributes {
  const mood = moraleEffect(p.morale);
  const a = { ...p.attributes };
  for (const [k, v] of Object.entries(mood) as [keyof typeof a, number][]) a[k] = Math.max(1, Math.min(99, a[k] + v));
  return {
    pace: a.pace,
    acceleration: a.acceleration,
    shooting: a.shooting,
    finishing: a.finishing,
    passing: a.passing,
    vision: a.vision,
    dribbling: a.dribbling,
    ballControl: a.ballControl,
    tackling: a.tackling,
    marking: a.marking,
    strength: a.strength,
    stamina: a.stamina,
    composure: a.composure,
    setPieces: a.setPieces,
    reflexes: a.reflexes,
    positioning: a.positioning,
    handling: a.handling,
    distribution: a.distribution,
    reach: a.reach,
  };
}

export interface TeamIdentity {
  clubId: string;
  name: string;
  shortName: string;
  kit: TeamLineup['kit'];
  aiStyle: AiStyle;
  deck?: TeamLineup['deck'];
  penaltyTakerId?: string;
  captainId?: string;
}

/**
 * Builds the engine's lineup from stored footballers and a slot → player map. Out-of-position
 * players keep their own attributes; their role rating carries the published fit penalty.
 */
export function buildTeamLineup(identity: TeamIdentity, formation: FormationId, lineup: Record<string, string>, footballers: Record<string, Footballer>, bench: readonly Footballer[] = []): TeamLineup {
  const players: LineupPlayer[] = FORMATION_DEFS[formation].slots.map((slot) => {
    const id = lineup[slot.id];
    const p = id ? footballers[id] : undefined;
    if (!p) throw new Error(`No player in slot ${slot.id}`);
    return toLineupPlayer(p, slot.id, slot.position);
  });
  const { deck, ...rest } = identity;
  return { ...rest, formation, players, ...(deck ? { deck: [...deck] } : {}), ...(bench.length ? { bench: bench.map((p) => toLineupPlayer(p, 'bench', p.primaryPosition)) } : {}) };
}

export function toLineupPlayer(p: Footballer, slotId: string, role: LineupPlayer['role']): LineupPlayer {
  return {
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    shortName: p.lastName,
    slotId,
    role,
    naturalPosition: p.primaryPosition,
    rating: overallAt(p, role),
    attributes: simAttributes(p),
    traitIds: [...p.traitIds],
    strongFoot: p.strongFoot,
    appearance: p.appearance,
    runningStyleId: p.runningStyleId,
    celebrationId: p.celebrationId,
  };
}

export function teamRating(t: TeamLineup): number {
  return Math.round((t.players.reduce((s, p) => s + p.rating, 0) / t.players.length) * 10) / 10;
}

/** Everyone who could appear for a team in a match: the seven and the bench. */
export function matchSquad(t: TeamLineup): LineupPlayer[] {
  return [...t.players, ...(t.bench ?? [])];
}

/** The seven on the pitch at the final whistle (substitutions applied), e.g. for a shootout. */
export function lineupAtFullTime(t: TeamLineup, side: TeamSide, events: readonly FootballEvent[]): TeamLineup {
  const players = [...t.players];
  for (const e of events) {
    if (e.type !== 'SUB' || e.team !== side) continue;
    const i = players.findIndex((p) => p.id === e.outId);
    const on = t.bench?.find((p) => p.id === e.inId);
    const off = players[i];
    if (off && on) players[i] = { ...on, slotId: off.slotId, role: off.role };
  }
  return { ...t, players };
}
