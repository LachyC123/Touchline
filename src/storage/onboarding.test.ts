import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { advanceOnboarding, applyClubIdentity, clubNameProblem, colourDistance, KIT_CLASH_DISTANCE, KIT_PRESETS, shortNameFor } from '../domain/club/onboarding';
import { createCareer } from '../domain/club/newCareer';
import { resolveKitClash, settleMatch, XP } from '../domain/match/settle';
import { bestSlotFor, grantPack, matchesUntilScoutPack, openPackDraft, PITY_AT, unopenedPacks, weakestStarter } from '../domain/packs/packs';
import { overallAt } from '../domain/players/rating';
import { prepareMatch } from '../domain/match/settle';
import { replayMatch } from '../game/simulation/replay';
import { matchArgs } from '../domain/match/settle';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { assignPlayer, kickOff, loadSave, mutateSave, onboardingEvent, openPack, restartStaleMatch, setClubIdentity, settleMatchOnce, startNewCareer } from './saveRepo';
import { ENGINE_VERSION } from '../game/simulation/constants';

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  db = new TouchlineDB(`onb-${n++}`);
  setDbForTests(db);
  await db.open();
});
afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('first-signing pack', () => {
  it('is granted with the new career, its recruit committed before any reveal', () => {
    const a = createCareer('onb-seed', 'x');
    const b = createCareer('onb-seed', 'y');
    expect(a.packs).toHaveLength(1);
    const pack = a.packs[0]!;
    expect(pack.kind).toBe('first-signing');
    expect(pack.recruit).not.toBeNull();
    expect(pack.playerId).toBeNull();
    // Same career seed => same recruit, down to the face.
    expect(b.packs[0]!.recruit).toEqual(pack.recruit);
    expect(a.onboarding).toBe('intro');
    expect(() => migrateSave(a)).not.toThrow();
  });

  it('is a genuine positional improvement for the starting seven, across many careers', () => {
    for (let i = 0; i < 60; i++) {
      const save = createCareer(`improve-${i}`, 'x');
      const recruit = save.packs[0]!.recruit!;
      const weakest = weakestStarter(save)!;
      expect(recruit.primaryPosition).toBe(weakest.position);
      expect(overallAt(recruit, weakest.position)).toBeGreaterThan(weakest.rating);
      expect(recruit.tier).toBe('prospect');
      expect(Object.values(save.footballers).map((f) => f.lastName)).not.toContain(recruit.lastName);
      openPackDraft(save, save.packs[0]!.id);
      expect(bestSlotFor(save, recruit)?.gain ?? 0).toBeGreaterThan(0);
    }
  });

  it('opens exactly once, even with concurrent taps, and survives a reload', async () => {
    const save = await startNewCareer('open-once', db);
    const packId = save.packs[0]!.id;
    const committed = save.packs[0]!.recruit!;
    const [x, y] = await Promise.all([openPack(packId, db), openPack(packId, db)]);
    expect([x.applied, y.applied].sort()).toEqual([false, true]);
    expect(x.playerId).toBe(committed.id);
    expect(y.playerId).toBe(committed.id);
    const after = (await loadSave(db))!;
    expect(after.squadIds).toHaveLength(11);
    expect(after.squadIds.filter((id) => id === committed.id)).toHaveLength(1);
    expect(after.footballers[committed.id]!.appearance).toEqual(committed.appearance);
    expect(after.footballers[committed.id]!.history.at(-1)!.kind).toBe('signed');
    expect(unopenedPacks(after)).toHaveLength(0);
    expect(after.onboarding).toBe('intro'); // the pack step was not reached yet; nothing skips ahead
  });
});

describe('onboarding flow', () => {
  it('only advances from the matching step', () => {
    expect(advanceOnboarding('intro', 'introDone')).toBe('pack');
    expect(advanceOnboarding('intro', 'packOpened')).toBe('intro');
    expect(advanceOnboarding('pack', 'packOpened')).toBe('lineup');
    expect(advanceOnboarding('lineup', 'recruitPlaced')).toBe('match');
    expect(advanceOnboarding('match', 'firstMatchSettled')).toBe('club');
    expect(advanceOnboarding('club', 'clubNamed')).toBe('done');
    expect(advanceOnboarding('done', 'introDone')).toBe('done');
    expect(advanceOnboarding('lineup', 'skip')).toBe('done');
  });

  it('runs new save → pack → lineup → first match (debut level-up) → club identity → done, persisted', async () => {
    const save = await startNewCareer('full-run', db);
    await onboardingEvent('introDone', db);
    const { playerId } = await openPack(save.packs[0]!.id, db);
    let s = (await loadSave(db))!;
    expect(s.onboarding).toBe('lineup');
    const slot = bestSlotFor(s, s.footballers[playerId]!)!;
    await assignPlayer(slot.slotId, playerId, db);
    s = (await loadSave(db))!;
    expect(s.onboarding).toBe('match');
    expect(s.lineup[slot.slotId]).toBe(playerId);

    const pm = await kickOff(db);
    const { record } = await settleMatchOnce(pm.matchId, db);
    s = (await loadSave(db))!;
    expect(s.onboarding).toBe('club');
    // The recruit's debut always earns a level: a first training choice is waiting.
    expect(s.pendingUpgrades.some((u) => u.playerId === playerId)).toBe(true);
    expect(record.gains.find((g) => g.playerId === playerId)!.xp).toBeGreaterThanOrEqual(XP.match + XP.recruitDebut);
    expect(record.rewards.lines.some((l) => l.label.includes('debut'))).toBe(true);

    await setClubIdentity({ name: 'Harbour Lights', presetId: 'sky', pattern: 'hoops' }, db);
    s = (await loadSave(db))!;
    expect(s.onboarding).toBe('done');
    expect(s.club.name).toBe('Harbour Lights');
    expect(s.club.shortName).toBe('HAR');
    expect(s.club.kit.pattern).toBe('hoops');
  });

  it('skipping keeps the unopened first pack for later', async () => {
    await startNewCareer('skipper', db);
    await onboardingEvent('skip', db);
    const s = (await loadSave(db))!;
    expect(s.onboarding).toBe('done');
    expect(unopenedPacks(s)).toHaveLength(1);
  });
});

