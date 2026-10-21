import { TIER_DEFS, TIER_ORDER } from '../../data/tiers';
import type { Tier } from '../players/types';
import type { ClubSave, PendingMatch } from '../save/types';
import { clubOf } from '../world/world';

/**
 * Reputation: how far the club's name carries. Earned on the pitch (wins, cup runs, titles) and
 * off it (interviews, school visits). It fills the ground, pays at the gate, opens ground
 * upgrades and tilts the scouts' odds towards rarer talent. Pure functions only.
 */

export const REP_TIERS = [
  { id: 'local', label: 'Local', from: 0, blurb: 'Known on the high street.', shift: 0 },
  { id: 'rising', label: 'Rising', from: 15, blurb: 'People in the next town have heard of you.', shift: 4 },
  { id: 'respected', label: 'Respected', from: 40, blurb: 'The county takes you seriously.', shift: 8 },
  { id: 'renowned', label: 'Renowned', from: 80, blurb: 'Scouts call you back first.', shift: 12 },
  { id: 'famous', label: 'Famous', from: 140, blurb: 'Kids in other towns wear your shirt.', shift: 16 },
] as const;

export type RepTier = (typeof REP_TIERS)[number];

export function repTier(rep: number): RepTier {
  let t: RepTier = REP_TIERS[0];
  for (const x of REP_TIERS) if (rep >= x.from) t = x;
  return t;
}

export function nextRepTier(rep: number): RepTier | null {
  return REP_TIERS.find((t) => t.from > rep) ?? null;
}

/** Reputation earned by results. */
export const REP_GAIN = { win: 3, draw: 1, cupTieWon: 3, cupWon: 12, promoted: 15, champions: 20 } as const;

/**
 * Scout odds at a reputation: points move from Street towards the rarer tiers (published on the
 * Scout screen, so the numbers players see are the numbers used).
 */
export function scoutOdds(rep: number): Record<Tier, number> {
  const s = repTier(rep).shift;
  const base = Object.fromEntries(TIER_ORDER.map((t) => [t, TIER_DEFS[t].odds])) as Record<Tier, number>;
  const round = (n: number) => Math.round(n * 10) / 10;
  const out: Record<Tier, number> = {
    street: round(base.street - s),
    prospect: round(base.prospect + s * 0.5),
    breakout: round(base.breakout + s * 0.35),
    star: round(base.star + s * 0.12),
    phenomenon: round(base.phenomenon + s * 0.03),
  };
  return out;
}

// ── The ground ─────────────────────────────────────────────────────────────────────────────

export const GROUND_LEVELS = [
  { level: 1, capacity: 600, cost: 0, needs: 0, name: 'Seen better days', change: '' },
  { level: 2, capacity: 1200, cost: 600, needs: 15, name: 'A lick of paint', change: 'Fresh paint, proper seats, a bigger terrace.' },
  { level: 3, capacity: 2500, cost: 1500, needs: 40, name: 'Covered stand', change: 'A roof over the main stand and a new terrace behind the goal.' },
  { level: 4, capacity: 5000, cost: 3000, needs: 80, name: 'Two-tier stand', change: 'A second tier on the main stand.' },
  { level: 5, capacity: 9000, cost: 6000, needs: 140, name: 'The bowl', change: 'Stands on every side. A proper football ground.' },
] as const;

export function groundOf(level: number): (typeof GROUND_LEVELS)[number] {
  return GROUND_LEVELS[Math.max(0, Math.min(GROUND_LEVELS.length - 1, level - 1))] as (typeof GROUND_LEVELS)[number];
}

export function nextGround(level: number): (typeof GROUND_LEVELS)[number] | null {
  return GROUND_LEVELS[level] ?? null;
}

/** Why the next ground upgrade can't be bought yet (null = it can). */
export function groundBlocker(save: Pick<ClubSave, 'club' | 'coins'>): string | null {
  const next = nextGround(save.club.stadiumLevel);
  if (!next) return 'The ground is finished.';
  if (save.club.reputation < next.needs) return `Needs ${repTier(next.needs).label} reputation (${next.needs}).`;
  if (save.coins < next.cost) return `Needs ${next.cost} coins.`;
  return null;
}

/** Buys the next ground upgrade on a save draft. Throws with the reason if it can't. */
export function upgradeGround(draft: ClubSave): (typeof GROUND_LEVELS)[number] {
  const why = groundBlocker(draft);
  if (why) throw new Error(why);
  const next = nextGround(draft.club.stadiumLevel) as (typeof GROUND_LEVELS)[number];
  draft.coins -= next.cost;
  draft.club.stadiumLevel = next.level;
  return next;
}

/**
 * Who turns up for a home match: interest from reputation (more for a big game), capped by the
 * ground. Deterministic.
 */
export function attendance(save: Pick<ClubSave, 'club'>, big: boolean): number {
  const demand = Math.round((260 + save.club.reputation * 28) * (big ? 1.35 : 1));
  return Math.min(groundOf(save.club.stadiumLevel).capacity, demand);
}

export function gateMoney(fans: number): number {
  return Math.round(fans / 25);
}

/** The crowd for a pending match (0 away from home). Cup ties and derbies are big games. */
export function matchAttendance(save: Pick<ClubSave, 'club' | 'world'>, pending: Pick<PendingMatch, 'userSide' | 'competition' | 'opponentId'>): number {
  if (pending.userSide !== 'home') return 0;
  return attendance(save, pending.competition === 'cup' || Boolean(clubOf(save.world, pending.opponentId)?.rival));
}
