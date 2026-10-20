import { ARCHETYPE_BY_ID, archetypesFor, footWord, type Archetype } from '../../data/archetypes';
import { NAME_POOLS, isNameAllowed, type NamePool } from '../../data/names';
import { DREAMS, NICKNAME_TEMPLATES, ORIGIN_STORIES, PERSONALITIES, PERSONALITY_BY_ID } from '../../data/personality';
import { TIER_DEFS, TIER_ORDER } from '../../data/tiers';
import { TRAITS } from '../../data/traits';
import { clamp, seededUuid, stream, type Rng } from '../rng';
import { overall, rawRoleScore } from './rating';
import {
  CELEBRATION_IDS,
  GK_ATTRIBUTES,
  OUTFIELD_ATTRIBUTES,
  RUNNING_STYLE_IDS,
  type AccessoryId,
  type Appearance,
  type AttributeKey,
  type Attributes,
  type BrowId,
  type BuildId,
  type DevelopmentCurve,
  type EyeColourId,
  type EyeId,
  type FaceId,
  type FacialHairId,
  type Foot,
  type Footballer,
  type HairColourId,
  type HairId,
  type MouthId,
  type NoseId,
  type Personality,
  type Position,
  type SkinId,
  type Tendencies,
  type Tier,
} from './types';

/** Bump when generation output for an existing seed would change. Stored on every player. */
export const GENERATOR_VERSION = 1;

export interface GenerateOptions {
  seed: string;
  tier?: Tier;
  position?: Position;
  /** Overrides the tier-rolled Overall (used for the starting squad). */
  targetOvr?: number;
  ageRange?: readonly [number, number];
  season?: number;
}

const POSITION_WEIGHTS: readonly (readonly [Position, number])[] = [
  ['GK', 12],
  ['DEF', 30],
  ['MID', 30],
  ['FWD', 28],
];

/** Natural positional lean applied before archetype offsets (keeps defenders from finishing like strikers). */
const POSITIONAL_LEAN: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: { pace: -14, acceleration: -12, shooting: -22, finishing: -25, dribbling: -20, tackling: -18, marking: -18, setPieces: -10, vision: -8, passing: -6, ballControl: -8 },
  DEF: { finishing: -12, shooting: -8, dribbling: -6, setPieces: -3, tackling: 6, marking: 6, strength: 4 },
  MID: { finishing: -4, tackling: -2, marking: -4, passing: 4, vision: 3 },
  FWD: { tackling: -14, marking: -14, finishing: 4, shooting: 3, vision: -3 },
};

export function rollTier(rng: Rng): Tier {
  return rng.weighted(TIER_ORDER.map((t) => [t, TIER_DEFS[t].odds] as const));
}

