import { FORMATION_DEFS, type FormationSlot } from '../../domain/formations';
import type { Rng } from '../../domain/rng';
import { PITCH_L } from './constants';
import type { FootballEvent, LineupPlayer, MatchCommand, MatchPhase, MatchStats, PlayerAction, RestartKind, SaveStyle, ShotOutcome, ShotStyle, SimPos, TacticCommand, TeamLineup, TeamSide } from './types';

/** Internal mutable engine state. Never exposed directly — snapshots are copies. */
export interface PState {
  id: string;
  side: TeamSide;
  index: number;
  lp: LineupPlayer;
  slot: FormationSlot;
  traits: ReadonlySet<string>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  stamina: number;
  /** Ticks before this player may tackle/decide again. */
  cooldown: number;
  stumble: number;
  action: PlayerAction;
  actionTicks: number;
  /** Presentation detail for the current action (skill move, etc.). */
  detail: string | null;
  runTicks: number;
  /** Booked players go into challenges more carefully (there are no red cards yet). */
  booked: boolean;
  fouls: number;
  /** Keeper only: where the current dive is heading. */
  diveTarget: SimPos | null;
  /** Ticks during which this player will hit a first-time shot (rebounds, knock-downs). */
  firstTime: number;
  /** Set while taking a set piece (delivery uses set-piece skill). */
  restartKind: RestartKind | null;
  /** Ticks the carrier has held the ball. */
  hold: number;
  dribbleTarget: SimPos | null;
  dribbleFrom: SimPos | null;
  targetX: number;
  targetY: number;
}

export interface Flight {
  kind: 'pass' | 'shot';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  tick: number;
  total: number;
  peakZ: number;
  side: TeamSide;
  kickerId: string;
  intendedId?: string;
  shot?: ShotPlan;
  /** A lofted ball into the box: contested in the air on arrival. */
  cross?: boolean;
}

export interface ShotPlan {
  eventId: number;
  outcome: ShotOutcome;
  style: ShotStyle;
  keeperId: string | null;
  blockerId: string | null;
  assistId?: string;
  goalY: number;
  /** Decided with the shot so the keeper can be seen to react before it arrives. */
  save?: { style: SaveStyle; held: boolean; double: boolean };
  /** Where the keeper ends his dive (a goal is a dive that falls short or goes the wrong way). */
  diveX?: number;
  /** A wide shot that took a deflection on its way out: corner, not goal kick. */
  deflected?: boolean;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  state: 'owned' | 'pass' | 'shot' | 'loose' | 'dead';
  ownerId: string | null;
  lastTouchSide: TeamSide;
  lastTouchId: string | null;
  flight: Flight | null;
}

export interface TeamState {
  side: TeamSide;
  lineup: TeamLineup;
  players: PState[];
  /** Tick until which each played card's effect lasts. */
  activeUntil: Partial<Record<TacticCommand, number>>;
  momentum: number;
  /** Play ticks towards the next Momentum point. */
  momentumTicks: number;
  hand: TacticCommand[];
  /** Draw pile: played cards go to the back. */
  queue: TacticCommand[];
  marking: { markerId: string; targetId: string } | null;
  controlledBy: 'user' | 'ai';
}

export interface RestartState {
  kind: RestartKind;
  side: TeamSide;
  spot: SimPos;
  takerId: string;
  waited: number;
  /** Free kicks in range: defenders forming the wall and where they stand. */
  wall: { id: string; x: number; y: number }[];
  /** Free kick close enough to shoot at. */
  direct: boolean;
}

export interface EngineState {
  matchId: string;
  seed: string;
  rng: Rng;
  tick: number;
  playTick: number;
  half: 1 | 2;
  phase: MatchPhase;
  phaseTicks: number;
  score: Record<TeamSide, number>;
  teams: Record<TeamSide, TeamState>;
  ball: BallState;
  restart: RestartState | null;
  lastScorerId: string | null;
  events: FootballEvent[];
  commands: MatchCommand[];
  pending: MatchCommand[];
  stats: MatchStats;
  lastCompletedPass: { fromId: string; toId: string; side: TeamSide; tick: number } | null;
  /** Most recent parried save (for rebounds and double saves). */
  lastSave: { tick: number; keeperId: string; side: TeamSide } | null;
  possession: TeamSide | null;
}

