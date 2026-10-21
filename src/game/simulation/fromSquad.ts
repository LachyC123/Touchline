import { FORMATION_DEFS, type FormationId } from '../../domain/formations';
import { overallAt } from '../../domain/players/rating';
import type { Footballer } from '../../domain/players/types';
import type { AiStyle, LineupPlayer, SimAttributes, TeamLineup } from './types';

export function simAttributes(p: Footballer): SimAttributes {
  const a = p.attributes;
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
}

/**
 * Builds the engine's lineup from stored footballers and a slot → player map. Out-of-position
 * players keep their own attributes; their role rating carries the published fit penalty.
 */
export function buildTeamLineup(identity: TeamIdentity, formation: FormationId, lineup: Record<string, string>, footballers: Record<string, Footballer>): TeamLineup {
  const players: LineupPlayer[] = FORMATION_DEFS[formation].slots.map((slot) => {
    const id = lineup[slot.id];
    const p = id ? footballers[id] : undefined;
    if (!p) throw new Error(`No player in slot ${slot.id}`);
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      shortName: p.lastName,
      slotId: slot.id,
      role: slot.position,
      naturalPosition: p.primaryPosition,
      rating: overallAt(p, slot.position),
      attributes: simAttributes(p),
      traitIds: [...p.traitIds],
      strongFoot: p.strongFoot,
      appearance: p.appearance,
      runningStyleId: p.runningStyleId,
      celebrationId: p.celebrationId,
    };
  });
  const { deck, ...rest } = identity;
  return { ...rest, formation, players, ...(deck ? { deck: [...deck] } : {}) };
}

export function teamRating(t: TeamLineup): number {
  return Math.round((t.players.reduce((s, p) => s + p.rating, 0) / t.players.length) * 10) / 10;
}
