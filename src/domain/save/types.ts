import type { ClubIdentity } from '../club/types';
import type { FormationId } from '../formations';
import type { Footballer, Tier } from '../players/types';
import type { CardId } from '../../game/simulation/cards';
import type { MilestoneKind } from '../players/milestones';
import type { ShootoutResult } from '../cup/shootout';
import type { MatchCommand, TeamLineup, TeamSide } from '../../game/simulation/types';

export const SCHEMA_VERSION = 8;
export const CONTENT_VERSION = 'content-8';
export { ENGINE_VERSION } from '../../game/simulation/constants';

export type { FormationId };

/** A match that has kicked off but not been settled. Enough to resume or replay it exactly. */
export interface PendingMatch {
  matchId: string;
  number: number;
  seed: string;
  engineVersion: string;
  opponentId: string;
  userSide: TeamSide;
  /** Frozen at kick-off (attributes included) so a resume replays the identical match. */
  home: TeamLineup;
  away: TeamLineup;
  commands: MatchCommand[];
  /** Last tick the presentation reached (resume point). */
  checkpointTick: number;
  /** League season and round this fixture belongs to. */
  season?: number;
  round?: number;
  /** Absent = league. */
  competition?: Competition;
  cupRound?: number;
}

export interface ScorerLine {
  playerId: string;
  name: string;
  side: TeamSide;
  minute: number;
  /** Engine tick of the goal, for replays. */
  tick: number;
  assistName?: string;
  assistId?: string;
}

export interface MatchMoment {
  minute: number;
  side: TeamSide;
  kind: 'screamer' | 'header' | 'freeKick' | 'penalty' | 'penaltyMiss' | 'doubleSave' | 'save' | 'skill' | 'booking' | 'woodwork' | 'sub';
  text: string;
  /** The attribute behind it, when it was a strong one (e.g. "DRI 78"). */
  stat?: string;
}

export interface RewardLine {
  label: string;
  coins: number;
}

export interface PlayerGain {
  playerId: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  rating?: number;
}

/** What the full-time screen shows, preserved after the match is settled. */
export interface RecordMilestone {
  playerId: string;
  name: string;
  kind: MilestoneKind;
  text: string;
}

export interface MatchRecord {
  matchId: string;
  number: number;
  seed: string;
  engineVersion: string;
  opponentId: string;
  opponentName: string;
  userSide: TeamSide;
  score: { home: number; away: number };
  scorers: ScorerLine[];
  playerOfMatchId: string;
  playerOfMatchName: string;
  playerOfMatchRating: number;
  stats: {
    possession: { home: number; away: number };
    shots: { home: number; away: number };
    onTarget: { home: number; away: number };
    xg: { home: number; away: number };
    saves: { home: number; away: number };
    passes: { home: number; away: number };
  };
  commands: MatchCommand[];
  rewards: { coins: number; clubXp: number; lines: RewardLine[] };
  gains: PlayerGain[];
  /** Scout pack earned by this match, if any. */
  packId?: string;
  /** Manager cards unlocked by the club XP from this match. */
  unlockedCards?: CardId[];
  /** League season and round this match belonged to. */
  season?: number;
  round?: number;
  competition?: Competition;
  cupRound?: number;
  shootout?: ShootoutResult;
  /** Home crowd (home matches only). */
  attendance?: number;
  /** Reputation the club earned from this result. */
  repGain?: number;
  /** Dreams that came true in this match. */
  dreams?: { playerId: string; name: string; text: string }[];
  /** Morale swings worth showing (largest first). */
  morale?: { playerId: string; name: string; delta: number; reasons: string[] }[];
  /** Career landmarks reached in this match (debuts excluded). */
  milestones?: RecordMilestone[];
  storyHeadline: string;
  /** Notable non-routine incidents (screamers, double saves, penalties, skills, bookings). */
  moments?: MatchMoment[];
  /** Frozen lineups so the match can be re-simulated exactly (kept for recent matches only). */
  replay?: { home: TeamLineup; away: TeamLineup };
}

/** How many recent records keep their replay lineups (bounds save size). */
export const REPLAYS_KEPT = 5;

export const PACK_KINDS = ['first-signing', 'local-scout'] as const;
export type PackKind = (typeof PACK_KINDS)[number];

/**
 * An earned scout pack. The recruit inside is generated and stored when the pack is granted,
 * so the outcome is fixed before any reveal: opening only moves that exact player into the squad.
 */
export interface OwnedPack {
  id: string;
  kind: PackKind;
  /** Where it came from, e.g. 'onboarding' or 'match:m3'. */
  source: string;
  /** Rarity is shown on the sealed pack's edge (no deceptive roulette). */
  tier: Tier;
  grantedOrder: number;
  /** The pre-committed recruit; removed once opened. */
  recruit: Footballer | null;
  /** Set when opened: the player who joined. */
  playerId: string | null;
}

