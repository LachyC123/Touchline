import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardsUnlockedAt, deckProblem, MANAGER_LEVEL_XP, managerLevel, nextCardUnlock } from '../domain/club/manager';
import { createCareer } from '../domain/club/newCareer';
import { CARD_DEFS, CARD_IDS } from '../game/simulation/cards';
import { TouchlineDB, setDbForTests } from './db';
import { migrateSave } from './migrations';
import { kickOff, loadSave, markCardsSeen, mutateSave, onboardingEvent, setDeck, settleMatchOnce, startNewCareer } from './saveRepo';

let db: TouchlineDB;
let n = 0;
beforeEach(async () => {
  db = new TouchlineDB(`cards-${n++}`);
  setDbForTests(db);
  await db.open();
});
afterEach(async () => {
  setDbForTests(null);
  await db.delete();
});

describe('manager levels and card unlocks', () => {
  it('levels follow club XP and every card has a reachable unlock level', () => {
    expect(managerLevel(0)).toBe(1);
    expect(managerLevel(MANAGER_LEVEL_XP[1]!)).toBe(2);
    expect(managerLevel(MANAGER_LEVEL_XP[1]! - 1)).toBe(1);
    for (const id of CARD_IDS) expect(CARD_DEFS[id].unlockLevel).toBeLessThanOrEqual(MANAGER_LEVEL_XP.length);
    expect(cardsUnlockedAt(1)).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS']);
    expect(nextCardUnlock(1)).toEqual({ card: 'HAIRDRYER', level: 2 });
    expect(nextCardUnlock(5)).toBeNull();
  });

  it('a new career starts with the level-1 cards as its deck', () => {
    const s = createCareer('cards-new', 'x');
    expect(s.cardsUnlocked).toEqual(cardsUnlockedAt(1));
    expect(s.deck).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS']);
    expect(() => migrateSave(s)).not.toThrow();
  });

  it('decks must be 3–5 distinct unlocked cards', () => {
    const unlocked = cardsUnlockedAt(1);
    expect(deckProblem(['QUICK_PASS', 'PRESS'], unlocked)).toMatch(/at least/);
    expect(deckProblem(['QUICK_PASS', 'PRESS', 'PRESS'], unlocked)).toMatch(/once/);
    expect(deckProblem(['QUICK_PASS', 'PRESS', 'MAN_MARK'], unlocked)).toMatch(/locked/);
    expect(deckProblem(['QUICK_PASS', 'PRESS', 'GO_WIDE'], unlocked)).toBeNull();
  });

  it('settling a match that crosses a level unlocks the card once, adds it to the deck and records it', async () => {
    await startNewCareer('cards-unlock', db);
    await onboardingEvent('skip', db);
    await mutateSave((s) => void (s.clubXp = MANAGER_LEVEL_XP[1]! - 5), {}, db);
    const pm = await kickOff(db);
    const { record } = await settleMatchOnce(pm.matchId, db);
    const s = (await loadSave(db))!;
    expect(record.unlockedCards).toEqual(['HAIRDRYER']);
    expect(s.cardsUnlocked).toContain('HAIRDRYER');
    expect(s.deck).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS', 'HAIRDRYER']);
    expect(s.newCards).toEqual(['HAIRDRYER']);
    await markCardsSeen(db);
    expect((await loadSave(db))!.newCards).toEqual([]);
    // The next match takes the saved deck into the engine.
    const next = await kickOff(db);
    const ours = next.userSide === 'home' ? next.home : next.away;
    expect(ours.deck).toEqual(s.deck);
  });

  it('setDeck rejects invalid decks and persists valid ones', async () => {
    await startNewCareer('cards-deck', db);
    await expect(setDeck(['QUICK_PASS'], db)).rejects.toThrow(/at least/);
    await expect(setDeck(['QUICK_PASS', 'PRESS', 'ALL_OUT'], db)).rejects.toThrow(/locked/);
    await setDeck(['PARK_BUS', 'PRESS', 'QUICK_PASS'], db);
    expect((await loadSave(db))!.deck).toEqual(['PARK_BUS', 'PRESS', 'QUICK_PASS']);
  });

  it('a v3 save migrates with unlocks matching the club XP it already earned', () => {
    const v4 = createCareer('cards-mig', 'x');
    const { cardsUnlocked: _c, deck: _d, newCards: _n, league: _l, seasons: _s, ...rest } = v4;
    const v3 = { ...rest, schemaVersion: 3, contentVersion: 'content-3', clubXp: MANAGER_LEVEL_XP[2]! + 1 };
    const m = migrateSave(v3);
    expect(m.cardsUnlocked).toEqual(cardsUnlockedAt(3));
    expect(m.newCards).toEqual(['HAIRDRYER', 'TARGET_MAN']);
    expect(m.deck).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS']);
  });
});
