import { generateFootballer } from '../players/generator';
import { overall, overallAt } from '../players/rating';
import type { Footballer, Position, Tier } from '../players/types';
import { seededUuid } from '../rng';
import { CONTENT_VERSION, ENGINE_VERSION, FORMATIONS, SCHEMA_VERSION, type ClubSave } from '../save/types';
import { DEFAULT_CLUB, type ClubIdentity } from './types';

interface StarterSpec {
  position: Position;
  tier: Tier;
  ovr: number;
  ageRange?: readonly [number, number];
  starter: boolean;
  anchor?: boolean;
}

/**
 * Starting squad: 7 starters (GK, 2 DEF, 2 MID, 2 FWD) + 3 substitutes, OVR 42–61.
 * One young forward is the emotional anchor: promising, imperfect, clearly improvable.
 */
const STARTERS: readonly StarterSpec[] = [
  { position: 'GK', tier: 'street', ovr: 55, starter: true },
  { position: 'DEF', tier: 'street', ovr: 58, ageRange: [26, 32], starter: true },
  { position: 'DEF', tier: 'street', ovr: 51, starter: true },
  { position: 'MID', tier: 'prospect', ovr: 56, starter: true },
  { position: 'MID', tier: 'street', ovr: 53, starter: true },
  { position: 'FWD', tier: 'street', ovr: 57, starter: true },
  { position: 'FWD', tier: 'prospect', ovr: 52, ageRange: [18, 20], starter: true, anchor: true },
  { position: 'DEF', tier: 'street', ovr: 46, starter: false },
  { position: 'MID', tier: 'street', ovr: 44, ageRange: [17, 21], starter: false },
  { position: 'FWD', tier: 'street', ovr: 48, starter: false },
];

function generateStarter(seed: string, spec: StarterSpec): Footballer {
  return generateFootballer({
    seed,
    tier: spec.tier,
    position: spec.position,
    targetOvr: spec.ovr,
    ...(spec.ageRange ? { ageRange: spec.ageRange } : {}),
    season: 1,
  });
}

export function createCareer(careerSeed: string, nowIso: string, identity: ClubIdentity = DEFAULT_CLUB): ClubSave {
  const footballers: Record<string, Footballer> = {};
  const squadIds: string[] = [];
  let anchorPlayerId = '';

  STARTERS.forEach((spec, i) => {
    // Re-roll (deterministically) until the surname is unique in the squad.
    const usedSurnames = new Set(Object.values(footballers).map((f) => f.lastName));
    let seed = `${careerSeed}:starter:${i}`;
    let p = generateStarter(seed, spec);
    for (let attempt = 1; usedSurnames.has(p.lastName) && attempt < 20; attempt++) {
      seed = `${careerSeed}:starter:${i}:r${attempt}`;
      p = generateStarter(seed, spec);
    }
    p.isNew = false;
    p.history.push({
      id: seededUuid(`${seed}:history:0`),
      kind: 'signed',
      season: 1,
      order: i,
      headline: spec.anchor ? `Handed a first contract at ${identity.name}.` : `One of the founding squad at ${identity.name}.`,
    });
    footballers[p.id] = p;
    squadIds.push(p.id);
    if (spec.anchor) anchorPlayerId = p.id;
  });

  const lineup = autoLineup(Object.values(footballers));

  return {
    schemaVersion: SCHEMA_VERSION,
    saveId: seededUuid(`${careerSeed}:save`),
    careerSeed,
    contentVersion: CONTENT_VERSION,
    engineVersion: ENGINE_VERSION,
    createdAt: nowIso,
    updatedAt: nowIso,
    club: { ...identity, kit: { ...identity.kit }, stadiumLevel: 1, reputation: 0 },
    coins: 100,
    clubXp: 0,
    squadIds,
    formationId: '2-2-2',
    lineup,
    footballers,
    anchorPlayerId,
    packInventory: {},
    guaranteedRecruitProgress: 0,
    rewardClaimIds: [],
    nextSeq: STARTERS.length,
    season: 1,
    tutorialStep: 'start',
  };
}

/**
 * Auto-pick: fill every slot with the best natural-position player first, then cover any
 * gaps with the best positional Overall. Each player starts at most once.
 */
export function autoLineup(players: readonly Footballer[]): Record<string, string> {
  const used = new Set<string>();
  const lineup: Record<string, string> = {};
  const pick = (natural: boolean) => {
    for (const slot of FORMATIONS['2-2-2']) {
      if (lineup[slot.id]) continue;
      const best = players
        .filter((p) => !used.has(p.id) && (!natural || p.primaryPosition === slot.position))
        .map((p) => ({ p, score: overallAt(p, slot.position) }))
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

export function squadPower(save: Pick<ClubSave, 'lineup' | 'footballers'>): number {
  const ids = Object.values(save.lineup);
  if (ids.length === 0) return 0;
  const total = ids.reduce((sum, id) => {
    const p = save.footballers[id];
    return sum + (p ? overall(p) : 0);
  }, 0);
  return Math.round((total / ids.length) * 10) / 10;
}
