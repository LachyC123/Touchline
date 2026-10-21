import { GOAL_HALF_WIDTH } from './constants';
import { clamp } from './geometry';
import type { ShotStyle, SimAttributes, SimPos } from './types';

/** Angle (radians) the goal mouth subtends from `p`, for a goal line at `goalY`. */
export function goalAngle(p: SimPos, goalY: number): number {
  const a1 = Math.atan2(goalY - p.y, 50 - GOAL_HALF_WIDTH - p.x);
  const a2 = Math.atan2(goalY - p.y, 50 + GOAL_HALF_WIDTH - p.x);
  let a = Math.abs(a1 - a2);
  if (a > Math.PI) a = 2 * Math.PI - a;
  return a;
}

/** Location-only chance quality before player, pressure and keeper modifiers. */
export function locationXg(p: SimPos, goalY: number): number {
  const d = Math.hypot(50 - p.x, goalY - p.y);
  const angle = goalAngle(p, goalY);
  return clamp(0.95 * Math.pow(angle / 1.2, 1.1) * Math.exp(-d / 38), 0, 0.9);
}

export function keeperSkill(a: SimAttributes): number {
  return a.reflexes * 0.4 + a.positioning * 0.3 + a.handling * 0.15 + a.reach * 0.15;
}

export interface ShotContext {
  from: SimPos;
  goalY: number;
  shooter: SimAttributes;
  shooterTraits: readonly string[];
  keeper: SimAttributes | null;
  keeperTraits: readonly string[];
  /** 0 (free) .. 1.5 (swarmed). */
  pressure: number;
  style?: ShotStyle;
  /** The keeper is still on the ground from a previous save. */
  keeperDown?: boolean;
}

/** Published penalty conversion before keeper and composure modifiers. */
export const PENALTY_XG = 0.76;

/**
 * Published shot quality (xG):
 *   clamp(location × finishing × composure-under-pressure × keeper, 0.01, 0.82)
 * Traits apply bounded nudges; nothing can force a goal or a save.
 */
export function shotXg(ctx: ShotContext): number {
  const a = ctx.shooter;
  const style = ctx.style ?? 'normal';
  const d = Math.hypot(50 - ctx.from.x, ctx.goalY - ctx.from.y);
  const keeper = ctx.keeper ? (ctx.keeperDown ? 1.3 : 1.35 - (keeperSkill(ctx.keeper) / 100) * 0.7) : 1.4;
  if (style === 'penalty') {
    const k = ctx.keeper ? 1.1 - (keeperSkill(ctx.keeper) / 100) * 0.25 : 1.1;
    return clamp(PENALTY_XG * (0.9 + (a.composure / 100) * 0.12 + (a.setPieces / 100) * 0.06) * k, 0.55, 0.9);
  }
  if (style === 'freeKick') {
    return clamp((0.03 + (a.setPieces / 100) * 0.13 - Math.max(0, d - 20) / 450) * keeper, 0.02, 0.2);
  }
  const loc = locationXg(ctx.from, ctx.goalY);
  let skill: number;
  if (style === 'header') skill = a.finishing * 0.5 + a.strength * 0.5;
  else if (d > 28) skill = a.shooting;
  else skill = a.finishing * 0.75 + a.shooting * 0.25;
  const finishing = 0.5 + (skill / 100) * 0.95;
  const pressure = 1 - ctx.pressure * (0.45 - (a.composure / 100) * 0.3);
  let traits = 1;
  if (ctx.shooterTraits.includes('poacher') && d < 18) traits *= 1.06;
  if (ctx.shooterTraits.includes('longRanger') && d > 28) traits *= 1.07;
  if (ctx.keeperTraits.includes('reflexCat') && d < 18) traits *= 0.94;
  const styleK = style === 'header' ? 0.78 : style === 'volley' ? 0.92 : 1;
  return clamp(loc * finishing * pressure * keeper * traits * styleK, 0.01, 0.85);
}