export function generateFootballer(opts: GenerateOptions): Footballer {
  const { seed } = opts;
  const idRng = stream(seed, 'identity');
  const attrRng = stream(seed, 'attributes');
  const appRng = stream(seed, 'appearance');
  const persRng = stream(seed, 'personality');

  const tier = opts.tier ?? rollTier(idRng);
  const tierDef = TIER_DEFS[tier];
  const position = opts.position ?? idRng.weighted(POSITION_WEIGHTS);
  const archetype = idRng.weighted(archetypesFor(position).map((a) => [a, a.weight] as const));

  const pool = idRng.weighted(NAME_POOLS.map((p) => [p, p.weight] as const));
  const { firstName, lastName } = pickName(idRng, pool);
  const hometown = idRng.pick(pool.towns);

  const [minAge, maxAge] = opts.ageRange ?? [17, 34];
  const age = Math.round(clamp(idRng.normal(24, 4.5), minAge, maxAge));
  const strongFoot: Foot = idRng.weighted([
    ['right', 68],
    ['left', 24],
    ['both', 8],
  ]);
  const developmentCurve: DevelopmentCurve =
    age <= 21
      ? idRng.weighted([['early', 3], ['steady', 4], ['late', 3]])
      : idRng.weighted([['early', 2], ['steady', 5], ['late', 1]]);

  // ---- Attributes -------------------------------------------------------
  const ageAdj = age <= 19 ? -4 : age <= 22 ? -2 : age >= 30 ? 1 : 0;
  const targetOvr = Math.round(
    clamp(opts.targetOvr ?? attrRng.int(tierDef.ovr[0], tierDef.ovr[1]) + ageAdj, 30, 85),
  );
  const attributes = buildAttributes(attrRng, position, archetype, targetOvr);
  const secondaryPositions = archetype.secondary.filter(() => attrRng.chance(0.55));
  const ovr = overall({ attributes, primaryPosition: position, secondaryPositions });

  const youthBonus = age <= 20 ? 4 : age <= 23 ? 2 : age >= 31 ? -8 : age >= 28 ? -4 : 0;
  const gain = Math.max(age >= 31 ? attrRng.int(0, 4) : 1, attrRng.int(tierDef.potentialGain[0], tierDef.potentialGain[1]) + youthBonus);
  const potential = Math.round(clamp(ovr + gain, ovr, tierDef.potentialCap));

  // ---- Traits ------------------------------------------------------------
  const traitCount = attrRng.chance(tierDef.secondTrait) ? 2 : 1;
  const traitIds = pickTraits(attrRng, position, archetype, traitCount);

  // ---- Personality, tendencies, story -----------------------------------
  const personality = buildPersonality(persRng);
  const tendencies = buildTendencies(persRng, attributes, personality, archetype);
  const dreamId = persRng.pick(DREAMS.filter((d) => d.positions.includes(position))).id;
  const celebrationId = persRng.pick(CELEBRATION_IDS);
  const runningStyleId = persRng.pick(RUNNING_STYLE_IDS);
  const originStoryId = persRng.pick(ORIGIN_STORIES.filter((o) => age >= o.minAge && age <= o.maxAge)).id;
  const nickname = pickNickname(persRng, position, attributes, lastName);

  // ---- Appearance --------------------------------------------------------
  const appearance = buildAppearance(appRng, pool, age, archetype);
  const heightCm = rollHeight(appRng, position, appearance.build);

  return {
    id: seededUuid(seed),
    generatedSeed: seed,
    generatorVersion: GENERATOR_VERSION,
    firstName,
    lastName,
    ...(nickname ? { nickname } : {}),
    nationality: pool.nationality,
    hometown,
    age,
    heightCm,
    primaryPosition: position,
    secondaryPositions,
    strongFoot,
    archetypeId: archetype.id,
    appearance,
    attributes,
    potential,
    developmentCurve,
    tier,
    traitIds,
    personality,
    tendencies,
    dreamId,
    celebrationId,
    runningStyleId,
    originStoryId,
    level: 1,
    xp: 0,
    energy: 100,
    morale: 60,
    history: [],
    stats: { matches: 0, goals: 0, assists: 0, cleanSheets: 0 },
    isNew: true,
    favourite: false,
  };
}

function pickName(rng: Rng, pool: NamePool): { firstName: string; lastName: string } {
  for (let attempt = 0; attempt < 8; attempt++) {
    const firstName = rng.pick(pool.given);
    const lastName = rng.pick(pool.family);
    if (isNameAllowed(`${firstName}${lastName}`) && firstName !== lastName) return { firstName, lastName };
  }
  // Curated pools make this unreachable in practice; fall back to the first safe pair.
  return { firstName: pool.given[0] as string, lastName: pool.family[0] as string };
}

function buildAttributes(rng: Rng, position: Position, archetype: Archetype, target: number): Attributes {
  const lean = POSITIONAL_LEAN[position];
  const values = {} as Attributes;
  for (const key of OUTFIELD_ATTRIBUTES) {
    values[key] = target + (lean[key] ?? 0) + (archetype.offsets[key] ?? 0) + rng.normal(0, 4.5);
  }
  for (const key of GK_ATTRIBUTES) {
    values[key] =
      position === 'GK' ? target + (archetype.offsets[key] ?? 0) + rng.normal(0, 4) : rng.int(6, 24);
  }

  // Shift role-relevant attributes so the weighted score lands on target.
  const shiftKeys: readonly AttributeKey[] = position === 'GK' ? [...GK_ATTRIBUTES, 'composure'] : OUTFIELD_ATTRIBUTES;
  for (let i = 0; i < 5; i++) {
    const delta = target - rawRoleScore(values, position);
    if (Math.abs(delta) < 0.25) break;
    for (const key of shiftKeys) values[key] = values[key] + delta;
    for (const key of shiftKeys) values[key] = clamp(values[key], 5, 97);
  }
  for (const key of [...OUTFIELD_ATTRIBUTES, ...GK_ATTRIBUTES]) values[key] = Math.round(clamp(values[key], 5, 97));
  return values;
}

function pickTraits(rng: Rng, position: Position, archetype: Archetype, count: number): string[] {
  const eligible = TRAITS.filter((t) => t.positions.includes(position));
  const chosen: string[] = [];
  for (let i = 0; i < count; i++) {
    const options = eligible.filter((t) => !chosen.includes(t.id));
    if (options.length === 0) break;
    const pick = rng.weighted(options.map((t) => [t.id, archetype.traitBias.includes(t.id) ? 4 : 1] as const));
    chosen.push(pick);
  }
  return chosen;
}

