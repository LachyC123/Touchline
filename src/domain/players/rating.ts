import type { AttributeKey, Attributes, Footballer, Position } from './types';
import { clamp } from '../rng';

/**
 * Published Overall formula (single source of truth for cards, lineups and the match engine).
 *
 *   OVR(position) = round( Σ weight(attr) × value(attr) ) + fitModifier
 *
 * `offBall` is derived: 0.5·acceleration + 0.3·vision + 0.2·composure.
 * Weights per position sum to exactly 1 (unit-tested).
 */
export type WeightedKey = AttributeKey | 'offBall';

export const POSITION_WEIGHTS: Record<Position, Partial<Record<WeightedKey, number>>> = {
  FWD: {
    finishing: 0.2,
    shooting: 0.16,
    offBall: 0.14,
    pace: 0.12,
    ballControl: 0.1,
    composure: 0.1,
    strength: 0.06,
    passing: 0.06,
    stamina: 0.06,
  },
  MID: {
    passing: 0.2,
    vision: 0.16,
    ballControl: 0.14,
    dribbling: 0.1,
    stamina: 0.1,
    composure: 0.08,
    tackling: 0.08,
    shooting: 0.06,
    pace: 0.05,
    strength: 0.03,
  },
  DEF: {
    tackling: 0.22,
    marking: 0.2,
    strength: 0.14,
    pace: 0.1,
    composure: 0.08,
    passing: 0.08,
    stamina: 0.08,
    acceleration: 0.05,
    ballControl: 0.05,
  },
  GK: {
    reflexes: 0.26,
    positioning: 0.22,
    handling: 0.2,
    reach: 0.14,
    distribution: 0.1,
    composure: 0.08,
  },
};

export const FIT_MODIFIER = { primary: 0, secondary: -2, other: -8, gkOutfield: -30 } as const;

export function offBall(a: Attributes): number {
  return 0.5 * a.acceleration + 0.3 * a.vision + 0.2 * a.composure;
}

function valueOf(a: Attributes, key: WeightedKey): number {
  return key === 'offBall' ? offBall(a) : a[key];
}

/** Unrounded role score — used internally by the generator to hit target ratings. */
export function rawRoleScore(a: Attributes, position: Position): number {
  let total = 0;
  for (const [key, weight] of Object.entries(POSITION_WEIGHTS[position]) as [WeightedKey, number][]) {
    total += weight * valueOf(a, key);
  }
  return total;
}

export function fitModifier(p: Pick<Footballer, 'primaryPosition' | 'secondaryPositions'>, position: Position): number {
  if (p.primaryPosition === position) return FIT_MODIFIER.primary;
  if (p.secondaryPositions.includes(position)) return FIT_MODIFIER.secondary;
  if (position === 'GK' || p.primaryPosition === 'GK') return FIT_MODIFIER.gkOutfield;
  return FIT_MODIFIER.other;
}

export function overallAt(p: Pick<Footballer, 'attributes' | 'primaryPosition' | 'secondaryPositions'>, position: Position): number {
  return clamp(Math.round(rawRoleScore(p.attributes, position) + fitModifier(p, position)), 1, 99);
}

export function overall(p: Pick<Footballer, 'attributes' | 'primaryPosition' | 'secondaryPositions'>): number {
  return overallAt(p, p.primaryPosition);
}

export interface CardStat {
  key: string;
  label: string;
  value: number;
  /** One-line explanation for the expanded stats view. */
  meaning: string;
}

const r = (n: number) => clamp(Math.round(n), 1, 99);

/** The four headline stats printed on a card. Goalkeepers get their own set. */
export function cardStats(p: Pick<Footballer, 'attributes' | 'primaryPosition'>): CardStat[] {
  const a = p.attributes;
  if (p.primaryPosition === 'GK') {
    return [
      { key: 'REF', label: 'REF', value: r(a.reflexes), meaning: 'Reaction saves from close range.' },
      { key: 'HAN', label: 'HAN', value: r(a.handling), meaning: 'Holds shots instead of spilling rebounds.' },
      { key: 'POS', label: 'POS', value: r(a.positioning * 0.7 + a.reach * 0.3), meaning: 'Narrows angles and reaches the corners.' },
      { key: 'DIS', label: 'DIS', value: r(a.distribution), meaning: 'Starts attacks with throws and kicks.' },
    ];
  }
  return [
    { key: 'PAC', label: 'PAC', value: r(a.pace * 0.55 + a.acceleration * 0.45), meaning: 'Top speed and burst into space.' },
    { key: 'PAS', label: 'PAS', value: r(a.passing * 0.5 + a.vision * 0.3 + a.ballControl * 0.2), meaning: 'Finds teammates and spots the killer ball.' },
    { key: 'SHO', label: 'SHO', value: r(a.finishing * 0.45 + a.shooting * 0.35 + a.composure * 0.2), meaning: 'Turns chances into goals.' },
    { key: 'DEF', label: 'DEF', value: r(a.tackling * 0.45 + a.marking * 0.4 + a.strength * 0.15), meaning: 'Wins the ball back and tracks runners.' },
  ];
}

export const ATTRIBUTE_INFO: Record<AttributeKey, { label: string; meaning: string }> = {
  pace: { label: 'Pace', meaning: 'Top running speed over distance.' },
  acceleration: { label: 'Acceleration', meaning: 'How fast they reach top speed — vital in a 7v7 burst.' },
  shooting: { label: 'Shooting', meaning: 'Power and accuracy from distance.' },
  finishing: { label: 'Finishing', meaning: 'Converting chances inside the box.' },
  passing: { label: 'Passing', meaning: 'Accuracy and weight of passes.' },
  vision: { label: 'Vision', meaning: 'Seeing runs and through-ball lanes others miss.' },
  dribbling: { label: 'Dribbling', meaning: 'Beating a player with the ball.' },
  ballControl: { label: 'Ball control', meaning: 'First touch and keeping the ball under pressure.' },
  tackling: { label: 'Tackling', meaning: 'Winning the ball cleanly in a challenge.' },
  marking: { label: 'Marking', meaning: 'Staying goal-side and cutting out runners.' },
  strength: { label: 'Strength', meaning: 'Holding off challenges and winning duels.' },
  stamina: { label: 'Stamina', meaning: 'Energy to keep pressing late in matches.' },
  composure: { label: 'Composure', meaning: 'Decision quality when the pressure is on.' },
  setPieces: { label: 'Set pieces', meaning: 'Corner and free-kick delivery.' },
  reflexes: { label: 'Reflexes', meaning: 'Reaction saves from close range.' },
  positioning: { label: 'Positioning', meaning: 'Keeper angles and starting spot.' },
  handling: { label: 'Handling', meaning: 'Catching cleanly instead of parrying.' },
  distribution: { label: 'Distribution', meaning: 'Throws and kicks that start attacks.' },
  reach: { label: 'Reach', meaning: 'Getting fingertips to shots in the corners.' },
};
