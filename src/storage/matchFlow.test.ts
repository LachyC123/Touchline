import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignToSlot, changeFormation, LineupError, lineupProblems } from '../domain/club/lineup';
import { createCareer } from '../domain/club/newCareer';
import { opponentSquad } from '../domain/club/opponents';
import { CLUBS } from '../data/clubs';
import { matchArgs, matchMoments, prepareMatch, settleMatch, XP } from '../domain/match/settle';
import { xpToNext } from '../domain/players/progression';
import { overall } from '../domain/players/rating';
import { createMatch } from '../game/simulation/engine';
import { replayMatch, resultOf } from '../game/simulation/replay';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { assignPlayer, chooseUpgrade, kickOff, loadSave, mutateSave, recordCommand, setFormation, settleMatchOnce, startNewCareer } from './saveRepo';

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  db = new TouchlineDB(`flow-${n++}`);
  setDbForTests(db);
  await db.open();
});
afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('lineup rules', () => {
  const save = createCareer('lineup-1', 'x');
  const byPos = (pos: string) => save.squadIds.filter((id) => save.footballers[id]!.primaryPosition === pos);

  it('swaps two starters, or drops the replaced starter to the bench', () => {
    const [defL, defR] = [save.lineup.DEF_L!, save.lineup.DEF_R!];
    const swapped = assignToSlot(save.lineup, '2-2-2', 'DEF_L', defR, save.footballers);
    expect(swapped.DEF_L).toBe(defR);
    expect(swapped.DEF_R).toBe(defL);
    const benchDef = byPos('DEF').find((id) => !Object.values(save.lineup).includes(id))!;
    const replaced = assignToSlot(save.lineup, '2-2-2', 'DEF_L', benchDef, save.footballers);
    expect(replaced.DEF_L).toBe(benchDef);
    expect(Object.values(replaced)).not.toContain(defL);
    expect(lineupProblems(replaced, '2-2-2', save.footballers, save.squadIds)).toEqual([]);
  });

  it('enforces the goalkeeper slot both ways', () => {
    const gk = save.lineup.GK!;
    expect(() => assignToSlot(save.lineup, '2-2-2', 'MID_L', gk, save.footballers)).toThrow(LineupError);
    expect(() => assignToSlot(save.lineup, '2-2-2', 'GK', save.lineup.MID_L!, save.footballers)).toThrow(LineupError);
  });

  it('formation changes keep a valid seven, preferring the current starters', () => {
    const to321 = changeFormation(save.lineup, '3-2-1', save.footballers, save.squadIds);
    expect(lineupProblems(to321, '3-2-1', save.footballers, save.squadIds)).toEqual([]);
    expect(Object.keys(to321).sort()).toEqual(['DEF_C', 'DEF_L', 'DEF_R', 'FWD_C', 'GK', 'MID_L', 'MID_R']);
    const kept = Object.values(to321).filter((id) => Object.values(save.lineup).includes(id));
    expect(kept.length).toBeGreaterThanOrEqual(6);
  });

  it('rejects invalid lineups with a plain-language reason', () => {
    const broken = { ...save.lineup, MID_R: save.lineup.MID_L! };
    expect(lineupProblems(broken, '2-2-2', save.footballers, save.squadIds)).toContain('A player cannot start in two positions.');
  });
});

describe('save migration', () => {
  it('upgrades an M0 (v1) save all the way to the current version without touching players', () => {
    const v2 = createCareer('mig-1', 'x');
    const { matchNumber: _a, pendingMatch: _b, matchRecords: _c, pendingUpgrades: _d, packs: _e, onboarding: _f, tipsSeen: _g, cardsUnlocked: _h, deck: _i, newCards: _j, league: _k, seasons: _l, ...rest } = v2;
    const v1 = { ...rest, schemaVersion: 1, contentVersion: 'content-1', packInventory: {}, tutorialStep: 'start' };
    const migrated = migrateSave(v1);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.deck).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS']);
    expect(migrated.matchNumber).toBe(0);
    expect(migrated.pendingMatch).toBeNull();
    expect(migrated.footballers).toEqual(v2.footballers);
  });
});

describe('opponents', () => {
  it('the same club fields the same named players every time, a little stronger each lap', () => {
    const a = opponentSquad('career-x', CLUBS[1]!, 0);
    const b = opponentSquad('career-x', CLUBS[1]!, 0);
    const lap2 = opponentSquad('career-x', CLUBS[1]!, 1);
    expect(a.map((p) => p.lastName)).toEqual(b.map((p) => p.lastName));
    expect(lap2.map((p) => p.lastName)).toEqual(a.map((p) => p.lastName));
    const avg = (xs: typeof a) => xs.reduce((s, p) => s + overall(p), 0) / xs.length;
    expect(avg(lap2)).toBeGreaterThan(avg(a));
  });
});

