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
import { SCHEMA_VERSION } from '../domain/save/types';

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
    formationId: z.literal('2-2-2'),
    lineup: z.record(z.string().max(16), z.string().uuid()),
    footballers: z.record(z.string().uuid(), footballerSchema),
    anchorPlayerId: z.string().uuid(),
    packInventory: z.record(z.string().max(32), safeCount),
    guaranteedRecruitProgress: z.number().int().min(0).max(100),
    rewardClaimIds: z.array(z.string().max(80)).max(100_000),
    nextSeq: z.number().int().min(0),
    season: z.number().int().min(1).max(999),
    tutorialStep: z.string().max(40),
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
