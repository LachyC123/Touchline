/**
 * Match engine contract types (see MATCH_ENGINE_CONTRACT.md).
 * Pure data: no React, Phaser, DOM or wall-clock time.
 */
import type { FormationId } from '../../domain/formations';
import type { Appearance, Position } from '../../domain/players/types';
import type { CardId } from './cards';

export type TeamSide = 'home' | 'away';
export interface SimPos {
  x: number;
  y: number;
}

/** Attributes the engine reads, already normalised 1–99. */
export interface SimAttributes {
  pace: number;
  acceleration: number;
  shooting: number;
  finishing: number;
  passing: number;
  vision: number;
  dribbling: number;
  ballControl: number;
  tackling: number;
  marking: number;
  strength: number;
  stamina: number;
  composure: number;
  /** Free kicks, penalties and corner delivery. */
  setPieces: number;
  reflexes: number;
  positioning: number;
  handling: number;
  distribution: number;
  reach: number;
}

export interface LineupPlayer {
  id: string;
  name: string;
  shortName: string;
  slotId: string;
  /** Role the player fills in this match (slot position, not necessarily his natural one). */
  role: Position;
  naturalPosition: Position;
  /** Positional rating at `role` (includes the out-of-position penalty). */
  rating: number;
  attributes: SimAttributes;
  traitIds: string[];
  strongFoot: 'left' | 'right' | 'both';
  /** For the renderer only — never read by the simulation. */
  appearance: Appearance;
  /** Renderer only: gait and signature celebration from the player's stored identity. */
  runningStyleId?: string;
  celebrationId?: string;
}

export type AiStyle = 'balanced' | 'press' | 'passing' | 'counter' | 'direct';

export interface TeamLineup {
  clubId: string;
  /** How the AI manages this team when no human controls it. */
  aiStyle: AiStyle;
  name: string;
  shortName: string;
  kit: { primary: string; secondary: string; pattern?: 'plain' | 'stripes' | 'hoops' | 'sash' | 'halves' };
  formation: FormationId;
  players: LineupPlayer[];
  /** Substitutes available at half-time (slotId 'bench', role = natural position). */
  bench?: LineupPlayer[];
  /** Manager cards brought to this match, in draw order (absent on lineups frozen before engine-3). */
  deck?: CardId[];
}

/** A manager card played during the match. */
export type TacticCommand = CardId;

export interface MatchCommand {
  /** A manager card, or a substitution (half-time only). */
  type: TacticCommand | 'SUB';
  side: TeamSide;
  /** Tick at which the command takes effect (recorded for replay). */
  tick: number;
  /** Substitutions: the player going off and the bench player coming on. */
  outId?: string;
  inId?: string;
}

export type CommandResult = { ok: true; command: MatchCommand } | { ok: false; reason: string };

export type RestartKind = 'goalKick' | 'corner' | 'throwIn' | 'kickoff' | 'freeKick' | 'penalty';
export type ShotOutcome = 'goal' | 'saved' | 'blocked' | 'wide' | 'woodwork';
/** How a shot was struck: drives xG, the ball's flight and the presentation. */
export type ShotStyle = 'normal' | 'long' | 'header' | 'volley' | 'freeKick' | 'penalty';
/** How a keeper dealt with a shot on target. */
export type SaveStyle = 'catch' | 'dive' | 'fingertip' | 'parry';
export type SkillMove = 'stepover' | 'nutmeg' | 'roulette' | 'flick' | 'dragBack';
export type TackleStyle = 'standing' | 'slide';

interface EventBase {
  id: number;
  tick: number;
  minute: number;
}