describe('match flow (persisted)', () => {
  it('a half-time substitution is saved, replayed at settlement, and counts as an appearance', async () => {
    const save = await startNewCareer('flow-sub', db);
    const pm = await kickOff(db);
    expect(pm.home.bench ?? pm.away.bench).toBeDefined();
    const ours = pm.userSide === 'home' ? pm.home : pm.away;
    expect(ours.bench!.length).toBeGreaterThanOrEqual(3);
    const engine = createMatch(matchArgs(pm));
    while (engine.getSnapshot().phase !== 'halftime') engine.advanceTicks(1);
    const outId = ours.players.find((p) => p.role === 'MID')!.id;
    const inId = ours.bench!.find((p) => p.naturalPosition === 'MID')?.id ?? ours.bench![0]!.id;
    const r = engine.dispatchSub(pm.userSide, outId, inId);
    expect(r.ok).toBe(true);
    if (r.ok) {
      await recordCommand(pm.matchId, r.command, db);
      await recordCommand(pm.matchId, r.command, db); // a double tap records it once
    }
    engine.runToEnd();
    const live = resultOf(engine, matchArgs(pm));
    await settleMatchOnce(pm.matchId, db);
    const after = (await loadSave(db))!;
    const record = after.matchRecords[0]!;
    expect(record.commands.filter((c) => c.type === 'SUB')).toHaveLength(1);
    expect(record.score).toEqual(live.score);
    expect(record.moments?.some((m) => m.kind === 'sub' && m.text.includes('on for'))).toBe(true);
    expect(after.footballers[inId]!.stats.matches).toBe(save.footballers[inId]!.stats.matches + 1);
    expect(after.footballers[outId]!.stats.matches).toBe(save.footballers[outId]!.stats.matches + 1);
    expect(record.gains.find((g) => g.playerId === inId)?.rating).toBeDefined();
  });

  it('kick-off freezes the match; commands persist; settlement pays out exactly once', async () => {
    const save = await startNewCareer('flow-1', db);
    const pm = await kickOff(db);
    expect((await kickOff(db)).matchId).toBe(pm.matchId); // idempotent
    await expect(assignPlayer('DEF_L', save.lineup.DEF_R!, db)).rejects.toThrow(/finish the current match/i);

    // Play "live" with one tactic, exactly as the UI would, recording the command.
    const engine = createMatch(matchArgs(pm));
    while (!engine.isFinished()) {
      if (engine.tick === 240) {
        const r = engine.dispatch('PRESS', pm.userSide);
        if (r.ok) await recordCommand(pm.matchId, r.command, db);
      }
      engine.advanceTicks(1);
    }
    const live = resultOf(engine, matchArgs(pm));
    await recordCommand(pm.matchId, live.commands[0]!, db); // duplicate tap → no duplicate command

    const settles = await Promise.all([settleMatchOnce(pm.matchId, db), settleMatchOnce(pm.matchId, db).catch((e) => e)]);
    const ok = settles.filter((s) => !(s instanceof Error) && s.applied);
    expect(ok).toHaveLength(1);
    const after = (await loadSave(db))!;
    const record = after.matchRecords[0]!;
    expect(record.score).toEqual(live.score); // rewards come from the replay, which equals the live match
    expect(record.commands).toHaveLength(1);
    expect(after.coins).toBe(save.coins + record.rewards.coins);
    expect(after.matchNumber).toBe(1);
    expect(after.pendingMatch).toBeNull();
    expect(after.rewardClaimIds.filter((c) => c === `match:${pm.matchId}`)).toHaveLength(1);

    // Every starter made a debut, exactly once.
    const starters = (pm.userSide === 'home' ? pm.home : pm.away).players.map((p) => p.id);
    for (const id of starters) {
      const p = after.footballers[id]!;
      expect(p.stats.matches).toBe(1);
      expect(p.history.filter((h) => h.kind === 'debut')).toHaveLength(1);
    }
    // Second settlement attempt cannot pay again.
    await expect(settleMatchOnce(pm.matchId, db)).resolves.toMatchObject({ applied: false });
    expect((await loadSave(db))!.coins).toBe(after.coins);
  });

  it('a reload mid-match resumes the same fixture with the same seed and commands', async () => {
    await startNewCareer('flow-2', db);
    const pm = await kickOff(db);
    await recordCommand(pm.matchId, { type: 'QUICK_PASS', side: pm.userSide, tick: 120 }, db);
    const reloaded = (await loadSave(db))!.pendingMatch!;
    expect(reloaded.seed).toBe(pm.seed);
    expect(reloaded.home).toEqual(pm.home);
    expect(reloaded.commands).toEqual([{ type: 'QUICK_PASS', side: pm.userSide, tick: 120 }]);
    // Replay of the stored inputs is deterministic.
    expect(replayMatch(matchArgs(reloaded), reloaded.commands).events).toEqual(replayMatch(matchArgs(pm), reloaded.commands).events);
  });

  it('levelling up offers a focus choice that applies exactly once', async () => {
    const save = await startNewCareer('flow-3', db);
    const fwdId = save.lineup.FWD_L!;
    await mutateSave((s) => void (s.footballers[fwdId]!.xp = xpToNext(1) - 1), {}, db);
    const pm = await kickOff(db);
    await settleMatchOnce(pm.matchId, db);
    const mid = (await loadSave(db))!;
    const up = mid.pendingUpgrades.find((u) => u.playerId === fwdId)!;
    expect(up).toBeDefined();
    expect(mid.footballers[fwdId]!.level).toBe(2);
    const before = mid.footballers[fwdId]!.attributes.finishing;
    const results = await Promise.all([chooseUpgrade(fwdId, up.level, 'instinct', db), chooseUpgrade(fwdId, up.level, 'instinct', db).catch((e) => e)]);
    expect(results.filter((r) => !(r instanceof Error) && r.applied)).toHaveLength(1);
    const after = (await loadSave(db))!;
    expect(after.footballers[fwdId]!.attributes.finishing).toBe(before + 3);
    expect(after.pendingUpgrades.find((u) => u.playerId === fwdId && u.level === up.level)).toBeUndefined();
    expect(after.footballers[fwdId]!.history.some((h) => h.kind === 'upgrade')).toBe(true);
  });

  it('formation changes persist and are blocked during a match', async () => {
    await startNewCareer('flow-4', db);
    await setFormation('3-2-1', db);
    expect((await loadSave(db))!.formationId).toBe('3-2-1');
    await kickOff(db);
    await expect(setFormation('2-2-2', db)).rejects.toThrow();
  });
});

