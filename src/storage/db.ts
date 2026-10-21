import Dexie, { type EntityTable } from 'dexie';
import type { ClubSave } from '../domain/save/types';
import type { Settings } from './schema';

/** The single career slot key. Kept as a key (not a constant table) to allow more slots later. */
export const MAIN_SLOT = 'main';

export interface SaveRow {
  slot: string;
  save: ClubSave;
}

export interface BackupRow {
  id?: number;
  slot: string;
  reason: 'pre-import' | 'pre-migration' | 'pre-reset' | 'rolling';
  createdAt: string;
  /** Raw JSON (may be from an older schema version). */
  json: string;
}

export interface MetaRow {
  key: string;
  value: Settings;
}

export class TouchlineDB extends Dexie {
  saves!: EntityTable<SaveRow, 'slot'>;
  backups!: EntityTable<BackupRow, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'touchline', options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options);
    // Dexie schema v1. Bump with an explicit upgrade() when indexes change; save-document
    // migrations (ClubSave.schemaVersion) are handled separately in migrations.ts.
    this.version(1).stores({
      saves: 'slot',
      backups: '++id, slot, createdAt',
      meta: 'key',
    });
  }
}

let instance: TouchlineDB | null = null;

export function getDb(): TouchlineDB {
  if (!instance) instance = new TouchlineDB();
  return instance;
}

/** Tests use isolated databases; the in-memory fallback swaps in a non-persistent one. */
export function setDbForTests(db: TouchlineDB | null): void {
  instance = db;
}

let memoryOnly = false;

export function isMemoryOnly(): boolean {
  return memoryOnly;
}

/**
 * When the browser refuses IndexedDB (private mode, blocked site data, some embedded
 * previews) the game still runs on an in-memory database. Progress lasts until the page closes.
 */
export async function switchToMemoryDb(): Promise<TouchlineDB> {
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
  const factory = new IDBFactory();
  // Dexie's live queries stay silent when the browser has no IndexedDB of its own; point its
  // global dependencies at the stand-in too, or the game would never see its save.
  if (!Dexie.dependencies.indexedDB) {
    Dexie.dependencies.indexedDB = factory;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange as unknown as typeof Dexie.dependencies.IDBKeyRange;
  }
  const db = new TouchlineDB('touchline-memory', { indexedDB: factory, IDBKeyRange });
  await db.open();
  instance = db;
  memoryOnly = true;
  return db;
}

export const MAX_BACKUPS = 5;
