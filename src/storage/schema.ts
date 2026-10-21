import { z } from 'zod';
import { CREST_SHAPES, KIT_CUTS, KIT_PATTERNS } from '../domain/club/types';
import { INJURY_KIND_IDS } from '../domain/players/injuries';
import { OBJECTIVE_IDS } from '../domain/match/objectives';
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
  HISTORY_KINDS,
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
import { MILESTONE_KINDS } from '../domain/players/milestones';
import { EVENT_KINDS, INJURY_TREATMENTS, ONBOARDING_STEPS, PACK_KINDS, SCHEMA_VERSION, TIP_IDS } from '../domain/save/types';
import { CARD_IDS, DECK_MAX, DECK_MIN } from '../game/simulation/cards';
import { SUBS } from '../game/simulation/constants';
import { CUP_ROUNDS } from '../domain/cup/cup';

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
        kind: z.enum(HISTORY_KINDS),
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
const commandSchema = z
  .object({ type: z.union([cardId, z.literal('SUB')]), side, tick: z.number().int().min(0).max(100_000), outId: z.string().min(1).max(80).optional(), inId: z.string().min(1).max(80).optional() })
  .refine((c) => (c.type === 'SUB') === (c.outId !== undefined && c.inId !== undefined), { message: 'a substitution names who goes off and who comes on' });

const simAttributesSchema = z.object({
  ...(Object.fromEntries(
    ['pace', 'acceleration', 'shooting', 'finishing', 'passing', 'vision', 'dribbling', 'ballControl', 'tackling', 'marking', 'strength', 'stamina', 'composure', 'reflexes', 'positioning', 'handling', 'distribution', 'reach'].map((k) => [k, rating]),
  ) as Record<string, typeof rating>),
  // Added with engine-2; lineups frozen by engine-1 lack it (and are not replayed on engine-2).
  setPieces: rating.default(50),
});

const lineupPlayerSchema = z.object({
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
});

const teamLineupSchema = z.object({
  clubId: z.string().min(1).max(64),
  aiStyle: z.enum(['balanced', 'press', 'passing', 'counter', 'direct']),
  name: z.string().min(1).max(60),
  shortName: z.string().min(1).max(6),
  kit: z.object({ primary: hex, secondary: hex, pattern: z.enum(KIT_PATTERNS).optional() }),
  formation: z.enum(FORMATION_IDS),
  deck: z.array(cardId).min(DECK_MIN).max(DECK_MAX).optional(),
  players: z.array(lineupPlayerSchema).length(7),
  bench: z.array(lineupPlayerSchema).max(SUBS.bench).optional(),
  penaltyTakerId: z.string().max(80).optional(),
  captainId: z.string().max(80).optional(),
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
  cup: z.object({ reached: z.number().int().min(0).max(9), won: z.boolean() }).optional(),
});

const dressingRoomSchema = z.object({
  events: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(EVENT_KINDS),
        playerId: z.string().max(80).optional(),
        otherId: z.string().max(80).optional(),
        clubId: z.string().max(40).optional(),
        atMatch: z.number().int().min(0),
        status: z.enum(['open', 'resolved', 'news']),
        choiceId: z.string().max(120).optional(),
        outcome: z.string().max(240).optional(),
      }),
    )
    .max(40),
  promises: z.array(z.object({ id: z.string().uuid(), playerId: z.string().max(80), starts: z.number().int().min(1).max(10), got: z.number().int().min(0).max(10), byMatch: z.number().int().min(0) })).max(20),
  away: z.array(z.object({ playerId: z.string().max(80), untilMatch: z.number().int().min(0), reason: z.string().max(80) })).max(20),
  lastEventMatch: z.number().int().min(0),
  backed: z.array(z.string().max(80)).max(40),
});