export const other = (s: TeamSide): TeamSide => (s === 'home' ? 'away' : 'home');

/** The side attacking towards y = 0 in the current half (home in the first half). */
export function attacksUp(st: Pick<EngineState, 'half'>, side: TeamSide): boolean {
  return st.half === 1 ? side === 'home' : side === 'away';
}

/** Convert a team-frame depth (0 own goal → 1 opposition goal) to pitch y. */
export function depthToY(st: Pick<EngineState, 'half'>, side: TeamSide, depth: number): number {
  return attacksUp(st, side) ? PITCH_L - depth * PITCH_L : depth * PITCH_L;
}

export function yToDepth(st: Pick<EngineState, 'half'>, side: TeamSide, y: number): number {
  return attacksUp(st, side) ? (PITCH_L - y) / PITCH_L : y / PITCH_L;
}

/** y of the goal line this side is attacking. */
export function attackGoalY(st: Pick<EngineState, 'half'>, side: TeamSide): number {
  return attacksUp(st, side) ? 0 : PITCH_L;
}

export function ownGoalY(st: Pick<EngineState, 'half'>, side: TeamSide): number {
  return attacksUp(st, side) ? PITCH_L : 0;
}

export function allPlayers(st: EngineState): PState[] {
  return [...st.teams.home.players, ...st.teams.away.players];
}

export function findPlayer(st: EngineState, id: string | null): PState | undefined {
  if (!id) return undefined;
  return st.teams.home.players.find((p) => p.id === id) ?? st.teams.away.players.find((p) => p.id === id);
}

export function keeperOf(st: EngineState, side: TeamSide): PState | undefined {
  return st.teams[side].players.find((p) => p.slot.position === 'GK');
}

export function isTacticActive(st: EngineState, side: TeamSide, cmd: TacticCommand): boolean {
  return (st.teams[side].activeUntil[cmd] ?? 0) > st.tick;
}

export function buildPlayers(lineup: TeamLineup, side: TeamSide): PState[] {
  const slots = FORMATION_DEFS[lineup.formation].slots;
  return lineup.players.map((lp, index) => {
    const slot = slots.find((s) => s.id === lp.slotId);
    if (!slot) throw new Error(`Slot ${lp.slotId} is not part of formation ${lineup.formation}`);
    return {
      id: lp.id,
      side,
      index,
      lp,
      slot,
      traits: new Set(lp.traitIds),
      x: 50,
      y: 75,
      vx: 0,
      vy: 0,
      facing: 1,
      stamina: 1,
      cooldown: 0,
      stumble: 0,
      action: 'idle',
      actionTicks: 0,
      detail: null,
      runTicks: 0,
      booked: false,
      fouls: 0,
      diveTarget: null,
      firstTime: 0,
      restartKind: null,
      hold: 0,
      dribbleTarget: null,
      dribbleFrom: null,
      targetX: 50,
      targetY: 75,
    };
  });
}

/** Pressure on a point from the opposition: Σ max(0, 1 − d/6), capped at 1.5. */
export function pressureAt(st: EngineState, side: TeamSide, p: SimPos): number {
  let total = 0;
  for (const o of st.teams[other(side)].players) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < 6) total += 1 - d / 6;
  }
  return Math.min(1.5, total);
}

/** Penalty area of the goal `side` defends: 20 units deep, 46 wide (x 27–73). */
export function inOwnBox(st: Pick<EngineState, 'half'>, side: TeamSide, p: SimPos): boolean {
  return yToDepth(st, side, p.y) < 20 / PITCH_L && Math.abs(p.x - 50) < 23;
}