describe('settlement facts', () => {
  it('XP is capped, losses still pay, and headlines only name players who did the thing', () => {
    for (let i = 0; i < 25; i++) {
      const s = createCareer(`facts-${i}`, 'x');
      const pm = prepareMatch(s);
      const result = replayMatch(matchArgs(pm), []);
      const draft = structuredClone(s);
      const record = settleMatch(draft, pm, result);
      expect(record.rewards.coins).toBeGreaterThanOrEqual(65);
      for (const g of record.gains) expect(g.xp).toBeLessThanOrEqual(XP.cap);
      if (record.storyHeadline.startsWith('OFF THE MARK')) {
        expect(record.scorers.some((sc) => record.storyHeadline.includes(sc.name.toUpperCase()))).toBe(true);
      }
      if (record.storyHeadline.startsWith('WON IT LATE')) {
        const last = record.scorers.at(-1)!;
        expect(last.minute).toBeGreaterThanOrEqual(85);
      }
      if (record.storyHeadline.startsWith('THE CLEAN SHEET')) {
        expect(record.score[pm.userSide === 'home' ? 'away' : 'home']).toBe(0);
      }
      expect(() => migrateSave(draft)).not.toThrow();
    }
  });

  it('the 10-appearance milestone fires on the 10th game only', () => {
    const s = createCareer('milestone', 'x');
    const pm = prepareMatch(s);
    const starter = (pm.userSide === 'home' ? pm.home : pm.away).players[1]!.id;
    s.footballers[starter]!.stats.matches = 9;
    const d1 = structuredClone(s);
    settleMatch(d1, pm, replayMatch(matchArgs(pm), []));
    expect(d1.footballers[starter]!.history.filter((h) => h.kind === 'milestone')).toHaveLength(1);
    s.footballers[starter]!.stats.matches = 10;
    const d2 = structuredClone(s);
    settleMatch(d2, pm, replayMatch(matchArgs(pm), []));
    expect(d2.footballers[starter]!.history.filter((h) => h.kind === 'milestone')).toHaveLength(0);
  });
});

describe('key moments', () => {
  it('are built only from logged events, capped at eight, and name only strong stats', () => {
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const s = createCareer(`moments-${i}`, 'x');
      const pm = prepareMatch(s);
      const result = replayMatch(matchArgs(pm), []);
      const moments = matchMoments(result, pm);
      expect(moments.length).toBeLessThanOrEqual(8);
      for (const m of moments) {
        seen++;
        expect(result.events.some((e) => e.minute === m.minute)).toBe(true);
        if (m.stat) expect(Number(m.stat.split(' ')[1])).toBeGreaterThanOrEqual(65);
      }
      const minutes = moments.map((m) => m.minute);
      expect([...minutes].sort((a, b) => a - b)).toEqual(minutes);
    }
    expect(seen).toBeGreaterThan(20);
  });
});