function buildPersonality(rng: Rng): Personality {
  const type = rng.pick(PERSONALITIES).id;
  const bias = PERSONALITY_BY_ID[type].bias;
  const roll = (key: keyof typeof bias) => Math.round(clamp(rng.normal(55, 14) + (bias[key] ?? 0), 5, 99));
  return {
    type,
    loyalty: roll('loyalty'),
    ambition: roll('ambition'),
    professionalism: roll('professionalism'),
    confidence: roll('confidence'),
    sociability: roll('sociability'),
  };
}

function buildTendencies(rng: Rng, a: Attributes, p: Personality, archetype: Archetype): Tendencies {
  const t = (n: number) => Math.round(clamp(n + rng.normal(0, 6), 5, 95));
  const hot = p.type === 'hotHeaded' ? 12 : p.type === 'anxious' ? -10 : 0;
  return {
    risk: t(40 + hot + (a.dribbling - 50) * 0.4 + (archetype.id.includes('Dribbler') || archetype.id.includes('Speedster') ? 10 : 0)),
    pressing: t(40 + (a.stamina - 50) * 0.5 + (p.type === 'resilient' ? 8 : 0)),
    passing: t(45 + (a.vision - 50) * 0.5 + (p.type === 'selfless' ? 12 : 0)),
    shooting: t(35 + (a.shooting - 50) * 0.4 + (a.finishing - 50) * 0.3 + (p.type === 'ambitious' ? 8 : 0)),
  };
}

function pickNickname(rng: Rng, position: Position, a: Attributes, lastName: string): string | undefined {
  if (!rng.chance(0.16)) return undefined;
  const fast = a.pace >= 62;
  const options = NICKNAME_TEMPLATES.filter(
    (n) =>
      n.when === 'any' ||
      (n.when === 'fast' && fast) ||
      (n.when === 'gk' && position === 'GK') ||
      (n.when === 'def' && position === 'DEF') ||
      (n.when === 'fwd' && position === 'FWD'),
  );
  // Occasionally a classic British shortening of the surname instead.
  if (rng.chance(0.35) && /^[A-Za-z]{4,7}$/.test(lastName) && !/[aiouy]$/.test(lastName)) {
    const nick = `${lastName}y`;
    if (isNameAllowed(nick)) return nick;
  }
  return rng.pick(options).pattern;
}

// ---- Appearance ------------------------------------------------------------

const DARKER_POOLS = new Set(['nga', 'gha', 'sen', 'jam']);
const EAST_ASIAN_POOLS = new Set(['jpn']);

function skinWeights(pool: NamePool): readonly (readonly [SkinId, number])[] {
  // Every heritage can produce every tone; weights only keep the default population plausible.
  if (DARKER_POOLS.has(pool.id)) return [['s1', 1], ['s2', 1], ['s3', 2], ['s4', 4], ['s5', 10], ['s6', 22], ['s7', 26], ['s8', 18]];
  if (EAST_ASIAN_POOLS.has(pool.id)) return [['s1', 6], ['s2', 22], ['s3', 22], ['s4', 6], ['s5', 2], ['s6', 1], ['s7', 1], ['s8', 1]];
  if (pool.id === 'bra' || pool.id === 'por' || pool.id === 'esp' || pool.id === 'tur') return [['s1', 4], ['s2', 12], ['s3', 18], ['s4', 18], ['s5', 12], ['s6', 8], ['s7', 4], ['s8', 2]];
  return [['s1', 20], ['s2', 22], ['s3', 14], ['s4', 9], ['s5', 7], ['s6', 7], ['s7', 6], ['s8', 4]];
}

function isDeep(skin: SkinId): boolean {
  return skin === 's6' || skin === 's7' || skin === 's8';
}