const cupSchema = z.object({
  season: z.number().int().min(1).max(999),
  rounds: z
    .array(
      z
        .array(
          z.object({
            home: clubRef,
            away: clubRef,
            hg: z.number().int().min(0).max(99).optional(),
            ag: z.number().int().min(0).max(99).optional(),
            pens: z.object({ home: safeCount, away: safeCount }).optional(),
            winner: clubRef.optional(),
            scorers: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), clubId: clubRef })).max(40).optional(),
          }),
        )
        .max(16),
    )
    .max(8),
  round: z.number().int().min(0).max(8),
});

const objectiveSchema = z.object({ id: z.enum(OBJECTIVE_IDS), text: z.string().max(80), playerId: z.string().uuid().optional() });

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
  competition: z.enum(['league', 'cup']).optional(),
  cupRound: z.number().int().min(0).max(9).optional(),
  objectives: z.array(objectiveSchema).max(3).optional(),
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
  scorers: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), side, minute: z.number().int().min(0).max(130), tick: z.number().int().min(0).max(100_000), assistName: z.string().max(90).optional(), assistId: z.string().max(80).optional() })).max(60),
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
        kind: z.enum(['screamer', 'header', 'freeKick', 'penalty', 'penaltyMiss', 'doubleSave', 'save', 'skill', 'booking', 'woodwork', 'sub']),
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
  competition: z.enum(['league', 'cup']).optional(),
  cupRound: z.number().int().min(0).max(9).optional(),
  shootout: z
    .object({
      home: safeCount,
      away: safeCount,
      winner: side,
      kicks: z.array(z.object({ side, takerId: z.string().max(80), takerName: z.string().max(90), keeperName: z.string().max(90), scored: z.boolean() })).max(80),
    })
    .optional(),
  milestones: z
    .array(z.object({ playerId: z.string().max(80), name: z.string().max(80), kind: z.enum(MILESTONE_KINDS), text: z.string().max(200) }))
    .max(40)
    .optional(),
  morale: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), delta: z.number().int().min(-100).max(100), reasons: z.array(z.string().max(40)).max(8) })).max(12).optional(),
  dreams: z.array(z.object({ playerId: z.string().max(80), name: z.string().max(90), text: z.string().max(120) })).max(14).optional(),
  attendance: z.number().int().min(0).max(100_000).optional(),
  repGain: z.number().int().min(0).max(1000).optional(),
  repTier: z.string().max(20).optional(),
  objectives: z.array(objectiveSchema.extend({ done: z.boolean() })).max(3).optional(),
  injuries: z.array(z.object({ playerId: z.string().uuid(), name: z.string().max(80), kind: z.enum(INJURY_KIND_IDS), minute: z.number().int().min(0).max(130), byName: z.string().max(80), outFor: z.number().int().min(0).max(20) })).max(4).optional(),
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

const injurySchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  kind: z.enum(INJURY_KIND_IDS),
  matchId: z.string().max(80),
  atMatch: z.number().int().min(0).max(100_000),
  minute: z.number().int().min(0).max(130),
  byName: z.string().max(80),
  outFor: z.number().int().min(0).max(20),
  untilMatch: z.number().int().min(0).max(100_000),
  treatment: z.enum(INJURY_TREATMENTS).nullable(),
  fragileUntil: z.number().int().min(0).max(100_000).optional(),
});

const transfersSchema = z.object({
  bought: z.array(z.string().uuid()).max(2000),
  haggles: z.array(z.object({ listingId: z.string().uuid(), won: z.boolean() })).max(2000),
  listed: z.array(z.string().uuid()).max(40),
  offers: z
    .array(
      z.object({
        id: z.string().uuid(),
        playerId: z.string().uuid(),
        clubId: z.string().max(40),
        fee: z.number().int().min(0).max(1_000_000),
        atMatch: z.number().int().min(0).max(100_000),
        expiresAfter: z.number().int().min(0).max(100_000),
        unsolicited: z.boolean(),
        status: z.enum(['open', 'accepted', 'rejected', 'expired']),
      }),
    )
    .max(60),
  log: z
    .array(
      z.object({
        kind: z.enum(['in', 'out']),
        playerId: z.string().uuid(),
        name: z.string().max(80),
        clubId: z.string().max(40).nullable(),
        fee: z.number().int().min(0).max(1_000_000),
        atMatch: z.number().int().min(0).max(100_000),
        season: z.number().int().min(1).max(999),
      }),
    )
    .max(80),
});

const clubDefSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(40),
  shortName: z.string().min(2).max(4),
  stadiumName: z.string().min(1).max(60),
  kit: z.object({ primary: hex, secondary: hex, pattern: z.enum(KIT_PATTERNS), cut: z.enum(KIT_CUTS) }),
  crest: z.enum(CREST_SHAPES),
  formation: z.enum(FORMATION_IDS),
  aiStyle: z.enum(['balanced', 'press', 'passing', 'counter', 'direct']),
  baseOvr: z.number().int().min(20).max(99),
  styleLine: z.string().max(240),
  rival: z.boolean().optional(),
  town: z.string().max(40).optional(),
  industry: z.string().max(20).optional(),
  nickname: z.string().max(40).optional(),
  quirk: z.string().max(160).optional(),
  founded: z.number().int().min(1800).max(2100).optional(),
});

const worldSchema = z
  .object({
    kind: z.enum(['classic', 'generated']),
    home: z.object({ town: z.string().max(40), industry: z.string().max(20), nickname: z.string().max(40), line: z.string().max(160), founded: z.number().int().min(1800).max(2100) }),
    clubs: z.array(clubDefSchema).min(2).max(64),
    divisions: z.array(z.object({ name: z.string().max(60), clubIds: z.array(z.string().max(40)).min(1).max(20), promote: z.number().int().min(0).max(8), relegate: z.number().int().min(0).max(8) })).min(1).max(8),
    cupGuestIds: z.array(z.string().max(40)).max(8),
    departed: z.array(z.string().uuid()).max(2000),
  })
  .superRefine((w, ctx) => {
    const ids = new Set(w.clubs.map((c) => c.id));
    if (ids.size !== w.clubs.length) ctx.addIssue({ code: 'custom', message: 'duplicate club id in the world' });
    for (const id of [...w.divisions.flatMap((d) => d.clubIds), ...w.cupGuestIds]) if (!ids.has(id)) ctx.addIssue({ code: 'custom', message: `world references unknown club ${id}` });
    // The league is eight clubs (seven plus the player's); the cup needs an even draw.
    for (const d of w.divisions) if (d.clubIds.length !== 7) ctx.addIssue({ code: 'custom', message: `${d.name} must have seven other clubs` });
    if ((w.divisions.reduce((n, d) => n + d.clubIds.length, 0) + w.cupGuestIds.length + 1) % 2 !== 0) ctx.addIssue({ code: 'custom', message: 'the cup draw needs an even number of clubs' });
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
    injuries: z.array(injurySchema).max(60),
    transfers: transfersSchema,
    world: worldSchema,
    league: leagueSchema,
    cup: cupSchema.nullable(),
    dressingRoom: dressingRoomSchema,
    captainId: z.string().max(80).nullable(),
    penaltyTakerId: z.string().max(80).nullable(),
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
    for (const id of save.transfers.listed) if (!save.squadIds.includes(id)) ctx.addIssue({ code: 'custom', message: `listed player ${id} is not in the squad` });
    if (save.dressingRoom.events.filter((e) => e.status === 'open').length > 1) ctx.addIssue({ code: 'custom', message: 'only one dressing-room request can be open' });
    if (save.cup) {
      if (save.cup.rounds.length < Math.min(save.cup.round + 1, CUP_ROUNDS.length) || save.cup.round > CUP_ROUNDS.length) ctx.addIssue({ code: 'custom', message: 'cup rounds do not match its progress' });
      for (let r = 0; r < save.cup.round; r++) if (save.cup.rounds[r]?.some((t) => !t.winner)) ctx.addIssue({ code: 'custom', message: `cup round ${r} has an undecided tie` });
    }
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
