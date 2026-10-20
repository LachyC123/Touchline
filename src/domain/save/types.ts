import type { ClubIdentity } from '../club/types';
import type { Footballer, Position } from '../players/types';

export const SCHEMA_VERSION = 1;
export const CONTENT_VERSION = 'content-1';
export const ENGINE_VERSION = 'engine-0';

export type FormationId = '2-2-2';

export interface FormationSlot {
  id: string;
  position: Position;
}

export const FORMATIONS: Record<FormationId, readonly FormationSlot[]> = {
  '2-2-2': [
    { id: 'GK', position: 'GK' },
    { id: 'DEF_L', position: 'DEF' },
    { id: 'DEF_R', position: 'DEF' },
    { id: 'MID_L', position: 'MID' },
    { id: 'MID_R', position: 'MID' },
    { id: 'FWD_L', position: 'FWD' },
    { id: 'FWD_R', position: 'FWD' },
  ],
};

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
}
