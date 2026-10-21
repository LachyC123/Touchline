import { z } from 'zod';
import { CREST_SHAPES, KIT_CUTS, KIT_PATTERNS } from '../domain/club/types';
import {
  ACCESSORY_IDS,
  ATTRIBUTE_KEYS,
  BROW_IDS,
  BUILD_IDS,
  CELEBRATION_IDS,
  EYE_COLOUR_IDS,
  EYE_IDS,
  FACE_IDS,
  FACIAL_HAIR_IDS,
  HAIR_COLOUR_IDS,
  HAIR_IDS,
  MOUTH_IDS,
  NOSE_IDS,
  PERSONALITY_TYPES,
  POSITIONS,
  RUNNING_STYLE_IDS,
  SKIN_IDS,
  TIERS,
  type AttributeKey,
} from '../domain/players/types';
import { FORMATION_DEFS, FORMATION_IDS } from '../domain/formations';
import { ONBOARDING_STEPS, PACK_KINDS, SCHEMA_VERSION, TIP_IDS } from '../domain/save/types';
import { CARD_IDS, DECK_MAX, DECK_MIN } from '../game/simulation/cards';

/**
 * Runtime validation for everything persisted or imported. Mirrors the TypeScript domain
 * types; `satisfies` checks in tests keep the two from drifting.
 */
const rating = z.number().int().min(1).max(99);
const percent = z.number().int().min(0).max(100);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const safeCount = z.number().int().min(0).max(1_000_000);

const attributes = z.object(
  Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, rating])) as Record<AttributeKey, typeof rating>,
);

export const appearanceSchema = z.object({
  faceId: z.enum(FACE_IDS),
  skinId: z.enum(SKIN_IDS),
  hairId: z.enum(HAIR_IDS),
  hairColour: z.enum(HAIR_COLOUR_IDS),
  eyeId: z.enum(EYE_IDS),
  eyeColour: z.enum(EYE_COLOUR_IDS),
  browId: z.enum(BROW_IDS),
  noseId: z.enum(NOSE_IDS),
  mouthId: z.enum(MOUTH_IDS),
  facialHairId: z.enum(FACIAL_HAIR_IDS),
  accessoryIds: z.array(z.enum(ACCESSORY_IDS)).max(3),
  build: z.enum(BUILD_IDS),
});

export const footballerSchema = z.object({
  id: z.string().uuid(),
  generatedSeed: z.string().min(1).max(200),
  generatorVersion: z.number().int().min(1),
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  nickname: z.string().min(1).max(30).optional(),
  nationality: z.string().min(1).max(40),
  hometown: z.string().min(1).max(60),
  age: z.number().int().min(15).max(45),
  heightCm: z.number().int().min(140).max(220),
  primaryPosition: z.enum(POSITIONS),
  secondaryPositions: z.array(z.enum(POSITIONS)).max(3),
  strongFoot: z.enum(['left', 'right', 'both']),
  archetypeId: z.string().min(1).max(40),
  appearance: appearanceSchema,
  attributes,
  potential: rating,
  developmentCurve: z.enum(['early', 'steady', 'late']),
  tier: z.enum(TIERS),
  traitIds: z.array(z.string().max(40)).max(4),
  personality: z.object({
    type: z.enum(PERSONALITY_TYPES),
    loyalty: rating,
    ambition: rating,
    professionalism: rating,
    confidence: rating,
    sociability: rating,
  }),
  tendencies: z.object({ risk: rating, pressing: rating, passing: rating, shooting: rating }),
  dreamId: z.string().max(40),
  celebrationId: z.enum(CELEBRATION_IDS),
  runningStyleId: z.enum(RUNNING_STYLE_IDS),
  originStoryId: z.string().max(40),
  level: z.number().int().min(1).max(99),
  xp: safeCount,
  energy: percent,
  morale: percent,
  history: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        kind: z.enum(['signed', 'debut', 'firstGoal', 'upgrade', 'milestone']),
        season: z.number().int().min(1).max(999),
        headline: z.string().min(1).max(200),
        order: z.number().int().min(0),
      }),
    )
    .max(500),
  stats: z.object({ matches: safeCount, goals: safeCount, assists: safeCount, cleanSheets: safeCount }),
  isNew: z.boolean(),
  favourite: z.boolean(),
});

