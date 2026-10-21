import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../domain/club/newCareer';
import { TouchlineDB, setDbForTests } from './db';
import { decodeSave, encodeSave, readCloud, readLocalMirror, resetCloudForTests, writeCloud, writeLocalMirror, type Cloud, type CloudDb } from './mirror';
import { loadSave, startNewCareer, mutateSave } from './saveRepo';
import { forgetCopies, getSyncStatus, restoreNewestCopy } from './sync';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

function fakeCloud(store = new Map<string, Record<string, unknown>>(), delayMs = 0): { cloud: Cloud; store: Map<string, Record<string, unknown>> } {
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  const db: CloudDb = {
    doc: (path) => ({
      get: async () => {
        await wait();
        const v = store.get(path);
        return { exists: v !== undefined, data: () => (v ? structuredClone(v) : undefined) };
      },
      set: async (d) => {
        store.set(path, structuredClone(d));
      },
    }),
  };
  return { cloud: { db, base: 'data/users/u1' }, store };
}

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  db = new TouchlineDB(`mirror-${n++}`);
  setDbForTests(db);
  await db.open();
  resetCloudForTests();
});
afterEach(async () => {
  delete (globalThis as { claude?: unknown }).claude;
  delete (globalThis as { localStorage?: unknown }).localStorage;
  setDbForTests(null);
  await db.delete();
});

describe('save copies', () => {
  it('encode → decode gives back the same save (compressed when the platform can)', async () => {
    const s = createCareer('copy-1', '2026-01-01T00:00:00.000Z');
    const text = await encodeSave(s);
    expect(text.startsWith('gz:') || text.startsWith('json:')).toBe(true);
    expect(text.length).toBeLessThan(JSON.stringify(s).length);
    expect(await decodeSave(text)).toEqual(s);
    await expect(decodeSave('gz:not-base64!!')).rejects.toThrow();
    await expect(decodeSave('json:{"nope":1}')).rejects.toThrow();
  });

  it('the cloud copy is trusted only when every chunk matches its manifest', async () => {
    const s = createCareer('copy-2', '2026-01-01T00:00:00.000Z');
    const { cloud, store } = fakeCloud();
    await writeCloud(cloud, s);
    expect(await readCloud(cloud)).toEqual(s);
    // A write cut off half-way: a chunk from a different save.
    store.set('data/users/u1/touchline-0', { stamp: 'other', part: store.get('data/users/u1/touchline-0')!.part as string });
    expect(await readCloud(cloud)).toBeNull();
  });

  it('start-up restores from the local mirror when the browser lost its main storage', async () => {
    const s = await startNewCareer('copy-3', db);
    await writeLocalMirror(s);
    await db.saves.clear();
    expect(await restoreNewestCopy(db, 50)).toBe('mirror');
    expect((await loadSave(db))?.saveId).toBe(s.saveId);
  });

  it('the newer of IndexedDB and the mirror wins; an older mirror never overwrites progress', async () => {
    const s = await startNewCareer('copy-4', db);
    await writeLocalMirror(s);
    await mutateSave((d) => {
      d.coins += 77;
    }, {}, db);
    expect(await restoreNewestCopy(db, 50)).toBe('local');
    expect((await loadSave(db))?.coins).toBe(s.coins + 77);
  });

  it('inside claude.ai a newer cloud save is restored at start-up, or offered if it arrives late', async () => {
    const s = await startNewCareer('copy-5', db);
    const later = structuredClone(s);
    later.coins += 500;
    later.updatedAt = '2999-01-01T00:00:00.000Z';
    const { cloud, store } = fakeCloud();
    await writeCloud(cloud, later);
    (globalThis as { claude?: unknown }).claude = { use: async (name: string) => (name === 'db' ? cloud.db : name === 'user' ? { id: async () => 'u1' } : null) };
    expect(await restoreNewestCopy(db, 2000)).toBe('cloud');
    expect((await loadSave(db))?.coins).toBe(s.coins + 500);

    // Same again, but the cloud answers after start-up: it is offered, not swapped in.
    resetCloudForTests();
    const slow = fakeCloud(store, 120);
    later.updatedAt = '3000-01-01T00:00:00.000Z';
    await writeCloud(slow.cloud, later);
    (globalThis as { claude?: unknown }).claude = { use: async (name: string) => (name === 'db' ? slow.cloud.db : name === 'user' ? { id: async () => 'u1' } : null) };
    expect(await restoreNewestCopy(db, 10)).not.toBe('cloud');
    await new Promise((r) => setTimeout(r, 600));
    expect(getSyncStatus().newerInCloud?.updatedAt).toBe('3000-01-01T00:00:00.000Z');
  });

  it('resetting a career forgets every copy, so it never comes back', async () => {
    const s = await startNewCareer('copy-6', db);
    await writeLocalMirror(s);
    const { cloud } = fakeCloud();
    await writeCloud(cloud, s);
    (globalThis as { claude?: unknown }).claude = { use: async (name: string) => (name === 'db' ? cloud.db : name === 'user' ? { id: async () => 'u1' } : null) };
    await db.saves.clear();
    await forgetCopies();
    expect(await readLocalMirror()).toBeNull();
    expect(await readCloud(cloud)).toBeNull();
    expect(await restoreNewestCopy(db, 50)).toBe('none');
    expect(await loadSave(db)).toBeUndefined();
  });
});
