import { generateFootballer } from '../players/generator';
import { FORMATION_DEFS } from '../formations';
import { overallAt } from '../players/rating';
import { autoLineup } from './lineup';
import type { Footballer, Position, Tier } from '../players/types';
import { DEFAULT_DECK } from '../../game/simulation/cards';
import { newCup } from '../cup/cup';
import { emptyDressingRoom } from './dressingRoom';
import { newLeague } from '../league/league';
import { grantPack } from '../packs/packs';
import { cardsUnlockedAt } from './manager';
import { seededUuid } from '../rng';
import { CONTENT_VERSION, ENGINE_VERSION, SCHEMA_VERSION, type ClubSave } from '../save/types';
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

  const lineup = autoLineup(Object.values(footballers), '2-2-2');

  const save: ClubSave = {
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
    packs: [],
    guaranteedRecruitProgress: 0,
    rewardClaimIds: [],
    nextSeq: STARTERS.length,
    season: 1,
    onboarding: 'intro',
    tipsSeen: [],
    cardsUnlocked: cardsUnlockedAt(1),
    deck: [...DEFAULT_DECK],
    newCards: [],
    league: newLeague(careerSeed, 1, 0),
    cup: newCup(careerSeed, 1),
    dressingRoom: emptyDressingRoom(),
    seasons: [],
    matchNumber: 0,
    pendingMatch: null,
    matchRecords: [],
    pendingUpgrades: [],
  };
  // The scout's welcome gift: committed now, revealed during onboarding.
  grantPack(save, 'first-signing', 'onboarding');
  return save;
}

/** Average positional rating of the starting seven in the current formation. */
export function squadPower(save: Pick<ClubSave, 'lineup' | 'footballers' | 'formationId'>): number {
  const slots = FORMATION_DEFS[save.formationId].slots;
  let total = 0;
  for (const slot of slots) {
    const p = save.footballers[save.lineup[slot.id] ?? ''];
    total += p ? overallAt(p, slot.position) : 0;
  }
  return Math.round((total / slots.length) * 10) / 10;
}
