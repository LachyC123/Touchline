import { overall } from './rating';
import type { AttributeKey, Footballer, Position } from './types';

/**
 * Level-up training focuses: pick ONE of two per level (master plan §4.5). Gains are bounded
 * and slow once a player reaches his potential, but there is no invisible brick wall.
 */
export interface FocusDef {
  id: string;
  name: string;
  blurb: string;
  gains: Partial<Record<AttributeKey, number>>;
}

export const FOCUSES: Readonly<Record<string, FocusDef>> = {
  instinct: { id: 'instinct', name: 'Instinct', blurb: 'Sharper in the box and quicker off the mark.', gains: { finishing: 3, acceleration: 2, composure: 1 } },
  showtime: { id: 'showtime', name: 'Showtime', blurb: 'Beats his man and lets fly from range.', gains: { dribbling: 3, shooting: 2, ballControl: 1 } },
  playmaker: { id: 'playmaker', name: 'Playmaker', blurb: 'Sees the pass early and hits it true.', gains: { passing: 3, vision: 2, ballControl: 1 } },
  engine: { id: 'engine', name: 'Engine', blurb: 'Covers more grass and wins it back.', gains: { stamina: 3, tackling: 2, strength: 1 } },
  enforcer: { id: 'enforcer', name: 'Enforcer', blurb: 'Stronger in the tackle, harder to shake off.', gains: { tackling: 3, strength: 2, marking: 1 } },
  reader: { id: 'reader', name: 'Reader', blurb: 'Reads the game and plays out cleanly.', gains: { marking: 3, passing: 2, composure: 1 } },
  shotStopper: { id: 'shotStopper', name: 'Shot Stopper', blurb: 'Faster hands, safer catches.', gains: { reflexes: 3, handling: 2, reach: 1 } },
  sweeper: { id: 'sweeper', name: 'Sweeper', blurb: 'Commands his box and starts attacks.', gains: { positioning: 3, distribution: 2, composure: 1 } },
};

export const FOCUS_OPTIONS: Record<Position, [string, string]> = {
  FWD: ['instinct', 'showtime'],
  MID: ['playmaker', 'engine'],
  DEF: ['enforcer', 'reader'],
  GK: ['shotStopper', 'sweeper'],
};

/** Attribute deltas this focus would give this player right now (for previews and applying). */
export function focusDeltas(p: Footballer, focusId: string): Partial<Record<AttributeKey, number>> {
  const focus = FOCUSES[focusId];
  if (!focus) throw new Error(`Unknown focus ${focusId}`);
  const atCeiling = overall(p) >= p.potential;
  const out: Partial<Record<AttributeKey, number>> = {};
  for (const [k, v] of Object.entries(focus.gains) as [AttributeKey, number][]) {
    const gain = atCeiling ? Math.max(1, Math.floor(v / 2)) : v;
    out[k] = Math.max(0, Math.min(99, p.attributes[k] + gain) - p.attributes[k]);
  }
  return out;
}

export function applyFocus(p: Footballer, focusId: string): { before: number; after: number } {
  const before = overall(p);
  for (const [k, v] of Object.entries(focusDeltas(p, focusId)) as [AttributeKey, number][]) {
    p.attributes[k] = p.attributes[k] + v;
  }
  return { before, after: overall(p) };
}
