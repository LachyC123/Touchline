import { TIER_DEFS, TIER_ORDER } from '../../data/tiers';
import { FORMATION_DEFS } from '../formations';
import { generateFootballer } from '../players/generator';
import { overallAt } from '../players/rating';
import type { Footballer, Position, Tier } from '../players/types';
import { seededUuid, stream } from '../rng';
import type { ClubSave, OwnedPack, PackKind } from '../save/types';

export interface PackDef {
  kind: PackKind;
  name: string;
  /** Shown on the sealed pack and in the Scout room. */
  blurb: string;
}

export const PACK_DEFS: Readonly<Record<PackKind, PackDef>> = {
  'first-signing': { kind: 'first-signing', name: 'First Signing', blurb: 'The scout’s pick for your weakest position. A real upgrade, not a lottery ticket.' },
  'local-scout': { kind: 'local-scout', name: 'Local Scout', blurb: 'One recruit from the local leagues. Rarity follows the published odds.' },
};

/** A Local Scout pack is earned every this-many completed matches. */
export const SCOUT_PACK_EVERY = 3;
/** Every 10th scout recruit is guaranteed Breakout or better (counter is persisted). */
export const PITY_AT = 10;
export const MAX_SQUAD = 30;

const STRONG: ReadonlySet<Tier> = new Set(['breakout', 'star', 'phenomenon']);

export function matchesUntilScoutPack(matchNumber: number): number {
  return SCOUT_PACK_EVERY - (matchNumber % SCOUT_PACK_EVERY);
}

/**
 * The starter the first signing should replace: the lowest-rated outfield starter (the anchor
 * is never the target). Returns the slot's position and that starter's rating there.
 */
export function weakestStarter(save: Pick<ClubSave, 'lineup' | 'formationId' | 'footballers' | 'anchorPlayerId'>): { slotId: string; position: Position; rating: number } | null {
  let best: { slotId: string; position: Position; rating: number } | null = null;
  for (const slot of FORMATION_DEFS[save.formationId].slots) {
    if (slot.position === 'GK') continue;
    const p = save.footballers[save.lineup[slot.id] ?? ''];
    if (!p || p.id === save.anchorPlayerId) continue;
    const rating = overallAt(p, slot.position);
    if (!best || rating < best.rating) best = { slotId: slot.id, position: slot.position, rating };
  }
  return best;
}

function uniqueRecruit(save: Pick<ClubSave, 'footballers'>, seed: string, make: (seed: string) => Footballer): Footballer {
  const used = new Set(Object.values(save.footballers).map((f) => f.lastName));
  let s = seed;
  let p = make(s);
  for (let attempt = 1; used.has(p.lastName) && attempt < 20; attempt++) {
    s = `${seed}:r${attempt}`;
    p = make(s);
  }
  return p;
}

/**
 * Grants a pack on a save draft and commits its recruit immediately (seeded from the career
 * seed + a monotonic counter), so a reload, double tap or force-close can never change it.
 */
export function grantPack(draft: ClubSave, kind: PackKind, source: string): OwnedPack {
  const order = draft.nextSeq++;
  const seed = `${draft.careerSeed}:pack:${order}`;
  let recruit: Footballer;
  if (kind === 'first-signing') {
    // A guaranteed positional improvement, without promising a premium rarity.
    const target = weakestStarter(draft);
    const position = target?.position ?? 'MID';
    const ovr = Math.min(62, (target?.rating ?? 52) + 5);
    recruit = uniqueRecruit(draft, seed, (s) => generateFootballer({ seed: s, tier: 'prospect', position, targetOvr: ovr, ageRange: [19, 25], season: draft.season }));
    // The target is an Overall at that position; make sure the generator's rounding still beats it.
    if (target && overallAt(recruit, position) <= target.rating) {
      recruit = uniqueRecruit(draft, `${seed}:lift`, (s) => generateFootballer({ seed: s, tier: 'prospect', position, targetOvr: ovr + 2, ageRange: [19, 25], season: draft.season }));
    }
  } else {
    const rng = stream(seed, 'reward');
    let tier: Tier = rng.weighted(TIER_ORDER.map((t) => [t, TIER_DEFS[t].odds] as const));
    if (!STRONG.has(tier) && draft.guaranteedRecruitProgress >= PITY_AT - 1) tier = 'breakout';
    draft.guaranteedRecruitProgress = STRONG.has(tier) ? 0 : draft.guaranteedRecruitProgress + 1;
    recruit = uniqueRecruit(draft, seed, (s) => generateFootballer({ seed: s, tier, season: draft.season }));
  }
  recruit.isNew = true;
  const pack: OwnedPack = { id: seededUuid(`${seed}:id`), kind, source, tier: recruit.tier, grantedOrder: order, recruit, playerId: null };
  draft.packs.push(pack);
  return pack;
}

export function unopenedPacks(save: Pick<ClubSave, 'packs'>): OwnedPack[] {
  return save.packs.filter((p) => p.playerId === null);
}

/** Moves the pack's committed recruit into the squad. Throws on an unknown pack or a full squad. */
export function openPackDraft(draft: ClubSave, packId: string): Footballer {
  const pack = draft.packs.find((p) => p.id === packId);
  if (!pack) throw new Error('That pack no longer exists.');
  if (pack.playerId) {
    const already = draft.footballers[pack.playerId];
    if (!already) throw new Error('That pack was already opened.');
    return already;
  }
  if (!pack.recruit) throw new Error('That pack is empty.');
  if (draft.squadIds.length >= MAX_SQUAD) throw new Error(`Your squad is full (${MAX_SQUAD} players).`);
  const p = pack.recruit;
  p.history.push({
    id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`),
    kind: 'signed',
    season: draft.season,
    order: draft.nextSeq,
    headline: pack.kind === 'first-signing' ? `Signed as the club’s first new recruit.` : `Joined from a ${PACK_DEFS[pack.kind].name} pack.`,
  });
  draft.nextSeq++;
  draft.footballers[p.id] = p;
  draft.squadIds.push(p.id);
  pack.playerId = p.id;
  pack.recruit = null;
  return p;
}

/** The slot where a new player would most improve the starting seven (null = no upgrade). */
export function bestSlotFor(save: Pick<ClubSave, 'lineup' | 'formationId' | 'footballers' | 'anchorPlayerId'>, player: Footballer): { slotId: string; gain: number } | null {
  let best: { slotId: string; gain: number } | null = null;
  for (const slot of FORMATION_DEFS[save.formationId].slots) {
    if ((slot.position === 'GK') !== (player.primaryPosition === 'GK')) continue;
    const current = save.footballers[save.lineup[slot.id] ?? ''];
    if (current?.id === player.id) return null;
    if (current?.id === save.anchorPlayerId) continue;
    const gain = overallAt(player, slot.position) - (current ? overallAt(current, slot.position) : 0);
    if (gain > 0 && (!best || gain > best.gain)) best = { slotId: slot.id, gain };
  }
  return best;
}