const pair = <T extends z.ZodType>(t: T) => z.object({ home: t, away: t });
const side = z.enum(['home', 'away']);
const cardId = z.enum(CARD_IDS);
const commandSchema = z.object({ type: cardId, side, tick: z.number().int().min(0).max(100_000) });

const simAttributesSchema = z.object({
  ...(Object.fromEntries(
    ['pace', 'acceleration', 'shooting', 'finishing', 'passing', 'vision', 'dribbling', 'ballControl', 'tackling', 'marking', 'strength', 'stamina', 'composure', 'reflexes', 'positioning', 'handling', 'distribution', 'reach'].map((k) => [k, rating]),
  ) as Record<string, typeof rating>),
  // Added with engine-2; lineups frozen by engine-1 lack it (and are not replayed on engine-2).
  setPieces: rating.default(50),
});

const teamLineupSchema = z.object({
  clubId: z.string().min(1).max(64),
  aiStyle: z.enum(['balanced', 'press', 'passing', 'counter', 'direct']),
  name: z.string().min(1).max(60),
  shortName: z.string().min(1).max(6),
  kit: z.object({ primary: hex, secondary: hex, pattern: z.enum(KIT_PATTERNS).optional() }),
  formation: z.enum(FORMATION_IDS),
  deck: z.array(cardId).min(DECK_MIN).max(DECK_MAX).optional(),
  players: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        name: z.string().min(1).max(90),
        shortName: z.string().min(1).max(45),
        slotId: z.string().min(1).max(16),
        role: z.enum(POSITIONS),
        naturalPosition: z.enum(POSITIONS),
        rating,
        attributes: simAttributesSchema,
        traitIds: z.array(z.string().max(40)).max(4),
        strongFoot: z.enum(['left', 'right', 'both']),
        appearance: appearanceSchema,
        runningStyleId: z.enum(RUNNING_STYLE_IDS).optional(),
        celebrationId: z.enum(CELEBRATION_IDS).optional(),
      }),
    )
    .length(7),
});

const clubRef = z.string().min(1).max(40);
const leagueSchema = z.object({
  division: z.number().int().min(0).max(9),
  rounds: z.array(z.array(z.object({ home: clubRef, away: clubRef })).max(8)).max(40),
  round: z.number().int().min(0).max(40),
  results: z
    .array(
      z.object({
        round: z.number().int().min(0).max(40),
        home: clubRef,
        away: clubRef,
        hg: z.number().int().min(0).max(99),
        ag: z.number().int().min(0).max(99),
        scorers: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), clubId: clubRef })).max(40),
      }),
    )
    .max(200),
});

const seasonSummarySchema = z.object({
  season: z.number().int().min(1).max(999),
  division: z.number().int().min(0).max(9),
  divisionName: z.string().max(60),
  position: z.number().int().min(1).max(20),
  played: safeCount,
  won: safeCount,
  drawn: safeCount,
  lost: safeCount,
  gf: safeCount,
  ga: safeCount,
  points: safeCount,
  outcome: z.enum(['promoted', 'relegated', 'champions', 'stayed']),
  prizeCoins: safeCount,
  topScorer: z.object({ name: z.string().max(90), goals: safeCount }).optional(),
});

const pendingMatchSchema = z.object({
  matchId: z.string().min(1).max(40),
  number: z.number().int().min(1),
  seed: z.string().min(1).max(120),
  engineVersion: z.string().max(32),
  opponentId: z.string().min(1).max(40),
  userSide: side,
  home: teamLineupSchema,
  away: teamLineupSchema,
  commands: z.array(commandSchema).max(200),
  checkpointTick: z.number().int().min(0).max(100_000),
  season: z.number().int().min(1).max(999).optional(),
  round: z.number().int().min(0).max(40).optional(),
});

