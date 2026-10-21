import type { FootballEvent as MatchEvent, TeamSide } from '../../game/simulation/types';
import { clamp, seededUuid, stream } from '../rng';
import type { ClubSave, Injury, InjuryTreatment } from '../save/types';
import { awayFor } from '../club/dressingRoom';
import { clampMorale } from './morale';
import type { Footballer } from './types';

/**
 * Injuries come from what happened on the pitch: every foul suffered and every hard tackle
 * taken is a knock, and each knock has a small chance (seeded per match and player, separate
 * from the match and reward streams) of keeping him out. Strong, young, professional players
 * shake knocks off more often; a player rushed back is fragile for a few games.
 */

export const INJURY_KINDS = [
  { id: 'deadLeg', label: 'Dead leg', matches: 1, weight: 30 },
  { id: 'kneeKnock', label: 'Knee knock', matches: 1, weight: 22 },
  { id: 'ankle', label: 'Twisted ankle', matches: 2, weight: 18 },
  { id: 'hamstring', label: 'Tight hamstring', matches: 2, weight: 12 },
  { id: 'ribs', label: 'Bruised ribs', matches: 2, weight: 8 },
  { id: 'groin', label: 'Groin strain', matches: 3, weight: 6 },
  { id: 'tear', label: 'Torn hamstring', matches: 5, weight: 4 },
] as const;
export type InjuryKind = (typeof INJURY_KINDS)[number]['id'];
export const INJURY_KIND_IDS = INJURY_KINDS.map((k) => k.id) as unknown as readonly [InjuryKind, ...InjuryKind[]];

export const INJURY = {
  /** Chance per knock for an average player. */
  perKnock: 0.12,
  foul: 1,
  bookedFoulExtra: 0.6,
  slideTaken: 0.6,
  standingTaken: 0.15,
  maxPerMatch: 2,
  /** Rushed back: knocks are this much likelier to injure him, for this many matches. */
  fragileFactor: 3,
  fragileMatches: 3,
  specialistPerMatch: 40,
  moraleHit: 4,
} as const;

export function injuryKind(id: string): (typeof INJURY_KINDS)[number] {
  return INJURY_KINDS.find((k) => k.id === id) ?? INJURY_KINDS[0];
}

export interface Knock {
  minute: number;
  weight: number;
  byId: string;
}

/** Every knock a player took in a match, from the recorded events. */
export function knocksFor(events: readonly MatchEvent[], playerId: string): Knock[] {
  const out: Knock[] = [];
  for (const e of events) {
    if (e.type === 'FOUL' && e.victimId === playerId) out.push({ minute: e.minute, weight: INJURY.foul + (e.booked ? INJURY.bookedFoulExtra : 0), byId: e.foulerId });
    else if (e.type === 'TACKLE' && e.won && e.carrierId === playerId) out.push({ minute: e.minute, weight: e.style === 'slide' ? INJURY.slideTaken : INJURY.standingTaken, byId: e.challengerId });
  }
  return out;
}

/** How easily he gets hurt (1 = average). */
export function proneness(p: Pick<Footballer, 'attributes' | 'age' | 'personality'>, fragile: boolean): number {
  const body = 1.25 - (p.attributes.strength - 50) / 100;
  const age = p.age >= 31 ? 0.25 : p.age <= 20 ? -0.05 : 0;
  const pro = p.personality.professionalism >= 70 ? -0.1 : 0;
  return clamp(body + age + pro, 0.5, 1.8) * (fragile ? INJURY.fragileFactor : 1);
}

export function isFragile(save: Pick<ClubSave, 'injuries' | 'matchNumber'>, playerId: string): boolean {
  return save.injuries.some((i) => i.playerId === playerId && (i.fragileUntil ?? -1) >= save.matchNumber + 1);
}

/** Who is out injured for the next match (and why). */
export function injuredFor(save: Pick<ClubSave, 'injuries' | 'matchNumber'>): Map<string, Injury> {
  const next = save.matchNumber + 1;
  return new Map(save.injuries.filter((i) => i.untilMatch >= next).map((i) => [i.playerId, i]));
}

/** Matches still to miss, counting the next one. */
export function matchesOut(save: Pick<ClubSave, 'matchNumber'>, i: Pick<Injury, 'untilMatch'>): number {
  return Math.max(0, i.untilMatch - save.matchNumber);
}

/**
 * Everyone who cannot be picked for the next match, as a phrase for the lineup screen: injured
 * players and players the dressing room has excused. A club is never left without a keeper or
 * without seven players: the shortest absences play through it instead.
 */
export function unavailableFor(save: Pick<ClubSave, 'injuries' | 'matchNumber' | 'dressingRoom' | 'squadIds' | 'footballers'>): Map<string, string> {
  const out = new Map<string, string>();
  const left = new Map<string, number>();
  for (const [id, why] of awayFor(save)) {
    out.set(id, `is away (${why.toLowerCase()})`);
    left.set(id, (save.dressingRoom.away.find((a) => a.playerId === id)?.untilMatch ?? save.matchNumber + 1) - save.matchNumber);
  }
  for (const [id, inj] of injuredFor(save)) {
    const n = matchesOut(save, inj);
    out.set(id, `is injured (${injuryKind(inj.kind).label.toLowerCase()}, out ${n === 1 ? 'one more match' : `${n} more matches`})`);
    left.set(id, Math.max(n, left.get(id) ?? 0));
  }
  const squad = save.squadIds.filter((id) => save.footballers[id]);
  const fit = () => squad.filter((id) => !out.has(id));
  const release = (pool: string[]) => {
    const id = pool.sort((a, b) => (left.get(a) ?? 0) - (left.get(b) ?? 0) || a.localeCompare(b))[0];
    if (id) out.delete(id);
    return Boolean(id);
  };
  const isGk = (id: string) => save.footballers[id]?.primaryPosition === 'GK';
  if (!fit().some(isGk)) release(squad.filter((id) => out.has(id) && isGk(id)));
  while (fit().length < 7 && release(squad.filter((id) => out.has(id) && !isGk(id)))) {
    /* release the shortest absences until seven can play */
  }
  return out;
}

