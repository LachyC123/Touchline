import type { Tier } from '../domain/players/types';

/**
 * Rarity is a recruitment signal for potential and trait likelihood — not raw power.
 * A well-developed Street player can outgrow a fresh Star (ovr ranges overlap heavily).
 */
export interface TierDef {
  id: Tier;
  label: string;
  /** Published scouting odds (percent). Sum = 100. */
  odds: number;
  ovr: readonly [number, number];
  potentialGain: readonly [number, number];
  potentialCap: number;
  /** Probability of a second trait. */
  secondTrait: number;
  meaning: string;
}

export const TIER_DEFS: Readonly<Record<Tier, TierDef>> = {
  street: { id: 'street', label: 'Street', odds: 53, ovr: [42, 58], potentialGain: [6, 16], potentialCap: 74, secondTrait: 0.05, meaning: 'Grassroots talent with honest room to grow.' },
  prospect: { id: 'prospect', label: 'Prospect', odds: 28, ovr: [44, 60], potentialGain: [10, 21], potentialCap: 80, secondTrait: 0.15, meaning: 'Higher ceiling and a better chance of a second trait.' },
  breakout: { id: 'breakout', label: 'Breakout', odds: 14, ovr: [48, 63], potentialGain: [14, 25], potentialCap: 86, secondTrait: 0.35, meaning: 'Ready to make an impact with real upside.' },
  star: { id: 'star', label: 'Star', odds: 4.5, ovr: [53, 67], potentialGain: [17, 28], potentialCap: 92, secondTrait: 0.6, meaning: 'Rare talent with a high ceiling and two traits likely.' },
  phenomenon: { id: 'phenomenon', label: 'Phenomenon', odds: 0.5, ovr: [57, 70], potentialGain: [21, 32], potentialCap: 97, secondTrait: 0.9, meaning: 'Once-in-a-generation ceiling. Still needs minutes to shine.' },
};

export const TIER_ORDER: readonly Tier[] = ['street', 'prospect', 'breakout', 'star', 'phenomenon'];
