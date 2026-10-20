import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../domain/club/newCareer';
import { overall } from '../domain/players/rating';
import { FORMATIONS } from '../domain/save/types';
import { TouchlineDB, setDbForTests } from './db';
import { parseSaveFile, serialiseSave, stableStringify } from './exportImport';
import { migrateSave, SaveFormatError } from './migrations';
import { deleteCareer, exportCurrentSave, listBackups, loadSave, loadSettings, mutateSave, replaceSave, restoreBackup, saveSettings, startNewCareer, toggleFavourite } from './saveRepo';

let db: TouchlineDB;
let n = 0;

beforeEach(async () => {
  db = new TouchlineDB(`test-${n++}`);
  setDbForTests(db);
  await db.open();
});

afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('new career', () => {
  it('creates a valid 10-player squad with 7 distinct starters in legal slots', () => {
    const save = createCareer('seed-abc', '2026-10-20T00:00:00.000Z');
    expect(save.squadIds).toHaveLength(10);
    const starters = Object.values(save.lineup);
    expect(starters).toHaveLength(7);
    expect(new Set(starters).size).toBe(7);
    for (const slot of FORMATIONS['2-2-2']) {
      const p = save.footballers[save.lineup[slot.id]!]!;
      expect(p.primaryPosition).toBe(slot.position);
    }
    for (const p of Object.values(save.footballers)) {
      expect(overall(p)).toBeGreaterThanOrEqual(42);
      expect(overall(p)).toBeLessThanOrEqual(61);
    }
    expect(save.footballers[save.anchorPlayerId]?.age).toBeLessThanOrEqual(20);
    expect(() => migrateSave(save)).not.toThrow();
  });

  it('never gives two founding players the same surname', () => {
    for (let i = 0; i < 200; i++) {
      const save = createCareer(`surnames-${i}`, 'x');
      const names = Object.values(save.footballers).map((p) => p.lastName);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('is deterministic for a career seed', () => {
    const a = createCareer('same', 'x');
    const b = createCareer('same', 'x');
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe('persistence', () => {
  it('round-trips a career through IndexedDB unchanged', async () => {
    const created = await startNewCareer('persist-1', db);
    const loaded = await loadSave(db);
    expect(loaded).toEqual(created);
  });

  it('applies validated mutations atomically and rejects invalid ones', async () => {
    const save = await startNewCareer('mut-1', db);
    const id = save.anchorPlayerId;
    await toggleFavourite(id, db);
    expect((await loadSave(db))!.footballers[id]!.favourite).toBe(true);

    await expect(
      mutateSave((s) => {
        s.coins = -50; // violates invariant
      }, {}, db),
    ).rejects.toThrow();
    expect((await loadSave(db))!.coins).toBe(save.coins);

    await expect(
      mutateSave((s) => {
        const [a, b] = Object.keys(s.lineup);
        s.lineup[b!] = s.lineup[a!]!; // same player in two slots
      }, {}, db),
    ).rejects.toThrow();
  });

  it('applies a claim at most once, even when fired concurrently', async () => {
    const save = await startNewCareer('claim-1', db);
    const grant = () => mutateSave((s) => void (s.coins += 120), { claimId: 'match-1:reward' }, db);
    const results = await Promise.all([grant(), grant(), grant()]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    const after = await loadSave(db);
    expect(after!.coins).toBe(save.coins + 120);
    expect(after!.rewardClaimIds.filter((c) => c === 'match-1:reward')).toHaveLength(1);
  });

  it('keeps a backup when a career is reset or replaced, and can restore it', async () => {
    const first = await startNewCareer('backup-1', db);
    await deleteCareer(db);
    expect(await loadSave(db)).toBeUndefined();
    const backups = await listBackups(db);
    expect(backups[0]?.reason).toBe('pre-reset');
    const restored = await restoreBackup(backups[0]!.id!, db);
    expect(restored.saveId).toBe(first.saveId);
  });

  it('stores settings with defaults when absent', async () => {
    const s = await loadSettings(db);
    expect(s.sfx).toBe(true);
    await saveSettings({ ...s, contrast: 'high' }, db);
    expect((await loadSettings(db)).contrast).toBe('high');
  });
});

describe('export / import', () => {
  it('exports and re-imports a save exactly', async () => {
    const save = await startNewCareer('export-1', db);
    await toggleFavourite(save.anchorPlayerId, db);
    const { json, fileName } = await exportCurrentSave(db);
    expect(fileName).toMatch(/^touchline-millbrook-town-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = await parseSaveFile(json);
    expect(parsed).toEqual(await loadSave(db));
    await deleteCareer(db);
    await replaceSave(parsed, db);
    expect((await loadSave(db))!.footballers[save.anchorPlayerId]!.favourite).toBe(true);
  });

  it('rejects tampered, foreign, malformed and future-version files with friendly errors', async () => {
    const save = createCareer('import-2', 'x');
    const json = await serialiseSave(save, 'now');
    const tampered = json.replace(`"coins": 100`, `"coins": 999999`);
    await expect(parseSaveFile(tampered)).rejects.toThrow(/checksum/);
    await expect(parseSaveFile('{nope')).rejects.toBeInstanceOf(SaveFormatError);
    await expect(parseSaveFile(JSON.stringify({ hello: 1 }))).rejects.toThrow(/not a TOUCHLINE/);
    expect(() => migrateSave({ ...save, schemaVersion: 99 })).toThrow(/newer version/);
    const broken = structuredClone(save) as unknown as Record<string, unknown>;
    delete broken.footballers;
    expect(() => migrateSave(broken)).toThrow(SaveFormatError);
  });
});