/** Guided first-run flow. Each step only advances from the step before it. */
export const ONBOARDING_STEPS = ['intro', 'pack', 'lineup', 'match', 'club', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** One-off coach marks; replaying the tutorial clears them. */
export const TIP_IDS = ['tactic', 'upgrade', 'next-match'] as const;
export type TipId = (typeof TIP_IDS)[number];

/** Club id used for the player's own club in fixtures and results. */
export const PLAYER_CLUB_ID = 'player-club';

export interface LeagueFixture {
  home: string;
  away: string;
}

export interface LeagueScorer {
  playerId: string;
  name: string;
  clubId: string;
}

export interface LeagueResult {
  round: number;
  home: string;
  away: string;
  hg: number;
  ag: number;
  scorers: LeagueScorer[];
}

/** The current season of the division: fixed schedule (generated once), results so far. */
export interface LeagueState {
  division: number;
  rounds: LeagueFixture[][];
  /** Next round to be played (= rounds played this season). */
  round: number;
  results: LeagueResult[];
}

export type Competition = 'league' | 'cup';

export interface CupTie {
  home: string;
  away: string;
  hg?: number;
  ag?: number;
  /** Shootout score when the tie was level after 90 minutes. */
  pens?: { home: number; away: number };
  winner?: string;
  scorers?: LeagueScorer[];
}

export interface CupState {
  season: number;
  /** Rounds are drawn one at a time from the previous round's winners. */
  rounds: CupTie[][];
  /** Index of the next round to be played (rounds.length of the format when finished). */
  round: number;
}

export const EVENT_KINDS = [
  'playingTime',
  'homesick',
  'flatSquad',
  'interview',
  'promiseKept',
  'promiseBroken',
  'dreamTalk',
  'dreamCome',
  'penalties',
  'rivalInterest',
  'bustUp',
  'newDad',
  'schoolVisit',
  'captaincy',
  'armband',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Something in the dressing room: a request with choices, or news of how one played out. */
export interface ClubEvent {
  id: string;
  kind: EventKind;
  playerId?: string;
  /** A second player involved (a bust-up, the current captain). */
  otherId?: string;
  /** A club involved (who is watching him). */
  clubId?: string;
  /** The match after which it happened (matchNumber at the time). */
  atMatch: number;
  status: 'open' | 'resolved' | 'news';
  choiceId?: string;
  /** What happened, in a line (after a choice, or for news). */
  outcome?: string;
}

/** "You'll start one of the next two": checked after every match until kept or broken. */
export interface PlayerPromise {
  id: string;
  playerId: string;
  starts: number;
  /** Starts so far since the promise. */
  got: number;
  /** Last match number by which it must be kept. */
  byMatch: number;
}

export interface DressingRoom {
  /** Newest first. */
  events: ClubEvent[];
  promises: PlayerPromise[];
  /** Players excused until (and including) a match number. */
  away: { playerId: string; untilMatch: number; reason: string }[];
  lastEventMatch: number;
  /** Players whose dream you said you'd help make happen. */
  backed: string[];
}

export interface SeasonSummary {
  season: number;
  division: number;
  divisionName: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  outcome: 'promoted' | 'relegated' | 'champions' | 'stayed';
  prizeCoins: number;
  /** How far the club went in the County Cup (round index reached; won = lifted it). */
  cup?: { reached: number; won: boolean };
  topScorer?: { name: string; goals: number };
}

export interface PendingUpgrade {
  playerId: string;
  level: number;
  options: string[];
}

export interface ClubSave {
  schemaVersion: typeof SCHEMA_VERSION;
  saveId: string;
  careerSeed: string;
  contentVersion: string;
  engineVersion: string;
  createdAt: string;
  updatedAt: string;
  club: ClubIdentity & { stadiumLevel: number; reputation: number };
  coins: number;
  clubXp: number;
  squadIds: string[];
  formationId: FormationId;
  /** slot id -> player id */
  lineup: Record<string, string>;
  footballers: Record<string, Footballer>;
  /** The selectable emotional-anchor player highlighted from day one. */
  anchorPlayerId: string;
  /** Earned scout packs, opened and unopened (oldest first). */
  packs: OwnedPack[];
  /** Scout recruits since the last Breakout-or-better (pity counter; guaranteed at 10). */
  guaranteedRecruitProgress: number;
  /** Idempotency journal: every reward/claim id ever applied. */
  rewardClaimIds: string[];
  /** Monotonic counter for deriving new deterministic seeds (signings, history ids). */
  nextSeq: number;
  season: number;
  onboarding: OnboardingStep;
  tipsSeen: TipId[];
  /** Manager cards unlocked by manager level (unlock-only: no upgrades). */
  cardsUnlocked: CardId[];
  /** Cards taken into matches, in draw order (3–5). */
  deck: CardId[];
  /** Unlocked cards the player has not looked at yet. */
  newCards: CardId[];
  league: LeagueState;
  dressingRoom: DressingRoom;
  /** Wears the armband (null = nobody yet). */
  captainId: string | null;
  /** Takes the penalties (null = the best taker on the pitch). */
  penaltyTakerId: string | null;
  /** This season's County Cup (null for a season that started before the cup existed). */
  cup: CupState | null;
  /** Finished seasons, oldest first. */
  seasons: SeasonSummary[];
  /** Completed matches (also the index of the next fixture). */
  matchNumber: number;
  pendingMatch: PendingMatch | null;
  /** Most recent first, capped. */
  matchRecords: MatchRecord[];
  pendingUpgrades: PendingUpgrade[];
}

export const MAX_MATCH_RECORDS = 30;
