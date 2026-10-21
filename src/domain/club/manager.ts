import { CARD_DEFS, CARD_IDS, DECK_MAX, DECK_MIN, type CardId } from '../../game/simulation/cards';

/** Club XP needed to reach each manager level (index = level − 1). */
export const MANAGER_LEVEL_XP: readonly number[] = [0, 80, 200, 360, 560, 800, 1100];

export function managerLevel(clubXp: number): number {
  let level = 1;
  MANAGER_LEVEL_XP.forEach((xp, i) => {
    if (clubXp >= xp) level = i + 1;
  });
  return level;
}

/** Progress through the current level, for the hub/lobby bar. */
export function managerProgress(clubXp: number): { level: number; into: number; span: number | null } {
  const level = managerLevel(clubXp);
  const from = MANAGER_LEVEL_XP[level - 1] ?? 0;
  const to = MANAGER_LEVEL_XP[level];
  return { level, into: clubXp - from, span: to === undefined ? null : to - from };
}

export function cardsUnlockedAt(level: number): CardId[] {
  return CARD_IDS.filter((id) => CARD_DEFS[id].unlockLevel <= level);
}

/** The next card still locked, and the level that unlocks it. */
export function nextCardUnlock(level: number): { card: CardId; level: number } | null {
  const next = CARD_IDS.filter((id) => CARD_DEFS[id].unlockLevel > level).sort((a, b) => CARD_DEFS[a].unlockLevel - CARD_DEFS[b].unlockLevel)[0];
  return next ? { card: next, level: CARD_DEFS[next].unlockLevel } : null;
}

/** Plain-language problem with a proposed deck, or null if it can be taken into a match. */
export function deckProblem(deck: readonly CardId[], unlocked: readonly CardId[]): string | null {
  if (deck.length < DECK_MIN) return `Take at least ${DECK_MIN} cards.`;
  if (deck.length > DECK_MAX) return `A deck holds at most ${DECK_MAX} cards.`;
  if (new Set(deck).size !== deck.length) return 'A card can only be in the deck once.';
  if (deck.some((c) => !unlocked.includes(c))) return 'That card is still locked.';
  return null;
}