describe('scout packs from matches', () => {
  it('every third match grants exactly one Local Scout pack, with a pity guarantee', async () => {
    await startNewCareer('scout-run', db);
    await onboardingEvent('skip', db);
    for (let m = 1; m <= 6; m++) {
      const pm = await kickOff(db);
      const { record } = await settleMatchOnce(pm.matchId, db);
      await settleMatchOnce(pm.matchId, db).catch(() => undefined); // a repeat never grants again
      expect(Boolean(record.packId)).toBe(m % 3 === 0);
    }
    const s = (await loadSave(db))!;
    expect(s.packs.filter((p) => p.kind === 'local-scout')).toHaveLength(2);
    expect(matchesUntilScoutPack(s.matchNumber)).toBe(3);
  });

  it('guarantees Breakout or better on the 10th scout recruit without one', () => {
    const save = createCareer('pity', 'x');
    let streak = 0;
    for (let i = 0; i < 40; i++) {
      const pack = grantPack(save, 'local-scout', `test:${i}`);
      const strong = pack.tier === 'breakout' || pack.tier === 'star' || pack.tier === 'phenomenon';
      streak = strong ? 0 : streak + 1;
      expect(streak).toBeLessThan(PITY_AT);
      expect(save.guaranteedRecruitProgress).toBe(streak);
    }
  });
});

describe('club identity', () => {
  it('validates names and derives a scoreboard code', () => {
    expect(clubNameProblem('ab')).toMatch(/at least/);
    expect(clubNameProblem('x'.repeat(30))).toMatch(/Keep it/);
    expect(clubNameProblem('<script>')).toMatch(/only/);
    expect(clubNameProblem('  Port  Vale  Rovers ')).toBeNull();
    expect(shortNameFor('Harbour Lights')).toBe('HAR');
    expect(shortNameFor('Old Mill Saint Albans')).toBe('OMS');
    expect(shortNameFor('Rovers')).toBe('ROV');
    const club = createCareer('id', 'x').club;
    expect(() => applyClubIdentity(club, { name: 'ok club', presetId: 'nope', pattern: 'plain' })).toThrow();
  });

  it('every preset reads against the pitch and the away side changes kit on a clash', () => {
    for (const p of KIT_PRESETS) expect(colourDistance(p.primary, '#1E8D70')).toBeGreaterThan(KIT_CLASH_DISTANCE);
    const home = { primary: '#E2563B', secondary: '#FFF7E9', pattern: 'plain' as const };
    const away = resolveKitClash(home, { primary: '#E0503A', secondary: '#1B2235', pattern: 'stripes' as const });
    expect(colourDistance(home.primary, away.primary)).toBeGreaterThanOrEqual(KIT_CLASH_DISTANCE);
    const fine = { primary: '#2F5FD0', secondary: '#FFF7E9', pattern: 'plain' as const };
    expect(resolveKitClash(home, fine)).toBe(fine);
  });
});

describe('migration v2 → v3', () => {
  it('keeps players and marks existing careers as onboarded', () => {
    const v3 = createCareer('mig', 'x');
    const { packs: _p, onboarding: _o, tipsSeen: _t, cardsUnlocked: _c, deck: _d, newCards: _n, ...rest } = v3;
    const v2 = { ...rest, schemaVersion: 2, contentVersion: 'content-2', packInventory: {}, tutorialStep: 'start' };
    const migrated = migrateSave(v2);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.onboarding).toBe('done');
    expect(migrated.packs).toEqual([]);
    expect(migrated.footballers).toEqual(v3.footballers);
    expect('packInventory' in migrated).toBe(false);
  });
});

describe('settlement still pays once with packs in play', () => {
  it('a settled match replays to the same record', async () => {
    const save = await startNewCareer('replay-pack', db);
    await mutateSave((s) => void s, {}, db);
    const pm = await kickOff(db);
    const direct = settleMatch(structuredClone((await loadSave(db))!), pm, replayMatch(matchArgs(pm), []));
    const { record } = await settleMatchOnce(pm.matchId, db);
    expect(record.score).toEqual(direct.score);
    expect(prepareMatch(save).seed).toBe(pm.seed);
  });
});

describe('engine upgrades', () => {
  it('a match paused on an older engine restarts from kick-off instead of replaying differently', async () => {
    await startNewCareer('stale', db);
    await onboardingEvent('skip', db);
    const pm = await kickOff(db);
    await mutateSave((s) => {
      s.pendingMatch!.engineVersion = 'engine-1';
      s.pendingMatch!.checkpointTick = 300;
    }, {}, db);
    await expect(settleMatchOnce(pm.matchId, db)).rejects.toThrow(/older version/);
    await restartStaleMatch(db);
    const s = (await loadSave(db))!;
    expect(s.pendingMatch!.engineVersion).toBe(ENGINE_VERSION);
    expect(s.pendingMatch!.checkpointTick).toBe(0);
    expect(s.pendingMatch!.seed).toBe(pm.seed);
    expect(s.coins).toBe(100);
  });
});
