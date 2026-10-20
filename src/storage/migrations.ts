import { SCHEMA_VERSION, type ClubSave } from '../domain/save/types';
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
 * (None yet — v1 is the first shipped schema. M1 adds fixtures/match records as v2.)
 */
const MIGRATIONS: Record<number, (raw: RawSave) => RawSave> = {};

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