export interface InjuryInput {
  matchId: string;
  number: number;
  side: TeamSide;
  events: readonly MatchEvent[];
  /** Everyone of ours who was on the pitch. */
  played: ReadonlySet<string>;
  nameOf: (id: string) => string;
}

/**
 * Rolls this match's injuries on a draft (after matchNumber is updated): stores them, drops
 * morale a little and writes them into the player's story. Returns the new injuries.
 */
export function injuriesAfterMatch(draft: ClubSave, input: InjuryInput): Injury[] {
  const found: Injury[] = [];
  for (const id of [...input.played].sort()) {
    if (found.length >= INJURY.maxPerMatch) break;
    const p = draft.footballers[id];
    if (!p) continue;
    const knocks = knocksFor(input.events, id);
    if (!knocks.length) continue;
    // Fragility is judged as it was going into this match.
    const fragile = draft.injuries.some((i) => i.playerId === id && (i.fragileUntil ?? -1) >= input.number);
    const rng = stream(`${input.matchId}:${id}`, 'injury');
    const chance = INJURY.perKnock * proneness(p, fragile);
    const hit = knocks.find((k) => rng.chance(Math.min(0.9, chance * k.weight)));
    if (!hit) continue;
    const kind = rng.weighted(INJURY_KINDS.map((k) => [k, k.weight] as const));
    const injury: Injury = {
      id: seededUuid(`${input.matchId}:injury:${id}`),
      playerId: id,
      kind: kind.id,
      matchId: input.matchId,
      atMatch: input.number,
      minute: hit.minute,
      byName: input.nameOf(hit.byId),
      outFor: kind.matches,
      untilMatch: input.number + kind.matches,
      treatment: null,
    };
    found.push(injury);
    p.morale = clampMorale(p.morale - INJURY.moraleHit);
    p.history.push({
      id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`),
      kind: 'injury',
      season: draft.season,
      order: draft.nextSeq++,
      headline: `${kind.label} after a challenge from ${injury.byName} (${hit.minute}'). Out for ${kind.matches === 1 ? 'a match' : `${kind.matches} matches`}.`,
    });
  }
  draft.injuries = [...found, ...draft.injuries].slice(0, 40);
  return found;
}

export interface TreatmentOption {
  id: InjuryTreatment;
  label: string;
  hint: string;
  cost: number;
  outFor: number;
  disabled?: string;
}

/** The physio's options for a fresh injury (only before the next match). */
export function treatmentOptions(save: Pick<ClubSave, 'coins' | 'matchNumber'>, i: Injury): TreatmentOption[] {
  const cost = INJURY.specialistPerMatch * i.outFor;
  const fresh = i.treatment === null && save.matchNumber === i.atMatch;
  const closed = fresh ? undefined : 'Treatment has been decided.';
  return [
    { id: 'rest', label: 'Full rest', hint: `Out for ${plural(i.outFor)}. No risk.`, cost: 0, outFor: i.outFor, ...(closed ? { disabled: closed } : {}) },
    {
      id: 'specialist',
      label: 'See a specialist',
      hint: `Back one match sooner (${plural(i.outFor - 1)}). No risk.`,
      cost,
      outFor: i.outFor - 1,
      ...(closed ? { disabled: closed } : save.coins < cost ? { disabled: `Needs ${cost} coins.` } : {}),
    },
    {
      id: 'rush',
      label: 'Strap it up and play',
      hint: `Available next match, but fragile for ${INJURY.fragileMatches} matches (knocks ×${INJURY.fragileFactor} as likely to injure him).`,
      cost: 0,
      outFor: 0,
      ...(closed ? { disabled: closed } : {}),
    },
  ];
}

function plural(n: number): string {
  return n <= 0 ? 'no matches' : n === 1 ? 'one match' : `${n} matches`;
}

/** Applies the physio's call on a draft. Throws if it can't be applied. */
export function treatInjury(draft: ClubSave, injuryId: string, treatment: InjuryTreatment): string {
  const i = draft.injuries.find((x) => x.id === injuryId);
  if (!i) throw new Error('That injury is not on the physio’s list.');
  const opt = treatmentOptions(draft, i).find((o) => o.id === treatment);
  if (!opt) throw new Error('Unknown treatment.');
  if (opt.disabled) throw new Error(opt.disabled);
  const p = draft.footballers[i.playerId];
  draft.coins -= opt.cost;
  i.treatment = treatment;
  i.untilMatch = i.atMatch + opt.outFor;
  if (treatment === 'rush') i.fragileUntil = i.atMatch + INJURY.fragileMatches;
  const name = p ? p.lastName : 'He';
  if (treatment === 'rest') return `${name} rests up: back in ${plural(opt.outFor)}.`;
  if (treatment === 'specialist') return `${name} sees the specialist (${opt.cost} coins): back in ${plural(opt.outFor)}.`;
  return `${name} is strapped up and available, but one more knock could be serious.`;
}
