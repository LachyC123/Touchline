import type { AttributeKey, Footballer } from './types';

/**
 * Morale: 0–100, starting at 60 ("Content"). It moves after every match and through
 * dressing-room decisions, and nudges three attributes on the pitch: composure most, then
 * finishing and passing. Pure functions; the same history always gives the same morale.
 */

export const MORALE = { start: 60, min: 0, max: 100, settle: 75 } as const;

export type MoraleBand = 'low' | 'unsettled' | 'content' | 'happy' | 'buzzing';

export const MORALE_BANDS: readonly { band: MoraleBand; from: number; label: string; composure: number }[] = [
  { band: 'low', from: 0, label: 'Low', composure: -4 },
  { band: 'unsettled', from: 31, label: 'Unsettled', composure: -2 },
  { band: 'content', from: 46, label: 'Content', composure: 0 },
  { band: 'happy', from: 65, label: 'Happy', composure: 2 },
  { band: 'buzzing', from: 81, label: 'Buzzing', composure: 4 },
];

export function moraleBand(morale: number): (typeof MORALE_BANDS)[number] {
  let found = MORALE_BANDS[0] as (typeof MORALE_BANDS)[number];
  for (const b of MORALE_BANDS) if (morale >= b.from) found = b;
  return found;
}

export function clampMorale(m: number): number {
  return Math.max(MORALE.min, Math.min(MORALE.max, Math.round(Number.isFinite(m) ? m : MORALE.start)));
}

/** What his mood is worth on the pitch (added to his attributes when the lineup is frozen). */
export function moraleEffect(morale: number): Partial<Record<AttributeKey, number>> {
  const c = moraleBand(morale).composure;
  if (c === 0) return {};
  const half = Math.trunc(c / 2);
  return { composure: c, finishing: half, passing: half };
}

export function describeEffect(morale: number): string {
  const e = moraleEffect(morale);
  const parts = (Object.entries(e) as [AttributeKey, number][]).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`);
  return parts.length ? parts.join(', ') : 'no effect on his game';
}

export interface MoraleChange {
  playerId: string;
  delta: number;
  reasons: string[];
}

export interface MatchMoraleInput {
  started: boolean;
  cameOn: boolean;
  goals: number;
  potm: boolean;
  result: 'win' | 'draw' | 'loss';
}

/**
 * After a match: minutes matter most (ambitious players hate the bench, loyal ones less so),
 * then the result, goals and player of the match. Very high morale drifts back towards normal.
 */
export function matchMoraleDelta(p: Pick<Footballer, 'morale' | 'personality'>, m: MatchMoraleInput): { delta: number; reasons: string[] } {
  const reasons: string[] = [];
  let d = 0;
  const played = m.started || m.cameOn;
  if (m.started) {
    d += 3;
    reasons.push('started');
  } else if (m.cameOn) {
    d += 1;
    reasons.push('came on');
  } else {
    const sting = 3 + Math.round(p.personality.ambition / 30) - Math.round(p.personality.loyalty / 50);
    d -= Math.max(2, sting);
    reasons.push('unused');
  }
  if (played) {
    if (m.result === 'win') {
      d += 3;
      reasons.push('won');
    } else if (m.result === 'loss') {
      d -= 3;
      reasons.push('lost');
    }
    if (m.goals > 0) {
      d += Math.min(6, m.goals * 3);
      reasons.push(m.goals > 1 ? `${m.goals} goals` : 'scored');
    }
    if (m.potm) {
      d += 4;
      reasons.push('player of the match');
    }
  }
  if (p.morale + d > MORALE.settle) d -= 1; // the buzz fades a little
  return { delta: clampMorale(p.morale + d) - p.morale, reasons };
}
