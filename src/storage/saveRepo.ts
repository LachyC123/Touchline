import { createCareer } from '../domain/club/newCareer';
import type { ClubSave } from '../domain/save/types';
import { getDb, MAIN_SLOT, MAX_BACKUPS, type BackupRow, type TouchlineDB } from './db';
import { migrateSave } from './migrations';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from './schema';
import { serialiseSave } from './exportImport';

const nowIso = () => new Date().toISOString();

export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Browser storage is unavailable. Private browsing or blocked site data can prevent saving.');
    this.name = 'StorageUnavailableError';
    this.cause = cause;
  }
}

/** Opens IndexedDB, surfacing private-mode / blocked-storage failures as a typed error. */
export async function openStorage(db: TouchlineDB = getDb()): Promise<TouchlineDB> {
  try {
    if (!db.isOpen()) await db.open();
    return db;
  } catch (err) {
    throw new StorageUnavailableError(err);
  }
}

export async function loadSave(db: TouchlineDB = getDb()): Promise<ClubSave | undefined> {
  const row = await db.saves.get(MAIN_SLOT);
  if (!row) return undefined;
  return migrateSave(row.save);
}

async function pushBackup(db: TouchlineDB, reason: BackupRow['reason'], save: unknown): Promise<void> {
  await db.backups.add({ slot: MAIN_SLOT, reason, createdAt: nowIso(), json: JSON.stringify(save) });
  const count = await db.backups.count();
  if (count > MAX_BACKUPS) {
    const oldest = await db.backups.orderBy('id').limit(count - MAX_BACKUPS).primaryKeys();
    await db.backups.bulkDelete(oldest);
  }
}

export async function startNewCareer(careerSeed: string, db: TouchlineDB = getDb()): Promise<ClubSave> {
  const save = createCareer(careerSeed, nowIso());
  const validated = migrateSave(save);
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-reset', existing.save);
    await db.saves.put({ slot: MAIN_SLOT, save: validated });
  });
  return validated;
}

export interface MutationResult {
  applied: boolean;
  save: ClubSave;
}

/**
 * The only way game state changes. Runs read → mutate (on a clone) → validate → write inside
 * one IndexedDB transaction, so a crash or double tap can never leave half-applied state.
 * With `claimId`, the mutation is applied at most once per career (idempotency key).
 */
export async function mutateSave(
  mutate: (draft: ClubSave) => void,
  opts: { claimId?: string } = {},
  db: TouchlineDB = getDb(),
): Promise<MutationResult> {
  return db.transaction('rw', db.saves, async () => {
    const row = await db.saves.get(MAIN_SLOT);
    if (!row) throw new Error('No career to update.');
    const current = migrateSave(row.save);
    if (opts.claimId && current.rewardClaimIds.includes(opts.claimId)) return { applied: false, save: current };
    const draft = structuredClone(current);
    mutate(draft);
    if (opts.claimId) draft.rewardClaimIds.push(opts.claimId);
    draft.updatedAt = nowIso();
    const next = migrateSave(draft); // validates invariants; throws (and aborts the tx) if broken
    await db.saves.put({ slot: MAIN_SLOT, save: next });
    return { applied: true, save: next };
  });
}

export function markInspected(playerId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const p = s.footballers[playerId];
    if (p) p.isNew = false;
  }, {}, db);
}

export function toggleFavourite(playerId: string, db?: TouchlineDB): Promise<MutationResult> {
  return mutateSave((s) => {
    const p = s.footballers[playerId];
    if (p) p.favourite = !p.favourite;
  }, {}, db);
}

export async function exportCurrentSave(db: TouchlineDB = getDb()): Promise<{ json: string; fileName: string }> {
  const save = await loadSave(db);
  if (!save) throw new Error('There is no career to export yet.');
  const stamp = nowIso();
  const json = await serialiseSave(save, stamp);
  const slug = save.club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { json, fileName: `touchline-${slug}-${stamp.slice(0, 10)}.json` };
}

/** Replaces the current career with an already-validated save, keeping a rolling backup. */
export async function replaceSave(save: ClubSave, db: TouchlineDB = getDb()): Promise<void> {
  const validated = migrateSave(save);
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-import', existing.save);
    await db.saves.put({ slot: MAIN_SLOT, save: validated });
  });
}

export async function deleteCareer(db: TouchlineDB = getDb()): Promise<void> {
  await db.transaction('rw', db.saves, db.backups, async () => {
    const existing = await db.saves.get(MAIN_SLOT);
    if (existing) await pushBackup(db, 'pre-reset', existing.save);
    await db.saves.delete(MAIN_SLOT);
  });
}

export async function listBackups(db: TouchlineDB = getDb()): Promise<BackupRow[]> {
  return db.backups.orderBy('id').reverse().toArray();
}

export async function restoreBackup(id: number, db: TouchlineDB = getDb()): Promise<ClubSave> {
  const row = await db.backups.get(id);
  if (!row) throw new Error('That backup no longer exists.');
  const save = migrateSave(JSON.parse(row.json));
  await db.saves.put({ slot: MAIN_SLOT, save });
  return save;
}

export async function loadSettings(db: TouchlineDB = getDb()): Promise<Settings> {
  const row = await db.meta.get('settings');
  const parsed = settingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings, db: TouchlineDB = getDb()): Promise<void> {
  await db.meta.put({ key: 'settings', value: settingsSchema.parse(settings) });
}
