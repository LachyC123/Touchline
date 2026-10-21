import type { ClubSave } from '../domain/save/types';
import { migrateSave } from './migrations';

/**
 * Extra copies of the save, so progress survives a browser that drops or blocks IndexedDB:
 * a compact mirror in localStorage, and — when the game runs inside claude.ai — a copy in the
 * viewer's own private artifact storage. IndexedDB stays the source of truth while it works;
 * on start the newest valid copy wins. Copies are gzip+base64 when the browser can compress.
 */

const MIRROR_KEY = 'touchline:mirror:v1';
const CHUNK = 150_000;

// ── Encoding ───────────────────────────────────────────────────────────────────────────────

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** "gz:<base64>" when the browser can compress, else "json:<json>". */
export async function encodeSave(save: ClubSave): Promise<string> {
  const json = JSON.stringify(save);
  if (typeof CompressionStream === 'undefined') return `json:${json}`;
  try {
    return `gz:${toBase64(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')))}`;
  } catch {
    return `json:${json}`;
  }
}

/** Decodes and validates (migrating older versions); throws on anything that isn't a good save. */
export async function decodeSave(text: string): Promise<ClubSave> {
  let json: string;
  if (text.startsWith('gz:')) json = new TextDecoder().decode(await pipe(fromBase64(text.slice(3)), new DecompressionStream('gzip')));
  else if (text.startsWith('json:')) json = text.slice(5);
  else throw new Error('Unknown save copy format.');
  return migrateSave(JSON.parse(json));
}

// ── localStorage mirror ────────────────────────────────────────────────────────────────────

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function writeLocalMirror(save: ClubSave): Promise<boolean> {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(MIRROR_KEY, await encodeSave(save));
    return true;
  } catch {
    return false;
  }
}

export async function readLocalMirror(): Promise<ClubSave | null> {
  try {
    const text = storage()?.getItem(MIRROR_KEY);
    return text ? await decodeSave(text) : null;
  } catch {
    return null;
  }
}

export function clearLocalMirror(): void {
  try {
    storage()?.removeItem(MIRROR_KEY);
  } catch {
    /* nothing to clear */
  }
}

// ── Cloud copy (claude.ai artifact storage, per viewer) ────────────────────────────────────

interface DocSnap {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
}
export interface CloudDb {
  doc(path: string): DocRef;
}
interface CloudUser {
  id(): Promise<string | null>;
}
interface ClaudeHost {
  use(name: 'db'): Promise<CloudDb | null>;
  use(name: 'user'): Promise<CloudUser | null>;
}

export interface Cloud {
  db: CloudDb;
  base: string;
}

let cloudPromise: Promise<Cloud | null> | null = null;

/** The viewer's private storage when running inside claude.ai (null anywhere else). */
export function connectCloud(): Promise<Cloud | null> {
  if (!cloudPromise) {
    cloudPromise = (async () => {
      const host = (globalThis as { claude?: ClaudeHost }).claude;
      if (!host || typeof host.use !== 'function') return null;
      try {
        const [db, user] = await Promise.all([host.use('db'), host.use('user')]);
        const id = user ? await user.id() : null;
        if (!db || !id) return null;
        return { db, base: `data/users/${id}` };
      } catch {
        return null;
      }
    })();
  }
  return cloudPromise;
}

/** Test hook: forget the cached connection. */
export function resetCloudForTests(): void {
  cloudPromise = null;
}

/**
 * Writes the save as chunk documents, then a manifest naming them. A reader trusts the copy
 * only when every chunk carries the manifest's stamp, so a write cut off half-way is ignored.
 */
export async function writeCloud(cloud: Cloud, save: ClubSave): Promise<void> {
  const text = await encodeSave(save);
  const stamp = `${save.saveId}:${save.updatedAt}`;
  const parts = Math.max(1, Math.ceil(text.length / CHUNK));
  for (let i = 0; i < parts; i++) await cloud.db.doc(`${cloud.base}/touchline-${i}`).set({ stamp, part: text.slice(i * CHUNK, (i + 1) * CHUNK) });
  await cloud.db.doc(`${cloud.base}/touchline`).set({ stamp, parts, updatedAt: save.updatedAt, saveId: save.saveId, club: save.club.name, matchNumber: save.matchNumber, season: save.season });
}

/** Marks the cloud copy as deleted (the career was reset), so it is never restored. */
export async function deleteCloud(cloud: Cloud): Promise<void> {
  await cloud.db.doc(`${cloud.base}/touchline`).set({ deleted: true, deletedAt: new Date().toISOString() });
}

export async function readCloud(cloud: Cloud): Promise<ClubSave | null> {
  try {
    const manifest = await cloud.db.doc(`${cloud.base}/touchline`).get();
    const m = manifest.data() as { stamp?: string; parts?: number; deleted?: boolean } | undefined;
    if (!manifest.exists || m?.deleted || !m?.stamp || !m.parts || m.parts > 50) return null;
    let text = '';
    for (let i = 0; i < m.parts; i++) {
      const c = (await cloud.db.doc(`${cloud.base}/touchline-${i}`).get()).data() as { stamp?: string; part?: string } | undefined;
      if (!c || c.stamp !== m.stamp || typeof c.part !== 'string') return null;
      text += c.part;
    }
    return await decodeSave(text);
  } catch {
    return null;
  }
}

// ── Choosing ───────────────────────────────────────────────────────────────────────────────

/** The newest of several copies (by last write). Ties keep the earlier (primary) one. */
export function newest(...copies: (ClubSave | null | undefined)[]): ClubSave | null {
  let best: ClubSave | null = null;
  for (const c of copies) if (c && (!best || c.updatedAt > best.updatedAt)) best = c;
  return best;
}
