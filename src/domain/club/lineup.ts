import { FORMATION_DEFS, type FormationId } from '../formations';
import { overallAt } from '../players/rating';
import type { Footballer } from '../players/types';

export type Lineup = Record<string, string>;

export class LineupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LineupError';
  }
}

/**
 * Picks the best available player per slot. Natural-position players are placed first;
 * `prefer` (e.g. the current starters) gets a bonus so formation changes keep your choices.
 */
export function autoLineup(players: readonly Footballer[], formation: FormationId = '2-2-2', prefer: ReadonlySet<string> = new Set()): Lineup {
  const used = new Set<string>();
  const lineup: Lineup = {};
  const slots = FORMATION_DEFS[formation].slots;
  const pick = (natural: boolean) => {
    for (const slot of slots) {
      if (lineup[slot.id]) continue;
      const best = players
        .filter((p) => !used.has(p.id) && (!natural || p.primaryPosition === slot.position))
        .filter((p) => (slot.position === 'GK') === (p.primaryPosition === 'GK'))
        .map((p) => ({ p, score: overallAt(p, slot.position) + (prefer.has(p.id) ? 15 : 0) }))
        .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))[0];
      if (best) {
        used.add(best.p.id);
        lineup[slot.id] = best.p.id;
      }
    }
  };
  pick(true);
  pick(false);
  return lineup;
}

/** Problems with a lineup, in plain language (empty = valid). */
export function lineupProblems(lineup: Lineup, formation: FormationId, footballers: Record<string, Footballer>, squadIds: readonly string[], away: ReadonlyMap<string, string> = new Map()): string[] {
  const problems: string[] = [];
  const slots = FORMATION_DEFS[formation].slots;
  const ids = Object.values(lineup);
  if (Object.keys(lineup).length !== slots.length || slots.some((s) => !lineup[s.id])) problems.push('Every position needs a player.');
  if (Object.keys(lineup).some((k) => !slots.some((s) => s.id === k))) problems.push('A player is in a position this formation does not use.');
  if (new Set(ids).size !== ids.length) problems.push('A player cannot start in two positions.');
  for (const id of ids) {
    if (!squadIds.includes(id) || !footballers[id]) problems.push('A starter is no longer at the club.');
  }
  for (const id of ids) {
    const why = away.get(id);
    if (why) problems.push(`${footballers[id]?.lastName ?? 'A starter'} is away (${why.toLowerCase()}). Pick someone else.`);
  }
  const gk = lineup.GK ? footballers[lineup.GK] : undefined;
  if (!gk || gk.primaryPosition !== 'GK') problems.push('A goalkeeper must start in goal.');
  for (const s of slots) {
    const p = footballers[lineup[s.id] ?? ''];
    if (p && s.position !== 'GK' && p.primaryPosition === 'GK') problems.push('Goalkeepers can only play in goal.');
  }
  return [...new Set(problems)];
}

/**
 * Put `playerId` into `slotId`. If he already starts elsewhere the two swap; if he is on the
 * bench, the current occupant drops to the bench.
 */
export function assignToSlot(lineup: Lineup, formation: FormationId, slotId: string, playerId: string, footballers: Record<string, Footballer>): Lineup {
  const slot = FORMATION_DEFS[formation].slots.find((s) => s.id === slotId);
  if (!slot) throw new LineupError('That position is not in this formation.');
  const player = footballers[playerId];
  if (!player) throw new LineupError('Unknown player.');
  const isGk = player.primaryPosition === 'GK';
  if ((slot.position === 'GK') !== isGk) throw new LineupError(isGk ? 'Goalkeepers can only play in goal.' : 'Only a goalkeeper can play in goal.');
  const next = { ...lineup };
  const fromSlot = Object.keys(next).find((k) => next[k] === playerId);
  const occupant = next[slotId];
  if (fromSlot === slotId) return next;
  if (fromSlot && occupant) {
    const fromPos = FORMATION_DEFS[formation].slots.find((s) => s.id === fromSlot)?.position;
    const occ = footballers[occupant];
    if (occ && (fromPos === 'GK') !== (occ.primaryPosition === 'GK')) throw new LineupError('Goalkeepers can only swap with goalkeepers.');
    next[fromSlot] = occupant;
  } else if (fromSlot) {
    delete next[fromSlot];
  }
  next[slotId] = playerId;
  return next;
}

export function changeFormation(lineup: Lineup, to: FormationId, footballers: Record<string, Footballer>, squadIds: readonly string[]): Lineup {
  const players = squadIds.map((id) => footballers[id]).filter((p): p is Footballer => Boolean(p));
  return autoLineup(players, to, new Set(Object.values(lineup)));
}

/** Out-of-position flags for the lineup screen: slot id -> rating penalty. */
export function fitWarnings(lineup: Lineup, formation: FormationId, footballers: Record<string, Footballer>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of FORMATION_DEFS[formation].slots) {
    const p = footballers[lineup[s.id] ?? ''];
    if (!p) continue;
    const penalty = overallAt(p, p.primaryPosition) - overallAt(p, s.position);
    if (penalty > 0) out[s.id] = penalty;
  }
  return out;
}
