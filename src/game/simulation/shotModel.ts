import { GOAL_HALF_WIDTH } from './constants';
import { clamp } from './geometry';
import type { SimAttributes, SimPos } from './types';

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
}

/**
 * Published shot quality (xG):
 *   clamp(location × finishing × composure-under-pressure × keeper, 0.01, 0.82)
 * Traits apply bounded nudges; nothing can force a goal or a save.
 */
export function shotXg(ctx: ShotContext): number {
  const d = Math.hypot(50 - ctx.from.x, ctx.goalY - ctx.from.y);
  const loc = locationXg(ctx.from, ctx.goalY);
  const skill = d > 28 ? ctx.shooter.shooting : ctx.shooter.finishing * 0.75 + ctx.shooter.shooting * 0.25;
  const finishing = 0.5 + (skill / 100) * 0.95;
  const pressure = 1 - ctx.pressure * (0.45 - (ctx.shooter.composure / 100) * 0.3);
  const keeper = ctx.keeper ? 1.35 - (keeperSkill(ctx.keeper) / 100) * 0.7 : 1.4;
  let traits = 1;
  if (ctx.shooterTraits.includes('poacher') && d < 18) traits *= 1.06;
  if (ctx.shooterTraits.includes('longRanger') && d > 28) traits *= 1.07;
  if (ctx.keeperTraits.includes('reflexCat') && d < 18) traits *= 0.94;
  return clamp(loc * finishing * pressure * keeper * traits, 0.01, 0.82);
}
