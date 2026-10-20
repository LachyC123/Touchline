/** XP needed to go from `level` to `level + 1` (master plan §4.5; tune with balance sims). */
export function xpToNext(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return Math.round(55 + 18 * l + 3 * l ** 1.4);
}
