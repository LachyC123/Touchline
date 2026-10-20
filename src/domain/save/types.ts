import type { ClubIdentity } from '../club/types';
import type { FormationId } from '../formations';
import type { Footballer } from '../players/types';
import type { MatchCommand, TeamLineup, TeamSide } from '../../game/simulation/types';

export const SCHEMA_VERSION = 2;
export const CONTENT_VERSION = 'content-2';
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
}

export interface ScorerLine {
  playerId: string;
  name: string;
  side: TeamSide;
  minute: number;
  /** Engine tick of the goal, for replays. */
  tick: number;
  assistName?: string;
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
  storyHeadline: string;
  /** Frozen lineups so the match can be re-simulated exactly (kept for recent matches only). */
  replay?: { home: TeamLineup; away: TeamLineup };
}

/** How many recent records keep their replay lineups (bounds save size). */
export const REPLAYS_KEPT = 5;

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
  packInventory: Record<string, number>;
  guaranteedRecruitProgress: number;
  /** Idempotency journal: every reward/claim id ever applied. */
  rewardClaimIds: string[];
  /** Monotonic counter for deriving new deterministic seeds (signings, history ids). */
  nextSeq: number;
  season: number;
  tutorialStep: string;
  /** Completed matches (also the index of the next fixture). */
  matchNumber: number;
  pendingMatch: PendingMatch | null;
  /** Most recent first, capped. */
  matchRecords: MatchRecord[];
  pendingUpgrades: PendingUpgrade[];
}

export const MAX_MATCH_RECORDS = 30;
