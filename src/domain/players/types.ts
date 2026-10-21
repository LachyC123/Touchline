/**
 * Footballer domain model. Persisted shapes are validated at the storage boundary
 * (see src/storage/schema.ts) — keep the two in sync.
 */

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type Position = (typeof POSITIONS)[number];

export const TIERS = ['street', 'prospect', 'breakout', 'star', 'phenomenon'] as const;
export type Tier = (typeof TIERS)[number];

export const OUTFIELD_ATTRIBUTES = [
  'pace',
  'acceleration',
  'shooting',
  'finishing',
  'passing',
  'vision',
  'dribbling',
  'ballControl',
  'tackling',
  'marking',
  'strength',
  'stamina',
  'composure',
  'setPieces',
] as const;

export const GK_ATTRIBUTES = ['reflexes', 'positioning', 'handling', 'distribution', 'reach'] as const;

export const ATTRIBUTE_KEYS = [...OUTFIELD_ATTRIBUTES, ...GK_ATTRIBUTES] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export type Foot = 'left' | 'right' | 'both';
export type DevelopmentCurve = 'early' | 'steady' | 'late';

export const FACE_IDS = ['oval', 'round', 'square', 'long', 'heart', 'broad'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export const SKIN_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export const HAIR_IDS = [
  'bald',
  'buzz',
  'crew',
  'sidePart',
  'quiff',
  'afro',
  'curlyTop',
  'flatTop',
  'manBun',
  'twists',
  'slick',
  'mop',
  'cornrows',
] as const;
export type HairId = (typeof HAIR_IDS)[number];

export const HAIR_COLOUR_IDS = ['black', 'darkBrown', 'brown', 'auburn', 'ginger', 'blonde', 'platinum', 'grey'] as const;
export type HairColourId = (typeof HAIR_COLOUR_IDS)[number];

export const EYE_IDS = ['round', 'narrow', 'sleepy', 'wide', 'bright'] as const;
export type EyeId = (typeof EYE_IDS)[number];

export const EYE_COLOUR_IDS = ['dark', 'brown', 'hazel', 'blue', 'green', 'grey'] as const;
export type EyeColourId = (typeof EYE_COLOUR_IDS)[number];

export const BROW_IDS = ['flat', 'raised', 'fierce', 'worried', 'arched', 'thick', 'thin', 'cheeky'] as const;
export type BrowId = (typeof BROW_IDS)[number];

export const NOSE_IDS = ['button', 'straight', 'broad', 'hooked', 'long', 'snub'] as const;
export type NoseId = (typeof NOSE_IDS)[number];

export const MOUTH_IDS = ['smile', 'grin', 'neutral', 'smirk', 'determined', 'shout', 'small', 'beam'] as const;
export type MouthId = (typeof MOUTH_IDS)[number];

export const FACIAL_HAIR_IDS = ['none', 'stubble', 'moustache', 'goatee', 'beard', 'chinstrap'] as const;
export type FacialHairId = (typeof FACIAL_HAIR_IDS)[number];

export const ACCESSORY_IDS = ['headband', 'studEarring', 'noseStrip', 'freckles', 'eyeBlack', 'scar'] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

export const BUILD_IDS = ['slim', 'average', 'stocky'] as const;
export type BuildId = (typeof BUILD_IDS)[number];

export interface Appearance {
  faceId: FaceId;
  skinId: SkinId;
  hairId: HairId;
  hairColour: HairColourId;
  eyeId: EyeId;
  eyeColour: EyeColourId;
  browId: BrowId;
  noseId: NoseId;
  mouthId: MouthId;
  facialHairId: FacialHairId;
  accessoryIds: AccessoryId[];
  build: BuildId;
}

export const PERSONALITY_TYPES = [
  'selfless',
  'hotHeaded',
  'ambitious',
  'laidBack',
  'resilient',
  'anxious',
  'perfectionist',
  'joker',
  'bigGame',
] as const;
export type PersonalityType = (typeof PERSONALITY_TYPES)[number];

export interface Personality {
  type: PersonalityType;
  loyalty: number;
  ambition: number;
  professionalism: number;
  confidence: number;
  sociability: number;
}

export interface Tendencies {
  risk: number;
  pressing: number;
  passing: number;
  shooting: number;
}

export const CELEBRATION_IDS = ['kneeSlide', 'aeroplane', 'salute', 'cuppedEar', 'shush', 'robot', 'heartHands', 'cornerFlag', 'backflip'] as const;
export type CelebrationId = (typeof CELEBRATION_IDS)[number];

export const RUNNING_STYLE_IDS = ['upright', 'hunched', 'bouncy', 'gliding', 'choppy'] as const;
export type RunningStyleId = (typeof RUNNING_STYLE_IDS)[number];

export const HISTORY_KINDS = ['signed', 'debut', 'firstGoal', 'upgrade', 'milestone', 'hatTrick', 'honour', 'dream', 'injury', 'nickname'] as const;
export type HistoryEventKind = (typeof HISTORY_KINDS)[number];

export interface HistoryEvent {
  id: string;
  kind: HistoryEventKind;
  season: number;
  /** Short newspaper-style headline built from real stored facts. */
  headline: string;
  /** Monotonic in-career ordering (not wall time) so seeds stay reproducible. */
  order: number;
}

export interface Footballer {
  id: string;
  generatedSeed: string;
  generatorVersion: number;
  firstName: string;
  lastName: string;
  nickname?: string;
  nationality: string;
  hometown: string;
  age: number;
  heightCm: number;
  primaryPosition: Position;
  secondaryPositions: Position[];
  strongFoot: Foot;
  archetypeId: string;
  appearance: Appearance;
  attributes: Attributes;
  potential: number;
  developmentCurve: DevelopmentCurve;
  tier: Tier;
  traitIds: string[];
  personality: Personality;
  tendencies: Tendencies;
  dreamId: string;
  celebrationId: CelebrationId;
  runningStyleId: RunningStyleId;
  originStoryId: string;
  level: number;
  xp: number;
  energy: number;
  morale: number;
  history: HistoryEvent[];
  stats: { matches: number; goals: number; assists: number; cleanSheets: number };
  /** UI flags */
  isNew: boolean;
  favourite: boolean;
}
