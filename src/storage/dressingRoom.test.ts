import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCareer } from '../domain/club/newCareer';
import { openEvent } from '../domain/club/dressingRoom';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { buyGroundUpgrade, claimRoad, coverAbsencesInLineup, treatInjuryOnce, kickOff, loadSave, mutateSave, onboardingEvent, resolveEvent, settleMatchOnce, startNewCareer } from './saveRepo';

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
      // Knocks happen: injured starters are replaced, as the lobby offers.
      await coverAbsencesInLineup(db);
      const pm = await kickOff(db);
      await settleMatchOnce(pm.matchId, db);
    }
    const s = (await loadSave(db))!;
    const e = openEvent(s)!;
    expect(e).toBeDefined();
    expect(['playingTime', 'flatSquad', 'captaincy']).toContain(e.kind);
    // Morale moved for the squad, and the match record says how.
    expect(s.matchRecords[0]!.morale?.length).toBeGreaterThan(0);
    const choice = e.kind === 'playingTime' ? 'squadRole' : e.kind === 'captaincy' ? 'wait' : 'clearAir';
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
    const { dressingRoom: _d, captainId: _c, penaltyTakerId: _p, ...rest } = v7;
    const m = migrateSave({ ...rest, schemaVersion: 6, contentVersion: 'content-6' });
    expect(m.schemaVersion).toBe(9);
    expect(m.dressingRoom).toEqual({ events: [], promises: [], away: [], lastEventMatch: 0, backed: [] });
    expect(m.captainId).toBeNull();
    expect(m.footballers[m.anchorPlayerId]!.morale).toBe(v7.footballers[v7.anchorPlayerId]!.morale);
  });
});

describe('ground upgrades (persisted)', () => {
  it('a double tap buys the next level once; a blocked upgrade changes nothing', async () => {
    await startNewCareer('ground-flow', db);
    await expect(buyGroundUpgrade(db)).rejects.toThrow(/reputation/);
    await mutateSave((s) => {
      s.club.reputation = 20;
      s.coins = 1000;
    }, {}, db);
    const [a, b] = await Promise.all([buyGroundUpgrade(db), buyGroundUpgrade(db)]);
    expect([a.applied, b.applied].sort()).toEqual([false, true]);
    const after = (await loadSave(db))!;
    expect(after.club.stadiumLevel).toBe(2);
    expect(after.coins).toBe(400);
    expect(after.rewardClaimIds.filter((c) => c === 'ground:2')).toHaveLength(1);
    await expect(buyGroundUpgrade(db)).rejects.toThrow(/reputation/);
    expect((await loadSave(db))!.coins).toBe(400);
  });
});

describe('the physio (persisted)', () => {
  it('a double-tapped specialist is paid for once and the lineup knows when he is back', async () => {
    const save = await startNewCareer('physio-flow', db);
    const id = save.lineup.FWD_L!;
    await mutateSave((s) => {
      s.coins = 300;
      s.injuries = [{ id: '00000000-0000-4000-8000-0000000000bb', playerId: id, kind: 'ankle', matchId: 'm0', atMatch: 0, minute: 12, byName: 'A Defender', outFor: 2, untilMatch: 2, treatment: null }];
    }, {}, db);
    const [a, b] = await Promise.all([treatInjuryOnce('00000000-0000-4000-8000-0000000000bb', 'specialist', db), treatInjuryOnce('00000000-0000-4000-8000-0000000000bb', 'specialist', db)]);
    expect([a.applied, b.applied].sort()).toEqual([false, true]);
    const after = (await loadSave(db))!;
    expect(after.coins).toBe(300 - 80);
    expect(after.injuries[0]!.untilMatch).toBe(1);
    // Still out for the next match: kick-off refuses him until he is replaced.
    await expect(kickOff(db)).rejects.toThrow(/injured/);
  });
});

describe('reputation road (persisted)', () => {
  it('a double tap opens a step once', async () => {
    await startNewCareer('road-flow', db);
    await mutateSave((s) => {
      s.club.reputation = 12;
    }, {}, db);
    const coins = (await loadSave(db))!.coins;
    const [a, b] = await Promise.all([claimRoad(5, db), claimRoad(5, db)]);
    expect([a.applied, b.applied].sort()).toEqual([false, true]);
    expect((await loadSave(db))!.coins).toBe(coins + 100);
    const pack = await claimRoad(10, db);
    expect(pack.packId).toBeTruthy();
    expect((await loadSave(db))!.packs.some((p) => p.id === pack.packId && p.playerId === null)).toBe(true);
  });
});
