import { SCHEMA_VERSION, type ClubSave } from '../domain/save/types';
import { classicWorld } from '../domain/world/world';
import { emptyTransfers } from '../domain/transfers/market';
import { emptyDressingRoom } from '../domain/club/dressingRoom';
import { cardsUnlockedAt, managerLevel } from '../domain/club/manager';
import { newLeague } from '../domain/league/league';
import { DEFAULT_DECK } from '../game/simulation/cards';
import { clubSaveSchema } from './schema';

export class SaveFormatError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'SaveFormatError';
  }
}

type RawSave = Record<string, unknown> & { schemaVersion?: unknown };

/**
 * Ordered save-document migrations: MIGRATIONS[n] upgrades a version-n document to n+1.
 * Each step must be pure and must not drop player identity fields.
 */
const MIGRATIONS: Record<number, (raw: RawSave) => RawSave> = {
  // v1 → v2 (M1): matches, records and level-up choices. Existing players are untouched.
  1: (raw) => ({
    ...raw,
    contentVersion: 'content-2',
    matchNumber: 0,
    pendingMatch: null,
    matchRecords: [],
    pendingUpgrades: [],
  }),
  // v2 → v3 (M2): real scout packs and the guided first run. Existing careers have already
  // been "onboarded", so they skip the tutorial and its coach marks.
  2: (raw) => {
    const { packInventory: _inv, tutorialStep: _step, ...rest } = raw;
    return { ...rest, contentVersion: 'content-3', packs: [], onboarding: 'done', tipsSeen: ['tactic', 'upgrade', 'next-match'] };
  },
  // v3 → v4: manager cards. Unlocks follow the club XP already earned; level-1 cards form the deck.
  3: (raw) => {
    const level = managerLevel(typeof raw.clubXp === 'number' ? raw.clubXp : 0);
    const unlocked = cardsUnlockedAt(level);
    return { ...raw, contentVersion: 'content-4', cardsUnlocked: unlocked, deck: [...DEFAULT_DECK], newCards: unlocked.filter((c) => !DEFAULT_DECK.includes(c)) };
  },
  // v4 → v5: the league. Existing careers start a fresh Division Two season from their current
  // season number (earlier friendlies stay in the match history).
  4: (raw) => {
    const seed = typeof raw.careerSeed === 'string' ? raw.careerSeed : 'career';
    const season = typeof raw.season === 'number' ? raw.season : 1;
    return { ...raw, contentVersion: 'content-5', league: newLeague(seed, classicWorld(), season, 0), seasons: [] };
  },
  // v5 → v6: the County Cup. A season already under way has no cup; it starts next season.
  5: (raw) => ({ ...raw, contentVersion: 'content-6', cup: null }),
  // v6 → v7: the dressing room. Morale already exists on every footballer; it starts empty.
  6: (raw) => ({ ...raw, contentVersion: 'content-7', dressingRoom: emptyDressingRoom() }),
  // v7 → v8: captaincy, penalty duty, dreams backed. Nobody wears the armband yet.
  7: (raw) => {
    const room = (raw.dressingRoom ?? emptyDressingRoom()) as Record<string, unknown>;
    return { ...raw, contentVersion: 'content-8', captainId: null, penaltyTakerId: null, dressingRoom: { ...room, backed: Array.isArray(room.backed) ? room.backed : [] } };
  },
  // v8 → v9: generated worlds. An existing career keeps the clubs it has been playing against.
  8: (raw) => ({ ...raw, contentVersion: 'content-9', world: classicWorld(), injuries: [], transfers: emptyTransfers() }),
  // v9 → v10: rivalries. Nobody has a nemesis yet; nobody sold has turned up anywhere yet.
  9: (raw) => {
    const world = (raw.world ?? {}) as Record<string, unknown>;
    return { ...raw, contentVersion: 'content-10', foes: [], world: { ...world, arrivals: Array.isArray(world.arrivals) ? world.arrivals : [] } };
  },
};

export function migrateSave(input: unknown): ClubSave {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SaveFormatError('This file does not contain a TOUCHLINE! save.');
  }
  let raw = input as RawSave;
  const declared = raw.schemaVersion;
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1) {
    throw new SaveFormatError('This save has no valid version number.');
  }
  let version: number = declared;
  if (version > SCHEMA_VERSION) {
    throw new SaveFormatError('This save was made by a newer version of TOUCHLINE!. Update the game, then try again.');
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveFormatError(`No upgrade path from save version ${version}.`);
    raw = step(raw);
    version = version + 1;
    raw.schemaVersion = version;
  }
  const parsed = clubSaveSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new SaveFormatError('This save is damaged or incomplete.', first ? `${first.path.join('.')}: ${first.message}` : undefined);
  }
  return parsed.data as ClubSave;
}
