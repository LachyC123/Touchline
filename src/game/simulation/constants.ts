/**
 * Named tuning constants for the match engine. Balance scripts import these so reports state
 * exactly which numbers produced them. Units: pitch units (1 ≈ 0.4 m) and ticks (10 per second).
 */
export const ENGINE_VERSION = 'engine-1';

export const PITCH_W = 100;
export const PITCH_L = 150;
export const GOAL_HALF_WIDTH = 6.5;
export const TICKS_PER_SECOND = 10;
/** Play ticks per match minute: 90' ≈ 108 s of football at 1× speed. */
export const TICKS_PER_MINUTE = 12;
export const HALF_TICKS = 45 * TICKS_PER_MINUTE;
export const FULL_TICKS = 90 * TICKS_PER_MINUTE;

export const TACTIC_DURATION_MIN = 12;
export const TACTIC_COOLDOWN_MIN = 18;

export const MOVE = {
  baseSpeed: 1.05,
  paceSpeed: 0.75,
  carrierSpeedFactor: 0.88,
  baseAccel: 0.22,
  accelBonus: 0.28,
  jogBackSpeed: 3,
  separationRadius: 7,
};

export const STAMINA = {
  baseDrain: 0.00018,
  sprintDrain: 0.0013,
  pressMultiplier: 2.4,
  halftimeRecovery: 0.15,
};

export const BALL = {
  passSpeedMin: 2.8,
  passSpeedMax: 4.6,
  shotSpeed: 5.2,
  looseFriction: 0.9,
  controlRadius: 1.5,
  receiveRadius: 2.6,
  interceptRadius: 1.4,
  loftDistance: 40,
};

export const DECISION = {
  holdTicks: 4,
  quickPassHoldTicks: 2,
  keeperHoldTicks: 7,
  temperature: 0.32,
  shootRange: 52,
};

export const TACKLE = {
  range: 2.3,
  pressRangeBonus: 0.5,
  attemptChance: 0.33,
  pressAttemptChance: 0.7,
  baseSuccess: 0.38,
  pressSuccessBonus: 0.08,
  beatenStumbleTicks: 8,
  tackledStumbleTicks: 6,
  cooldownTicks: 14,
};

export const RESTART = {
  maxWaitTicks: 40,
  kickoffMinTicks: 10,
  goalCelebrateTicks: 18,
  goalMaxTicks: 60,
};
