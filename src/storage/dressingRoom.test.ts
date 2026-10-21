import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../domain/club/newCareer';
import { openEvent } from '../domain/club/dressingRoom';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { kickOff, loadSave, mutateSave, onboardingEvent, resolveEvent, settleMatchOnce, startNewCareer } from './saveRepo';

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  db = new TouchlineDB(`room-${n++}`);
  setDbForTests(db);
  await db.open();
});
afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('dressing room (persisted)', () => {
  it('after three matches someone wants a word; the answer applies exactly once', async () => {
    await startNewCareer('room-flow', db);
    await onboardingEvent('skip', db);
    for (let i = 0; i < 3; i++) {
      const pm = await kickOff(db);
      await settleMatchOnce(pm.matchId, db);
    }
    const s = (await loadSave(db))!;
    const e = openEvent(s)!;
    expect(e).toBeDefined();
    expect(['playingTime', 'flatSquad']).toContain(e.kind);
    // Morale moved for the squad, and the match record says how.
    expect(s.matchRecords[0]!.morale?.length).toBeGreaterThan(0);
    const choice = e.kind === 'playingTime' ? 'squadRole' : 'clearAir';
    const [a, b] = await Promise.all([resolveEvent(e.id, choice, db), resolveEvent(e.id, choice, db)]);
    expect([a.applied, b.applied].sort()).toEqual([false, true]);
    expect(a.outcome).toBe(b.outcome);
    const after = (await loadSave(db))!;
    expect(after.dressingRoom.events.find((x) => x.id === e.id)?.status).toBe('resolved');
    expect(after.rewardClaimIds.filter((c) => c === `event:${e.id}`)).toHaveLength(1);
  });

  it('a player given days off cannot start the next match', async () => {
    const save = await startNewCareer('room-away', db);
    await onboardingEvent('skip', db);
    const id = save.lineup.MID_L!;
    await mutateSave((s) => {
      s.dressingRoom.away.push({ playerId: id, untilMatch: s.matchNumber + 1, reason: 'Home in town' });
    }, {}, db);
    await expect(kickOff(db)).rejects.toThrow(/is away/);
  });

  it('a v6 save gains an empty dressing room and keeps its players’ morale', () => {
    const v7 = createCareer('room-mig', 'x');
    const { dressingRoom: _d, ...rest } = v7;
    const m = migrateSave({ ...rest, schemaVersion: 6, contentVersion: 'content-6' });
    expect(m.schemaVersion).toBe(7);
    expect(m.dressingRoom).toEqual({ events: [], promises: [], away: [], lastEventMatch: 0 });
    expect(m.footballers[m.anchorPlayerId]!.morale).toBe(v7.footballers[v7.anchorPlayerId]!.morale);
  });
});
