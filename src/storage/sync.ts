import { useSyncExternalStore } from 'react';
import type { ClubSave } from '../domain/save/types';
import { getDb, type TouchlineDB } from './db';
import { clearLocalMirror, connectCloud, deleteCloud, newest, readCloud, readLocalMirror, writeCloud, writeLocalMirror } from './mirror';
import { loadSave, replaceSave } from './saveRepo';

/**
 * Keeps the extra save copies up to date and tells the UI where the club is saved. IndexedDB
 * writes happen first (inside mutateSave); this follows each new save: the local mirror right
 * away, the cloud copy after a short pause (and immediately when the page is hidden).
 */

/** off: not in claude.ai · connecting · ready: connected, nothing written yet · on: a copy is saved. */
export type CloudState = 'off' | 'connecting' | 'ready' | 'on' | 'error';

export interface SyncStatus {
  /** updatedAt of the last save the copies have caught up with. */
  savedAt: string | null;
  mirror: boolean;
  cloud: CloudState;
  cloudAt: string | null;
  /** A newer save found in the cloud after start-up (another device). */
  newerInCloud: ClubSave | null;
  /** Bumps on every completed save, for the "Saved" pulse. */
  pulse: number;
}

let status: SyncStatus = { savedAt: null, mirror: false, cloud: 'off', cloudAt: null, newerInCloud: null, pulse: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const l of listeners) l();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export function getSyncStatus(): SyncStatus {
  return status;
}

let pending: ClubSave | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let writing: Promise<void> | null = null;
const CLOUD_DELAY = 1500;
/** Mid-match checkpoints arrive every few seconds; the cloud copy keeps to this pace. */
const CLOUD_MIN_GAP = 15_000;
let lastCloudWrite = 0;

async function pushCloud(): Promise<void> {
  if (writing) {
    await writing;
    if (!pending) return;
  }
  const save = pending;
  if (!save) return;
  pending = null;
  const cloud = await connectCloud();
  if (!cloud) {
    set({ cloud: 'off' });
    return;
  }
  lastCloudWrite = Date.now();
  writing = writeCloud(cloud, save)
    .then(() => set({ cloud: 'on', cloudAt: save.updatedAt }))
    .catch(() => set({ cloud: 'error' }))
    .finally(() => {
      writing = null;
    });
  await writing;
  if (pending) await pushCloud();
}

/** Called with every new save the game reads back from IndexedDB. */
export function noteSaved(save: ClubSave): void {
  if (status.savedAt === save.updatedAt) return;
  // The first save seen in a session is the one just loaded, and mid-match checkpoints are
  // routine: copy them, but only announce saves the player made happen.
  const announce = status.savedAt !== null && !save.pendingMatch;
  void writeLocalMirror(save).then((ok) => set({ savedAt: save.updatedAt, mirror: ok, pulse: announce ? status.pulse + 1 : status.pulse }));
  pending = save;
  if (timer) clearTimeout(timer);
  timer = setTimeout(
    () => {
      timer = null;
      void pushCloud();
    },
    Math.max(CLOUD_DELAY, lastCloudWrite + CLOUD_MIN_GAP - Date.now()),
  );
}

/** Pushes any waiting cloud write now (the page is being hidden or closed). */
export function flushSaves(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) void pushCloud();
}

/** The career was reset on purpose: drop the copies so it can't come back. */
export async function forgetCopies(): Promise<void> {
  pending = null;
  clearLocalMirror();
  const cloud = await connectCloud();
  if (cloud) await deleteCloud(cloud).catch(() => undefined);
  set({ savedAt: null, cloudAt: null, newerInCloud: null });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([p, new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), ms))]);
}

/**
 * Start-up: puts the newest valid copy into IndexedDB (or the in-memory stand-in). Waits a
 * moment for the cloud copy inside claude.ai; one that arrives later and is newer is offered
 * instead of silently replacing what is on screen.
 */
export async function restoreNewestCopy(db: TouchlineDB = getDb(), cloudWaitMs = 4000): Promise<'local' | 'mirror' | 'cloud' | 'none'> {
  let local: ClubSave | undefined;
  try {
    local = await loadSave(db);
  } catch {
    local = undefined;
  }
  const mirror = await readLocalMirror();
  let source: 'local' | 'mirror' | 'cloud' | 'none' = local ? 'local' : 'none';
  let best = newest(local, mirror);
  if (best && best !== local) {
    await replaceSave(best, db);
    source = 'mirror';
  }
  if ((globalThis as { claude?: unknown }).claude) {
    set({ cloud: 'connecting' });
    const fetchCloud = connectCloud().then((c) => (c ? readCloud(c) : null));
    const early = await withTimeout(fetchCloud, cloudWaitMs);
    const decide = async (cloud: ClubSave | null, late: boolean) => {
      const c = await connectCloud();
      set({ cloud: !c ? 'off' : cloud ? 'on' : 'ready', cloudAt: cloud?.updatedAt ?? status.cloudAt });
      if (!cloud || (best && cloud.updatedAt <= best.updatedAt)) return;
      if (late && best) set({ newerInCloud: cloud });
      else {
        await replaceSave(cloud, db);
        best = cloud;
        source = 'cloud';
      }
    };
    if (early === 'timeout') void fetchCloud.then((c) => decide(c, true));
    else await decide(early, false);
  }
  return source;
}

/** Loads the newer cloud save the player was offered. */
export async function acceptNewerCloud(db: TouchlineDB = getDb()): Promise<void> {
  const save = status.newerInCloud;
  if (!save) return;
  await replaceSave(save, db);
  set({ newerInCloud: null });
}

export function dismissNewerCloud(): void {
  set({ newerInCloud: null });
}

/** Asks the browser not to evict the game's storage (no prompt in most browsers). */
export async function askPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