const matchRecordSchema = z.object({
  matchId: z.string().min(1).max(40),
  number: z.number().int().min(1),
  seed: z.string().min(1).max(120),
  engineVersion: z.string().max(32),
  opponentId: z.string().max(40),
  opponentName: z.string().max(60),
  userSide: side,
  score: pair(z.number().int().min(0).max(99)),
  scorers: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), side, minute: z.number().int().min(0).max(130), tick: z.number().int().min(0).max(100_000), assistName: z.string().max(90).optional() })).max(60),
  playerOfMatchId: z.string().max(80),
  playerOfMatchName: z.string().max(90),
  playerOfMatchRating: z.number().min(0).max(10),
  stats: z.object({
    possession: pair(z.number().min(0).max(100)),
    shots: pair(safeCount),
    onTarget: pair(safeCount),
    xg: pair(z.number().min(0).max(99)),
    saves: pair(safeCount),
    passes: pair(safeCount),
  }),
  commands: z.array(commandSchema).max(200),
  rewards: z.object({ coins: safeCount, clubXp: safeCount, lines: z.array(z.object({ label: z.string().max(60), coins: safeCount })).max(10) }),
  gains: z.array(z.object({ playerId: z.string().max(80), xp: safeCount, levelBefore: z.number().int().min(1).max(99), levelAfter: z.number().int().min(1).max(99), rating: z.number().min(0).max(10).optional() })).max(200),
  storyHeadline: z.string().max(200),
  moments: z
    .array(
      z.object({
        minute: z.number().int().min(0).max(130),
        side,
        kind: z.enum(['screamer', 'header', 'freeKick', 'penalty', 'penaltyMiss', 'doubleSave', 'save', 'skill', 'booking', 'woodwork']),
        text: z.string().max(120),
        stat: z.string().max(12).optional(),
      }),
    )
    .max(8)
    .optional(),
  replay: z.object({ home: teamLineupSchema, away: teamLineupSchema }).optional(),
  packId: z.string().uuid().optional(),
  unlockedCards: z.array(cardId).max(CARD_IDS.length).optional(),
  season: z.number().int().min(1).max(999).optional(),
  round: z.number().int().min(0).max(40).optional(),
});

const ownedPackSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(PACK_KINDS),
  source: z.string().max(60),
  tier: z.enum(TIERS),
  grantedOrder: z.number().int().min(0),
  recruit: footballerSchema.nullable(),
  playerId: z.string().uuid().nullable(),
});