export type FootballEvent =
  | (EventBase & { type: 'KICKOFF'; team: TeamSide; half: 1 | 2 })
  | (EventBase & { type: 'PASS'; fromId: string; toId: string; start: SimPos; end: SimPos; outcome: 'complete' | 'intercepted' | 'loose'; interceptedBy?: string; cross?: boolean })
  | (EventBase & { type: 'DRIBBLE'; playerId: string; from: SimPos; to: SimPos })
  | (EventBase & { type: 'TACKLE'; challengerId: string; carrierId: string; won: boolean; at: SimPos; style: TackleStyle })
  | (EventBase & { type: 'SKILL'; playerId: string; beatenId: string; move: SkillMove; at: SimPos })
  | (EventBase & { type: 'FOUL'; foulerId: string; victimId: string; team: TeamSide; at: SimPos; award: 'freeKick' | 'penalty'; booked: boolean })
  | (EventBase & { type: 'CLEARANCE'; playerId: string; team: TeamSide; at: SimPos })
  | (EventBase & { type: 'SHOT'; shooterId: string; team: TeamSide; from: SimPos; target: SimPos; xg: number; outcome: ShotOutcome; style: ShotStyle; blockerId?: string })
  | (EventBase & { type: 'GOAL'; scorerId: string; assistId?: string; team: TeamSide; shotEventId: number })
  | (EventBase & { type: 'SAVE'; keeperId: string; shotEventId: number; at: SimPos; held: boolean; style: SaveStyle; /** a second save from the rebound of the first */ double: boolean })
  | (EventBase & { type: 'RESTART'; kind: RestartKind; team: TeamSide; at: SimPos })
  | (EventBase & { type: 'TACTIC_APPLIED'; team: TeamSide; command: TacticCommand; expiresMinute: number; markerId?: string; markedId?: string })
  | (EventBase & { type: 'HALFTIME' })
  | (EventBase & { type: 'SUB'; team: TeamSide; outId: string; inId: string })
  | (EventBase & { type: 'FULLTIME'; home: number; away: number });

export type FootballEventType = FootballEvent['type'];

export type MatchPhase = 'play' | 'restart' | 'goal' | 'halftime' | 'fulltime';

export type PlayerAction = 'run' | 'kick' | 'tackle' | 'slide' | 'dive' | 'catch' | 'header' | 'volley' | 'skill' | 'wall' | 'celebrate' | 'stumble' | 'fouled' | 'idle';

export interface PlayerSnapshot {
  id: string;
  side: TeamSide;
  x: number;
  y: number;
  /** -1 facing left, 1 facing right (renderer flips sprites). */
  facing: -1 | 1;
  speed: number;
  action: PlayerAction;
  /** Extra detail for the action (e.g. the skill move), for presentation only. */
  detail: string | null;
  stamina: number;
}

export interface BallSnapshot {
  x: number;
  y: number;
  z: number;
  ownerId: string | null;
  state: 'owned' | 'pass' | 'shot' | 'loose' | 'dead';
}

export interface TacticState {
  /** Whole Momentum points available (0–10). */
  momentum: number;
  /** Progress towards the next point, 0..1 (0 when the bar is full). */
  momentumProgress: number;
  /** Cards that can be played now, in slot order. */
  hand: TacticCommand[];
  /** The card that replaces the next one played. */
  next: TacticCommand | null;
  /** Tick until which each card's effect lasts (exclusive); absent = not active. */
  activeUntil: Partial<Record<TacticCommand, number>>;
  /** Man-Mark pairing while it is active. */
  marking: { markerId: string; targetId: string } | null;
}

export interface MatchSnapshot {
  tick: number;
  minute: number;
  half: 1 | 2;
  phase: MatchPhase;
  score: { home: number; away: number };
  possession: TeamSide | null;
  players: PlayerSnapshot[];
  ball: BallSnapshot;
  tactics: Record<TeamSide, TacticState>;
  /** Side attacking towards y = 0 this half. */
  attackingUp: TeamSide;
}

export interface MatchStats {
  possessionTicks: Record<TeamSide, number>;
  shots: Record<TeamSide, number>;
  onTarget: Record<TeamSide, number>;
  xg: Record<TeamSide, number>;
  passes: Record<TeamSide, number>;
  passesCompleted: Record<TeamSide, number>;
  tacklesWon: Record<TeamSide, number>;
  saves: Record<TeamSide, number>;
  turnovers: Record<TeamSide, number>;
  fouls: Record<TeamSide, number>;
  skills: Record<TeamSide, number>;
  corners: Record<TeamSide, number>;
  /** Mean stamina at full time (0..1). */
  fatigue: Record<TeamSide, number>;
}

export interface PlayerMatchLine {
  playerId: string;
  side: TeamSide;
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  tacklesWon: number;
  passesCompleted: number;
  skills: number;
  fouls: number;
  rating: number;
}

export interface MatchResult {
  matchId: string;
  seed: string;
  engineVersion: string;
  score: { home: number; away: number };
  events: FootballEvent[];
  stats: MatchStats;
  players: PlayerMatchLine[];
  playerOfMatchId: string;
  commands: MatchCommand[];
}

export interface MatchCheckpoint {
  matchId: string;
  seed: string;
  engineVersion: string;
  tick: number;
  commands: MatchCommand[];
}