function buildAppearance(rng: Rng, pool: NamePool, age: number, archetype: Archetype): Appearance {
  const skinId = rng.weighted(skinWeights(pool));
  const deep = isDeep(skinId);
  const faceId: FaceId = rng.pick(['oval', 'round', 'square', 'long', 'heart', 'broad'] as const);

  const hairId: HairId = rng.weighted<HairId>(
    deep
      ? [['bald', 3], ['buzz', 16], ['crew', 8], ['afro', 14], ['twists', 14], ['cornrows', 10], ['flatTop', 8], ['curlyTop', 10], ['sidePart', 3], ['manBun', 3], ['mop', 2], ['quiff', 2], ['slick', 2]]
      : [['bald', 3], ['buzz', 8], ['crew', 12], ['sidePart', 12], ['quiff', 11], ['curlyTop', 8], ['manBun', 6], ['mop', 11], ['slick', 9], ['flatTop', 3], ['afro', 3], ['twists', 2], ['cornrows', 1]],
  );

  let hairColour: HairColourId;
  if (age >= 31 && rng.chance(0.3)) hairColour = 'grey';
  else if (deep) hairColour = rng.weighted<HairColourId>([['black', 72], ['darkBrown', 20], ['blonde', 4], ['platinum', 4]]);
  else if (EAST_ASIAN_POOLS.has(pool.id)) hairColour = rng.weighted<HairColourId>([['black', 70], ['darkBrown', 22], ['brown', 4], ['platinum', 4]]);
  else hairColour = rng.weighted<HairColourId>([['black', 14], ['darkBrown', 26], ['brown', 24], ['auburn', 8], ['ginger', 8], ['blonde', 16], ['platinum', 4]]);

  const eyeId: EyeId = rng.pick(['round', 'narrow', 'sleepy', 'wide', 'bright'] as const);
  const lightish = skinId === 's1' || skinId === 's2' || skinId === 's3';
  const eyeColour: EyeColourId = EAST_ASIAN_POOLS.has(pool.id)
    ? rng.weighted<EyeColourId>([['dark', 55], ['brown', 45]])
    : lightish
    ? rng.weighted<EyeColourId>([['dark', 10], ['brown', 30], ['hazel', 16], ['blue', 24], ['green', 12], ['grey', 8]])
    : rng.weighted<EyeColourId>([['dark', 52], ['brown', 38], ['hazel', 8], ['green', 2]]);
  const browId: BrowId = rng.pick(['flat', 'raised', 'fierce', 'worried', 'arched', 'thick', 'thin', 'cheeky'] as const);
  const noseId: NoseId = rng.pick(['button', 'straight', 'broad', 'hooked', 'long', 'snub'] as const);
  const mouthId: MouthId = rng.pick(['smile', 'grin', 'neutral', 'smirk', 'determined', 'shout', 'small', 'beam'] as const);
  const facialHairId: FacialHairId =
    age < 19
      ? rng.weighted<FacialHairId>([['none', 90], ['stubble', 10]])
      : rng.weighted<FacialHairId>([['none', 42], ['stubble', 20], ['moustache', 5], ['goatee', 10], ['beard', 14], ['chinstrap', 9]]);

  const accessoryIds: AccessoryId[] = [];
  const accCount = rng.weighted([[0, 62], [1, 32], [2, 6]] as const);
  const accPool: AccessoryId[] = ['headband', 'studEarring', 'noseStrip', 'eyeBlack', 'scar'];
  if (!deep) accPool.push('freckles', 'freckles');
  for (let i = 0; i < accCount; i++) {
    const options = accPool.filter((a) => !accessoryIds.includes(a) && !(a === 'headband' && (hairId === 'bald' || hairId === 'manBun')));
    if (options.length === 0) break;
    accessoryIds.push(rng.pick(options));
  }

  const heavy = ['defStopper', 'fwdTarget', 'gkCommander', 'midDestroyer'].includes(archetype.id);
  const light = ['fwdSpeedster', 'midDribbler', 'defFlyer'].includes(archetype.id);
  const build: BuildId = heavy
    ? rng.weighted<BuildId>([['slim', 1], ['average', 4], ['stocky', 6]])
    : light
      ? rng.weighted<BuildId>([['slim', 6], ['average', 4], ['stocky', 1]])
      : rng.weighted<BuildId>([['slim', 3], ['average', 5], ['stocky', 2]]);

  return { faceId, skinId, hairId, hairColour, eyeId, eyeColour, browId, noseId, mouthId, facialHairId, accessoryIds, build };
}

function rollHeight(rng: Rng, position: Position, build: BuildId): number {
  const base = position === 'GK' ? 188 : position === 'DEF' ? 183 : position === 'FWD' ? 179 : 176;
  const adj = build === 'stocky' ? 3 : build === 'slim' ? -2 : 0;
  return Math.round(clamp(rng.normal(base + adj, 5), 160, 202));
}

export function archetypeSubtitle(p: Pick<Footballer, 'archetypeId' | 'strongFoot' | 'generatedSeed'>): string {
  const archetype = ARCHETYPE_BY_ID[p.archetypeId];
  if (!archetype) return 'Footballer';
  // Stable choice of subtitle without consuming any persisted stream.
  const rng = stream(p.generatedSeed, 'visual:subtitle');
  return rng.pick(archetype.subtitles).replace('{foot}', footWord(p.strongFoot));
}

export function displayName(p: Pick<Footballer, 'firstName' | 'lastName'>): string {
  return `${p.firstName} ${p.lastName}`;
}