export const clubSaveSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    saveId: z.string().uuid(),
    careerSeed: z.string().min(1).max(64),
    contentVersion: z.string().max(32),
    engineVersion: z.string().max(32),
    createdAt: z.string().max(40),
    updatedAt: z.string().max(40),
    club: z.object({
      name: z.string().min(1).max(40),
      shortName: z.string().min(2).max(4),
      stadiumName: z.string().min(1).max(60),
      kit: z.object({ primary: hex, secondary: hex, pattern: z.enum(KIT_PATTERNS), cut: z.enum(KIT_CUTS) }),
      crest: z.enum(CREST_SHAPES),
      stadiumLevel: z.number().int().min(1).max(10),
      reputation: safeCount,
    }),
    coins: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    clubXp: safeCount,
    squadIds: z.array(z.string().uuid()).max(200),
    formationId: z.enum(FORMATION_IDS),
    lineup: z.record(z.string().max(16), z.string().uuid()),
    footballers: z.record(z.string().uuid(), footballerSchema),
    anchorPlayerId: z.string().uuid(),
    packs: z.array(ownedPackSchema).max(500),
    guaranteedRecruitProgress: z.number().int().min(0).max(100),
    rewardClaimIds: z.array(z.string().max(80)).max(100_000),
    nextSeq: z.number().int().min(0),
    season: z.number().int().min(1).max(999),
    onboarding: z.enum(ONBOARDING_STEPS),
    tipsSeen: z.array(z.enum(TIP_IDS)).max(TIP_IDS.length),
    cardsUnlocked: z.array(cardId).min(1).max(CARD_IDS.length),
    deck: z.array(cardId).min(DECK_MIN).max(DECK_MAX),
    newCards: z.array(cardId).max(CARD_IDS.length),
    league: leagueSchema,
    seasons: z.array(seasonSummarySchema).max(999),
    matchNumber: z.number().int().min(0).max(100_000),
    pendingMatch: pendingMatchSchema.nullable(),
    matchRecords: z.array(matchRecordSchema).max(100),
    pendingUpgrades: z.array(z.object({ playerId: z.string().uuid(), level: z.number().int().min(2).max(99), options: z.array(z.string().max(40)).min(1).max(3) })).max(200),
  })
  .superRefine((save, ctx) => {
    for (const id of save.squadIds) {
      if (!save.footballers[id]) ctx.addIssue({ code: 'custom', message: `squad id ${id} has no footballer record` });
    }
    const starters = Object.values(save.lineup);
    if (new Set(starters).size !== starters.length) ctx.addIssue({ code: 'custom', message: 'a player starts in two slots' });
    for (const id of starters) {
      if (!save.squadIds.includes(id)) ctx.addIssue({ code: 'custom', message: `lineup player ${id} is not in the squad` });
    }
    for (const [key, p] of Object.entries(save.footballers)) {
      if (key !== p.id) ctx.addIssue({ code: 'custom', message: `footballer key ${key} != id ${p.id}` });
    }
    if (!save.footballers[save.anchorPlayerId]) ctx.addIssue({ code: 'custom', message: 'anchor player missing' });
    const slots = FORMATION_DEFS[save.formationId].slots.map((s) => s.id);
    for (const key of Object.keys(save.lineup)) {
      if (!slots.includes(key)) ctx.addIssue({ code: 'custom', message: `lineup slot ${key} is not in formation ${save.formationId}` });
    }
    if (save.league.round > save.league.rounds.length) ctx.addIssue({ code: 'custom', message: 'league round is past the end of the season' });
    if (new Set(save.deck).size !== save.deck.length) ctx.addIssue({ code: 'custom', message: 'a card is in the deck twice' });
    for (const c of save.deck) if (!save.cardsUnlocked.includes(c)) ctx.addIssue({ code: 'custom', message: `deck card ${c} is not unlocked` });
    for (const pack of save.packs) {
      if ((pack.recruit === null) === (pack.playerId === null)) ctx.addIssue({ code: 'custom', message: `pack ${pack.id} must hold either a recruit or an opened player` });
      if (pack.playerId && !save.footballers[pack.playerId]) ctx.addIssue({ code: 'custom', message: `pack ${pack.id} opened a missing player` });
      if (pack.recruit && save.footballers[pack.recruit.id]) ctx.addIssue({ code: 'custom', message: `pack ${pack.id} recruit is already in the squad` });
    }
    if (new Set(save.packs.map((p) => p.id)).size !== save.packs.length) ctx.addIssue({ code: 'custom', message: 'duplicate pack id' });
    for (const u of save.pendingUpgrades) {
      if (!save.footballers[u.playerId]) ctx.addIssue({ code: 'custom', message: 'upgrade for unknown player' });
    }
  });

export const settingsSchema = z.object({
  sfx: z.boolean(),
  sfxVolume: z.number().min(0).max(1),
  motion: z.enum(['system', 'reduced', 'full']),
  contrast: z.enum(['normal', 'high']),
  fontSize: z.enum(['normal', 'large']),
  lastExportAt: z.string().max(40).nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  sfxVolume: 0.7,
  motion: 'system',
  contrast: 'normal',
  fontSize: 'normal',
  lastExportAt: null,
};
