import type { ClubIdentity } from '../club/types';
import type { FormationId } from '../formations';
import type { Footballer, Tier } from '../players/types';
import type { MatchCommand, TeamLineup, TeamSide } from '../../game/simulation/types';

export const SCHEMA_VERSION = 3;
export const CONTENT_VERSION = 'content-3';
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
  /** Scout pack earned by this match, if any. */
  packId?: string;
  storyHeadline: string;
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
  /** Completed matches (also the index of the next fixture). */
  matchNumber: number;
  pendingMatch: PendingMatch | null;
  /** Most recent first, capped. */
  matchRecords: MatchRecord[];
  pendingUpgrades: PendingUpgrade[];
}

export const MAX_MATCH_RECORDS = 30;
