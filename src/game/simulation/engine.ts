import { FORMATION_DEFS } from '../../domain/formations';
import { createRng } from '../../domain/rng';
import { assignTargets, decide } from './ai';
import {
  BALL,
  DECISION,
  ENGINE_VERSION,
  FULL_TICKS,
  GOAL_HALF_WIDTH,
  HALF_TICKS,
  MOVE,
  PITCH_L,
  PITCH_W,
  RESTART,
  STAMINA,
  TACKLE,
  TACTIC_COOLDOWN_MIN,
  TACTIC_DURATION_MIN,
  TICKS_PER_MINUTE,
} from './constants';
import { clamp, segmentDistance } from './geometry';
import { shotXg } from './shotModel';
import {
  allPlayers,
  attackGoalY,
  attacksUp,
  buildPlayers,
  depthToY,
  findPlayer,
  isTacticActive,
  keeperOf,
  other,
  ownGoalY,
  pressureAt,
  yToDepth,
  type EngineState,
  type PState,
  type ShotPlan,
} from './state';
import type {
  CommandResult,
  FootballEvent,
  MatchCheckpoint,
  MatchCommand,
  MatchSnapshot,
  MatchStats,
  RestartKind,
  ShotOutcome,
  SimPos,
  TacticCommand,
  TeamLineup,
  TeamSide,
} from './types';

export interface CreateMatchArgs {
  matchId: string;
  seed: string;
  home: TeamLineup;
  away: TeamLineup;
  /** Which side a human controls; the other is managed by the deterministic AI. */
  userSide?: TeamSide | null;
}

type EventInput = FootballEvent extends infer E ? (E extends FootballEvent ? Omit<E, 'id' | 'tick' | 'minute'> : never) : never;

const COMMANDS: readonly TacticCommand[] = ['PRESS', 'QUICK_PASS'];

function emptyStats(): MatchStats {
  const pair = () => ({ home: 0, away: 0 });
  return {
    possessionTicks: pair(),
    shots: pair(),
    onTarget: pair(),
    xg: pair(),
    passes: pair(),
    passesCompleted: pair(),
    tacklesWon: pair(),
    saves: pair(),
    turnovers: pair(),
    fatigue: { home: 1, away: 1 },
  };
}

function validateLineup(l: TeamLineup): void {
  const slots = FORMATION_DEFS[l.formation].slots.map((s) => s.id);
  const used = l.players.map((p) => p.slotId);
  if (l.players.length !== 7) throw new Error(`${l.name}: a lineup needs exactly 7 players`);
  if (new Set(used).size !== 7 || !slots.every((s) => used.includes(s))) throw new Error(`${l.name}: every formation slot needs one player`);
  if (new Set(l.players.map((p) => p.id)).size !== 7) throw new Error(`${l.name}: a player appears twice`);
}

/**
 * Pure, seeded, fixed-tick 7v7 simulation. One tick = 0.1 s of football; 12 play ticks make
 * a match minute. The engine owns the result; renderers only read snapshots and events.
 */
export class MatchEngine {
  private st: EngineState;

  constructor(args: CreateMatchArgs) {
    validateLineup(args.home);
    validateLineup(args.away);
    if (new Set([...args.home.players, ...args.away.players].map((p) => p.id)).size !== 14) throw new Error('A player cannot play for both teams');
    const ready = { PRESS: 0, QUICK_PASS: 0 };
    this.st = {
      matchId: args.matchId,
      seed: args.seed,
      rng: createRng(`${args.seed}::match`),
      tick: 0,
      playTick: 0,
      half: 1,
      phase: 'restart',
      phaseTicks: 0,
      score: { home: 0, away: 0 },
      teams: {
        home: { side: 'home', lineup: args.home, players: buildPlayers(args.home, 'home'), activeUntil: { PRESS: 0, QUICK_PASS: 0 }, readyAt: { ...ready }, controlledBy: args.userSide === 'home' ? 'user' : 'ai' },
        away: { side: 'away', lineup: args.away, players: buildPlayers(args.away, 'away'), activeUntil: { PRESS: 0, QUICK_PASS: 0 }, readyAt: { ...ready }, controlledBy: args.userSide === 'away' ? 'user' : 'ai' },
      },
      ball: { x: 50, y: 75, z: 0, vx: 0, vy: 0, state: 'dead', ownerId: null, lastTouchSide: 'home', lastTouchId: null, flight: null },
      restart: null,
      lastScorerId: null,
      events: [],
      commands: [],
      pending: [],
      stats: emptyStats(),
      lastCompletedPass: null,
      possession: null,
    };
    this.setupKickoff('home', true);
  }

  // ---------------------------------------------------------------- public API

  get engineVersion(): string {
    return ENGINE_VERSION;
  }

  isFinished(): boolean {
    return this.st.phase === 'fulltime';
  }

  advanceTicks(count: number): void {
    for (let i = 0; i < count && !this.isFinished(); i++) this.step();
  }

  /** Runs to full time and returns the number of ticks simulated. */
  runToEnd(maxTicks = 5000): number {
    const start = this.st.tick;
    while (!this.isFinished() && this.st.tick - start < maxTicks) this.step();
    if (!this.isFinished()) throw new Error('Match failed to terminate');
    return this.st.tick - start;
  }

  /**
   * Validate and queue a tactical command. It takes effect at the current tick boundary and is
   * recorded with that tick, so replays apply it at exactly the same moment.
   */
  dispatch(type: TacticCommand, side: TeamSide, atTick?: number): CommandResult {
    const st = this.st;
    if (!COMMANDS.includes(type)) return { ok: false, reason: 'Unknown command' };
    if (st.phase === 'fulltime') return { ok: false, reason: 'The match is over' };
    if (st.phase === 'halftime') return { ok: false, reason: 'Wait for the second half' };
    const tick = atTick ?? st.tick;
    if (tick !== st.tick) return { ok: false, reason: 'Commands can only be applied at the current tick' };
    const team = st.teams[side];
    if (team.activeUntil[type] > tick) return { ok: false, reason: 'Already active' };
    if (team.readyAt[type] > tick) return { ok: false, reason: `Ready in ${Math.ceil((team.readyAt[type] - tick) / TICKS_PER_MINUTE)}'` };
    if (st.pending.some((c) => c.type === type && c.side === side)) return { ok: false, reason: 'Already queued' };
    const command: MatchCommand = { type, side, tick };
    st.pending.push(command);
    return { ok: true, command };
  }

  getSnapshot(): MatchSnapshot {
    const st = this.st;
    const tactic = (side: TeamSide) => ({ activeUntil: { ...st.teams[side].activeUntil }, readyAt: { ...st.teams[side].readyAt } });
    return {
      tick: st.tick,
      minute: this.minute(),
      half: st.half,
      phase: st.phase,
      score: { ...st.score },
      possession: st.possession,
      players: allPlayers(st).map((p) => ({
        id: p.id,
        side: p.side,
        x: p.x,
        y: p.y,
        facing: p.facing,
        speed: Math.hypot(p.vx, p.vy),
        action: p.action,
        stamina: p.stamina,
      })),
      ball: { x: st.ball.x, y: st.ball.y, z: st.ball.z, ownerId: st.ball.ownerId, state: st.ball.state },
      tactics: { home: tactic('home'), away: tactic('away') },
      attackingUp: attacksUp(st, 'home') ? 'home' : 'away',
    };
  }

  getEvents(): readonly FootballEvent[] {
    return this.st.events;
  }

  getEventsSince(index: number): FootballEvent[] {
    return this.st.events.slice(index);
  }

  /** Commands issued by a human manager (AI commands are re-derived deterministically on replay). */
  getCommands(): MatchCommand[] {
    return this.st.commands.filter((c) => this.st.teams[c.side].controlledBy === 'user');
  }

  getStats(): MatchStats {
    return structuredClone(this.st.stats);
  }

  serialize(): MatchCheckpoint {
    return { matchId: this.st.matchId, seed: this.st.seed, engineVersion: ENGINE_VERSION, tick: this.st.tick, commands: this.getCommands() };
  }

  /** Tick at which a user command would be recorded right now. */
  get tick(): number {
    return this.st.tick;
  }

  minute(): number {
    return Math.min(90, Math.floor(this.st.playTick / TICKS_PER_MINUTE));
  }

  // ---------------------------------------------------------------- tick loop

  private step(): void {
    const st = this.st;
    if (st.phase === 'fulltime') return;
    if (st.phase === 'halftime') {
      this.startSecondHalf();
    }
    this.applyPending();
    this.aiManagers();

    switch (st.phase) {
      case 'goal':
        this.stepGoal();
        break;
      case 'restart':
        this.stepRestart();
        break;
      case 'play':
        this.stepPlay();
        break;
    }

    for (const p of allPlayers(st)) {
      if (p.actionTicks > 0 && --p.actionTicks === 0) p.action = 'idle';
      if (p.cooldown > 0) p.cooldown--;
      if (p.stumble > 0) p.stumble--;
    }

    st.tick++;
    st.phaseTicks++;
    if (st.phase === 'play' || st.phase === 'restart') {
      st.playTick++;
      if (st.possession) st.stats.possessionTicks[st.possession]++;
    }
    if (st.half === 1 && st.playTick >= HALF_TICKS && st.phase !== 'goal') this.halftime();
    else if (st.half === 2 && st.playTick >= FULL_TICKS && st.phase !== 'goal') this.fulltime();
  }

  private applyPending(): void {
    const st = this.st;
    if (st.pending.length === 0) return;
    const now = st.pending.filter((c) => c.tick <= st.tick);
    st.pending = st.pending.filter((c) => c.tick > st.tick);
    for (const c of now) {
      const team = st.teams[c.side];
      team.activeUntil[c.type] = st.tick + TACTIC_DURATION_MIN * TICKS_PER_MINUTE;
      team.readyAt[c.type] = st.tick + TACTIC_COOLDOWN_MIN * TICKS_PER_MINUTE;
      st.commands.push({ ...c, tick: st.tick });
      this.emit({ type: 'TACTIC_APPLIED', team: c.side, command: c.type, expiresMinute: Math.min(90, this.minute() + TACTIC_DURATION_MIN) });
    }
  }

  /** Deterministic AI manager: uses the same chips under the same rules as the player. */
  private aiManagers(): void {
    const st = this.st;
    if (st.tick % 60 !== 0 || st.phase === 'goal') return;
    for (const side of ['home', 'away'] as const) {
      const team = st.teams[side];
      if (team.controlledBy !== 'ai') continue;
      const minute = this.minute();
      const diff = st.score[side] - st.score[other(side)];
      const style = team.lineup.aiStyle;
      const ready = (c: TacticCommand) => team.readyAt[c] <= st.tick && team.activeUntil[c] <= st.tick;
      if (ready('PRESS') && ((diff < 0 && minute > 55) || (style === 'press' && minute > 8 && st.rng.chance(0.45)))) {
        this.dispatch('PRESS', side);
      } else if (ready('QUICK_PASS') && ((style === 'passing' && minute > 5 && st.rng.chance(0.4)) || (diff < 0 && minute > 70))) {
        this.dispatch('QUICK_PASS', side);
      }
      this.applyPending();
    }
  }

  // ---------------------------------------------------------------- phases

  private kickoffPositions(side: TeamSide, taking: boolean): void {
    const st = this.st;
    for (const p of st.teams[side].players) {
      let depth = Math.min(p.slot.depth * 0.85, 0.44);
      let x = p.slot.x;
      if (!taking) depth = Math.min(depth, 0.38);
      if (p.slot.position === 'GK') depth = 0.025;
      if (taking && p === this.kickoffTaker(side)) {
        depth = 0.495;
        x = 50;
      }
      p.targetX = x;
      p.targetY = depthToY(st, side, depth);
    }
  }

  private kickoffTaker(side: TeamSide): PState {
    const team = this.st.teams[side].players;
    return team.find((p) => p.slot.position === 'FWD') ?? team.find((p) => p.slot.position === 'MID') ?? (team[team.length - 1] as PState);
  }

  private setupKickoff(side: TeamSide, snap: boolean): void {
    const st = this.st;
    this.kickoffPositions(side, true);
    this.kickoffPositions(other(side), false);
    if (snap) {
      for (const p of allPlayers(st)) {
        p.x = p.targetX;
        p.y = p.targetY;
        p.vx = 0;
        p.vy = 0;
        p.facing = p.x < 50 ? 1 : -1;
      }
    }
    const taker = this.kickoffTaker(side);
    Object.assign(st.ball, { x: 50, y: 75, z: 0, vx: 0, vy: 0, state: 'dead', ownerId: null, flight: null });
    st.restart = { kind: 'kickoff', side, spot: { x: 50, y: 75 }, takerId: taker.id, waited: 0 };
    st.phase = 'restart';
    st.phaseTicks = 0;
    st.possession = side;
    this.emit({ type: 'KICKOFF', team: side, half: st.half });
  }

  private halftime(): void {
    const st = this.st;
    st.phase = 'halftime';
    st.ball.state = 'dead';
    st.ball.ownerId = null;
    st.ball.flight = null;
    st.restart = null;
    this.emit({ type: 'HALFTIME' });
  }

  private startSecondHalf(): void {
    const st = this.st;
    st.half = 2;
    for (const p of allPlayers(st)) {
      p.stamina = Math.min(1, p.stamina + STAMINA.halftimeRecovery);
      p.runTicks = 0;
      p.stumble = 0;
      p.cooldown = 0;
      p.hold = 0;
    }
    this.setupKickoff('away', true);
  }

  private fulltime(): void {
    const st = this.st;
    st.phase = 'fulltime';
    st.ball.state = 'dead';
    st.ball.ownerId = null;
    st.ball.flight = null;
    for (const side of ['home', 'away'] as const) {
      const ps = st.teams[side].players;
      st.stats.fatigue[side] = ps.reduce((s, p) => s + p.stamina, 0) / ps.length;
    }
    this.emit({ type: 'FULLTIME', home: st.score.home, away: st.score.away });
  }

  private stepGoal(): void {
    const st = this.st;
    if (st.phaseTicks < RESTART.goalCelebrateTicks) {
      // Scorer and teammates celebrate where they are; everyone else drifts.
      for (const p of allPlayers(st)) {
        const scorerSide = findPlayer(st, st.lastScorerId)?.side;
        if (p.side === scorerSide && p.slot.position !== 'GK') {
          const scorer = findPlayer(st, st.lastScorerId);
          if (scorer && p !== scorer) this.moveTowards(p, scorer.x, scorer.y, 1.4);
          else this.moveTowards(p, p.x, p.y, 0.5);
          p.action = 'celebrate';
          p.actionTicks = 2;
        } else {
          this.moveTowards(p, p.x, p.y, 0.3);
        }
      }
      return;
    }
    const conceding = other(findPlayer(st, st.lastScorerId)?.side ?? 'home');
    if (st.phaseTicks === RESTART.goalCelebrateTicks) {
      this.kickoffPositions(conceding, true);
      this.kickoffPositions(other(conceding), false);
    }
    let allHome = true;
    for (const p of allPlayers(st)) {
      this.moveTowards(p, p.targetX, p.targetY, MOVE.jogBackSpeed);
      if (Math.hypot(p.x - p.targetX, p.y - p.targetY) > 1.5) allHome = false;
    }
    if (allHome || st.phaseTicks >= RESTART.goalMaxTicks) {
      for (const p of allPlayers(st)) {
        // Any straggler is within a couple of units by now; settle him on his mark.
        p.x = p.targetX;
        p.y = p.targetY;
        p.vx = 0;
        p.vy = 0;
      }
      this.setupKickoff(conceding, false);
    }
  }

  private stepRestart(): void {
    const st = this.st;
    const r = st.restart;
    if (!r) {
      st.phase = 'play';
      return;
    }
    r.waited++;
    const taker = findPlayer(st, r.takerId);
    if (!taker) throw new Error('Restart taker missing');

    // Everyone else gets into shape; opponents respect a 9-unit distance.
    if (r.kind !== 'kickoff') assignTargets(st);
    for (const p of allPlayers(st)) {
      if (p === taker) continue;
      let tx = p.targetX;
      let ty = p.targetY;
      if (p.side !== r.side) {
        const d = Math.hypot(tx - r.spot.x, ty - r.spot.y);
        if (d < 9) {
          const k = 9 / (d || 1);
          tx = r.spot.x + (tx - r.spot.x) * k;
          ty = r.spot.y + (ty - r.spot.y) * k;
        }
      }
      this.moveTowards(p, clamp(tx, 1, 99), clamp(ty, 1, PITCH_L - 1), this.maxSpeed(p) * 0.8);
    }
    this.moveTowards(taker, r.spot.x, r.spot.y, this.maxSpeed(taker));

    const arrived = Math.hypot(taker.x - r.spot.x, taker.y - r.spot.y) < BALL.controlRadius;
    const minWait = r.kind === 'kickoff' ? RESTART.kickoffMinTicks : 4;
    if ((arrived && r.waited >= minWait) || r.waited >= RESTART.maxWaitTicks) {
      taker.x = r.spot.x;
      taker.y = r.spot.y;
      this.giveBall(taker);
      taker.hold = r.kind === 'kickoff' ? DECISION.holdTicks - 1 : 99; // restarts are played quickly
      st.restart = null;
      st.phase = 'play';
    }
  }

  private stepPlay(): void {
    const st = this.st;
    const ball = st.ball;
    assignTargets(st);

    // Carrier decision / carry.
    const carrier = findPlayer(st, ball.ownerId);
    if (carrier) this.stepCarrier(carrier);

    // Move everyone else.
    for (const p of allPlayers(st)) {
      if (p === carrier && st.ball.ownerId === p.id) continue;
      if (p.stumble > 0) {
        this.moveTowards(p, p.x, p.y, 0.2);
        continue;
      }
      this.moveTowards(p, p.targetX, p.targetY, this.maxSpeed(p));
      this.drainStamina(p);
    }

    this.stepBall();
    if (st.phase !== 'play') return;
    this.resolveTackles();
    this.resolveLooseBall();
  }

  // ---------------------------------------------------------------- carrier

  private stepCarrier(c: PState): void {
    const st = this.st;
    c.hold++;
    const pressure = pressureAt(st, c.side, c);
    const quick = isTacticActive(st, c.side, 'QUICK_PASS');
    const isKeeper = c.slot.position === 'GK';
    const holdNeeded = isKeeper ? DECISION.keeperHoldTicks : quick ? DECISION.quickPassHoldTicks : DECISION.holdTicks;
    const pressed = isTacticActive(st, other(c.side), 'PRESS');
    const mustAct = pressure > (pressed ? 0.6 : 0.9) && c.hold >= 2;

    if ((c.hold >= holdNeeded || mustAct) && c.cooldown === 0) {
      const choice = decide(st, c);
      if (choice.kind === 'shoot') {
        this.endDribble(c);
        this.shoot(c);
        return;
      }
      if (choice.kind === 'pass') {
        this.endDribble(c);
        this.pass(c, choice.to, choice.target);
        return;
      }
      if (choice.kind === 'dribble') {
        if (!c.dribbleFrom) c.dribbleFrom = { x: c.x, y: c.y };
        c.dribbleTarget = choice.target;
      } else {
        this.endDribble(c);
        c.dribbleTarget = null;
      }
      c.hold = Math.max(0, holdNeeded - 3);
    }

    const target = c.dribbleTarget ?? (isKeeper ? { x: c.x, y: c.y } : { x: c.x, y: c.y + (attackGoalY(st, c.side) === 0 ? -2 : 2) });
    this.moveTowards(c, clamp(target.x, 1, 99), clamp(target.y, 1, PITCH_L - 1), this.maxSpeed(c) * (c.dribbleTarget ? 1 : 0.4));
    this.drainStamina(c);
    // Keep the ball at his feet, slightly ahead in his running direction.
    const sp = Math.hypot(c.vx, c.vy) || 1;
    st.ball.x = clamp(c.x + (c.vx / sp) * 1.1, 0.2, PITCH_W - 0.2);
    st.ball.y = clamp(c.y + (c.vy / sp) * 1.1, 0.2, PITCH_L - 0.2);
    st.ball.z = 0;
  }

  private endDribble(c: PState): void {
    if (c.dribbleFrom && Math.hypot(c.x - c.dribbleFrom.x, c.y - c.dribbleFrom.y) > 4) {
      this.emit({ type: 'DRIBBLE', playerId: c.id, from: c.dribbleFrom, to: { x: c.x, y: c.y } });
    }
    c.dribbleFrom = null;
    c.dribbleTarget = null;
  }

  private pass(c: PState, to: PState, intended: SimPos): void {
    const st = this.st;
    const a = c.lp.attributes;
    const pressure = pressureAt(st, c.side, c);
    const d = Math.hypot(intended.x - c.x, intended.y - c.y);
    const quickUnderPress = (isTacticActive(st, c.side, 'QUICK_PASS') && pressure > 0.8 ? 1.25 : 1) * (isTacticActive(st, other(c.side), 'PRESS') ? 1 + pressure * 0.35 : 1);
    const weakFoot = c.lp.strongFoot === 'both' || c.traits.has('twoFooted') ? 1 : 1.08;
    const errRadius = d * (0.015 + ((100 - a.passing) / 100) * 0.17) * (1 + pressure * 0.7) * quickUnderPress * weakFoot * (c.traits.has('needlePass') ? 0.9 : 1);
    const target = {
      x: clamp(intended.x + st.rng.normal(0, errRadius * 0.6), 1, 99),
      y: clamp(intended.y + st.rng.normal(0, errRadius * 0.6), 1, PITCH_L - 1),
    };
    const dist = Math.hypot(target.x - c.x, target.y - c.y);
    const speed = clamp(BALL.passSpeedMin + dist * 0.035, BALL.passSpeedMin, BALL.passSpeedMax);
    const lofted = dist > BALL.loftDistance;
    this.launch('pass', c, target, Math.max(2, Math.ceil(dist / speed)), lofted ? 3 + dist * 0.05 : 0.25, to.id);
    st.stats.passes[c.side]++;
  }

  private launch(kind: 'pass' | 'shot', c: PState, to: SimPos, total: number, peakZ: number, intendedId?: string, shot?: ShotPlan): void {
    const st = this.st;
    st.ball.state = kind;
    st.ball.ownerId = null;
    st.ball.lastTouchId = c.id;
    st.ball.lastTouchSide = c.side;
    st.ball.flight = {
      kind,
      fromX: st.ball.x,
      fromY: st.ball.y,
      toX: to.x,
      toY: to.y,
      tick: 0,
      total,
      peakZ,
      side: c.side,
      kickerId: c.id,
      ...(intendedId ? { intendedId } : {}),
      ...(shot ? { shot } : {}),
    };
    c.action = 'kick';
    c.actionTicks = 3;
    c.cooldown = 4;
    c.hold = 0;
    c.facing = to.x >= c.x ? 1 : -1;
  }

  // ---------------------------------------------------------------- shooting

  private shoot(c: PState): void {
    const st = this.st;
    const side = c.side;
    const goalY = attackGoalY(st, side);
    const keeper = keeperOf(st, other(side));
    const pressure = pressureAt(st, side, c);
    const from = { x: c.x, y: c.y };
    const xg = shotXg({
      from,
      goalY,
      shooter: c.lp.attributes,
      shooterTraits: c.lp.traitIds,
      keeper: keeper?.lp.attributes ?? null,
      keeperTraits: keeper?.lp.traitIds ?? [],
      pressure,
    });

    // Aim away from the keeper.
    const keeperX = keeper?.x ?? 50;
    const aimSide = keeperX > 50 ? -1 : keeperX < 50 ? 1 : st.rng.chance(0.5) ? 1 : -1;
    const aimX = 50 + aimSide * (GOAL_HALF_WIDTH - 1.2) * st.rng.range(0.35, 1);

    // Is a defender standing in the shot lane close to the shooter?
    let blocker: PState | null = null;
    let blockT = 1;
    for (const o of st.teams[other(side)].players) {
      if (o.slot.position === 'GK') continue;
      const seg = segmentDistance(o, from, { x: aimX, y: goalY });
      if (seg.d < 2.2 && seg.t > 0.03 && seg.t < 0.6 && seg.t < blockT) {
        blocker = o;
        blockT = seg.t;
      }
    }

    const dGoal = Math.hypot(50 - c.x, goalY - c.y);
    const accuracy = (c.lp.attributes.shooting * 0.5 + c.lp.attributes.composure * 0.25 + c.lp.attributes.finishing * 0.25) / 100;
    const pOnTarget = clamp(0.25 + accuracy * 0.75 - dGoal / 220 - pressure * 0.12, 0.2, 0.9);

    let outcome: ShotOutcome;
    if (blocker && st.rng.chance(0.55)) outcome = 'blocked';
    else if (st.rng.chance(pOnTarget)) outcome = st.rng.chance(clamp(xg / pOnTarget, 0.04, 0.96)) ? 'goal' : 'saved';
    else outcome = st.rng.chance(0.1) ? 'woodwork' : 'wide';

    const dir = goalY === 0 ? -1 : 1;
    let target: SimPos;
    switch (outcome) {
      case 'goal':
        target = { x: aimX, y: goalY + dir * 2.5 };
        break;
      case 'saved': {
        // Keeper meets the ball on the shot line just in front of goal.
        const ky = goalY - dir * 2.2;
        const t = (ky - from.y) / (goalY - from.y);
        target = { x: from.x + (aimX - from.x) * t, y: ky };
        break;
      }
      case 'blocked':
        target = { x: from.x + (aimX - from.x) * blockT, y: from.y + (goalY - from.y) * blockT };
        break;
      case 'woodwork':
        target = { x: 50 + aimSide * GOAL_HALF_WIDTH, y: goalY };
        break;
      default: {
        const missBy = st.rng.range(1.5, 7);
        target = { x: clamp(50 + aimSide * (GOAL_HALF_WIDTH + missBy), 2, 98), y: goalY + dir * 3 };
      }
    }
    if (outcome === 'blocked' && !blocker) outcome = 'wide';

    const assist = st.lastCompletedPass && st.lastCompletedPass.toId === c.id && st.lastCompletedPass.side === side && st.tick - st.lastCompletedPass.tick < 100 ? st.lastCompletedPass.fromId : undefined;
    const ev = this.emit({ type: 'SHOT', shooterId: c.id, team: side, from, target, xg: Math.round(xg * 1000) / 1000, outcome, ...(outcome === 'blocked' && blocker ? { blockerId: blocker.id } : {}) });
    st.stats.shots[side]++;
    st.stats.xg[side] += xg;
    if (outcome === 'goal' || outcome === 'saved') st.stats.onTarget[side]++;

    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    this.launch('shot', c, target, Math.max(2, Math.ceil(dist / BALL.shotSpeed)), outcome === 'wide' && st.rng.chance(0.4) ? 3.5 : 1.2, undefined, {
      eventId: ev.id,
      outcome,
      keeperId: keeper?.id ?? null,
      blockerId: outcome === 'blocked' ? (blocker?.id ?? null) : null,
      ...(assist ? { assistId: assist } : {}),
      goalY,
    });
  }

  // ---------------------------------------------------------------- ball

  private stepBall(): void {
    const st = this.st;
    const b = st.ball;
    if (b.state === 'owned' || b.state === 'dead') return;

    if (b.state === 'loose') {
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= BALL.looseFriction;
      b.vy *= BALL.looseFriction;
      b.z = Math.max(0, b.z * 0.6);
      this.checkOutOfPlay();
      return;
    }

    const f = b.flight;
    if (!f) {
      b.state = 'loose';
      return;
    }
    f.tick++;
    const t = Math.min(1, f.tick / f.total);
    b.vx = (f.toX - f.fromX) / f.total;
    b.vy = (f.toY - f.fromY) / f.total;
    b.x = f.fromX + (f.toX - f.fromX) * t;
    b.y = f.fromY + (f.toY - f.fromY) * t;
    b.z = 4 * f.peakZ * t * (1 - t);

    if (f.kind === 'pass') {
      // Low passes can be cut out by anyone on the opposing side in the lane.
      if (b.z < 1.3 && f.tick > 1) {
        for (const o of st.teams[other(f.side)].players) {
          if (o.stumble > 0) continue;
          if (Math.hypot(o.x - b.x, o.y - b.y) < BALL.interceptRadius) {
            const a = o.lp.attributes;
            const p = 0.32 + (a.marking + a.tackling) / 400 + (o.slot.position === 'GK' ? 0.2 : 0);
            if (st.rng.chance(p)) {
              this.emit({ type: 'PASS', fromId: f.kickerId, toId: f.intendedId ?? '', start: { x: f.fromX, y: f.fromY }, end: { x: b.x, y: b.y }, outcome: 'intercepted', interceptedBy: o.id });
              this.giveBall(o); // counts the turnover
              return;
            }
          }
        }
      }
      if (f.tick >= f.total) this.resolvePassArrival();
      return;
    }

    // Shot in flight
    if (f.tick >= f.total) this.resolveShotArrival();
  }

  private resolvePassArrival(): void {
    const st = this.st;
    const b = st.ball;
    const f = b.flight;
    if (!f) return;
    const receiver = findPlayer(st, f.intendedId ?? null);
    const start = { x: f.fromX, y: f.fromY };
    const end = { x: b.x, y: b.y };
    if (receiver && Math.hypot(receiver.x - b.x, receiver.y - b.y) <= BALL.receiveRadius && receiver.stumble === 0) {
      const pressure = pressureAt(st, receiver.side, receiver);
      const pressedBy = isTacticActive(st, other(receiver.side), 'PRESS') ? 0.1 : 0;
      const pControl = clamp(0.72 + (receiver.lp.attributes.ballControl / 100) * 0.3 - pressure * (0.16 + pressedBy) - (f.peakZ > 2 ? 0.08 : 0), 0.4, 0.99);
      if (st.rng.chance(pControl)) {
        this.emit({ type: 'PASS', fromId: f.kickerId, toId: receiver.id, start, end, outcome: 'complete' });
        st.stats.passesCompleted[f.side]++;
        st.lastCompletedPass = { fromId: f.kickerId, toId: receiver.id, side: f.side, tick: st.tick };
        this.giveBall(receiver);
        return;
      }
    }
    this.emit({ type: 'PASS', fromId: f.kickerId, toId: f.intendedId ?? '', start, end, outcome: 'loose' });
    b.state = 'loose';
    b.flight = null;
    b.vx *= 0.5;
    b.vy *= 0.5;
    b.z = 0;
    this.checkOutOfPlay();
  }

  private resolveShotArrival(): void {
    const st = this.st;
    const b = st.ball;
    const f = b.flight;
    if (!f?.shot) return;
    const plan = f.shot;
    const shooter = findPlayer(st, f.kickerId);
    const dir = plan.goalY === 0 ? -1 : 1;

    switch (plan.outcome) {
      case 'goal': {
        st.score[f.side]++;
        st.lastScorerId = f.kickerId;
        this.emit({ type: 'GOAL', scorerId: f.kickerId, team: f.side, shotEventId: plan.eventId, ...(plan.assistId ? { assistId: plan.assistId } : {}) });
        b.state = 'dead';
        b.flight = null;
        b.vx = 0;
        b.vy = 0;
        st.phase = 'goal';
        st.phaseTicks = 0;
        st.possession = null;
        if (shooter) {
          shooter.action = 'celebrate';
          shooter.actionTicks = RESTART.goalCelebrateTicks;
        }
        const keeper = findPlayer(st, plan.keeperId);
        if (keeper) {
          keeper.action = 'dive';
          keeper.actionTicks = 8;
        }
        return;
      }
      case 'saved': {
        const keeper = findPlayer(st, plan.keeperId);
        if (!keeper) {
          b.state = 'loose';
          b.flight = null;
          return;
        }
        const a = keeper.lp.attributes;
        const held = st.rng.chance(clamp(0.35 + a.handling / 150, 0.3, 0.9));
        this.emit({ type: 'SAVE', keeperId: keeper.id, shotEventId: plan.eventId, at: { x: b.x, y: b.y }, held });
        st.stats.saves[keeper.side]++;
        keeper.action = 'dive';
        keeper.actionTicks = 7;
        keeper.x = clamp(b.x, 1, 99);
        keeper.y = clamp(b.y, 0.5, PITCH_L - 0.5);
        if (held) {
          this.giveBall(keeper);
          keeper.hold = 0;
          keeper.cooldown = 6;
        } else {
          // Parried out towards the side of the box.
          b.state = 'loose';
          b.flight = null;
          b.vx = (b.x < 50 ? -1 : 1) * st.rng.range(0.8, 1.6);
          b.vy = -dir * st.rng.range(0.9, 1.8);
          b.lastTouchSide = keeper.side;
          b.lastTouchId = keeper.id;
          keeper.stumble = 6;
        }
        return;
      }
      case 'blocked': {
        const blocker = findPlayer(st, plan.blockerId);
        b.state = 'loose';
        b.flight = null;
        b.vx = st.rng.range(-1.2, 1.2);
        b.vy = -dir * st.rng.range(0.6, 1.6);
        b.lastTouchSide = blocker?.side ?? other(f.side);
        b.lastTouchId = blocker?.id ?? null;
        if (blocker) {
          blocker.action = 'tackle';
          blocker.actionTicks = 4;
        }
        return;
      }
      case 'woodwork': {
        b.state = 'loose';
        b.flight = null;
        b.vx = st.rng.range(-1, 1);
        b.vy = -dir * st.rng.range(1, 2);
        b.y = plan.goalY - dir * 0.6;
        return;
      }
      default: {
        b.flight = null;
        this.setRestart('goalKick', other(f.side), { x: 50, y: plan.goalY - dir * 8 });
      }
    }
  }

  private checkOutOfPlay(): void {
    const st = this.st;
    const b = st.ball;
    if (b.state !== 'loose' && b.state !== 'pass') return;
    if (b.x >= 0 && b.x <= PITCH_W && b.y >= 0 && b.y <= PITCH_L) return;
    const lastSide = b.lastTouchSide;
    if (b.x < 0 || b.x > PITCH_W) {
      this.setRestart('throwIn', other(lastSide), { x: b.x < 0 ? 0.5 : PITCH_W - 0.5, y: clamp(b.y, 2, PITCH_L - 2) });
      return;
    }
    const lineY = b.y < 0 ? 0 : PITCH_L;
    // Which side defends this goal line?
    const defending: TeamSide = ownGoalY(st, 'home') === lineY ? 'home' : 'away';
    if (lastSide === defending) {
      this.setRestart('corner', other(defending), { x: b.x < 50 ? 0.8 : PITCH_W - 0.8, y: lineY === 0 ? 0.8 : PITCH_L - 0.8 });
    } else {
      this.setRestart('goalKick', defending, { x: 50, y: lineY === 0 ? 8 : PITCH_L - 8 });
    }
  }

  private setRestart(kind: RestartKind, side: TeamSide, spot: SimPos): void {
    const st = this.st;
    const team = st.teams[side].players;
    let taker: PState;
    if (kind === 'goalKick') taker = keeperOf(st, side) ?? (team[0] as PState);
    else {
      taker = [...team]
        .filter((p) => p.slot.position !== 'GK')
        .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y) || a.index - b.index)[0] as PState;
    }
    if (kind === 'corner') {
      const specialist = team.find((p) => p.traits.has('setPieceArtist'));
      if (specialist) taker = specialist;
    }
    if (st.possession !== side) st.possession = side;
    Object.assign(st.ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0, state: 'dead', ownerId: null, flight: null });
    st.restart = { kind, side, spot, takerId: taker.id, waited: 0 };
    st.phase = 'restart';
    st.phaseTicks = 0;
    for (const p of allPlayers(st)) {
      p.runTicks = 0;
      p.dribbleTarget = null;
      p.dribbleFrom = null;
    }
    this.emit({ type: 'RESTART', kind, team: side, at: spot });
  }

  private giveBall(p: PState): void {
    const st = this.st;
    const b = st.ball;
    if (st.possession && st.possession !== p.side && b.state !== 'dead') st.stats.turnovers[st.possession]++;
    b.state = 'owned';
    b.ownerId = p.id;
    b.flight = null;
    b.vx = 0;
    b.vy = 0;
    b.z = 0;
    b.lastTouchId = p.id;
    b.lastTouchSide = p.side;
    st.possession = p.side;
    p.hold = 0;
    p.runTicks = 0;
    p.dribbleTarget = null;
    p.dribbleFrom = null;
  }

  private resolveLooseBall(): void {
    const st = this.st;
    const b = st.ball;
    if (b.state !== 'loose' || b.z > 1.5) return;
    let best: { p: PState; d: number } | null = null;
    for (const p of allPlayers(st)) {
      if (p.stumble > 0) continue;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const reach = p.slot.position === 'GK' && yToDepth(st, p.side, b.y) < 0.15 ? BALL.controlRadius + 1.2 : BALL.controlRadius;
      if (d < reach && (!best || d < best.d)) best = { p, d };
    }
    if (best) {
      this.giveBall(best.p); // also records a turnover if the other side had it
    } else if (Math.hypot(b.vx, b.vy) < 0.05) {
      // A dead-still loose ball: possession is contested.
      st.possession = null;
    }
  }

  private resolveTackles(): void {
    const st = this.st;
    const b = st.ball;
    const carrier = findPlayer(st, b.ownerId);
    if (!carrier || carrier.slot.position === 'GK') return;
    const side = other(carrier.side);
    const pressing = isTacticActive(st, side, 'PRESS');
    const range = TACKLE.range + (pressing ? TACKLE.pressRangeBonus : 0);
    for (const d of st.teams[side].players) {
      if (d.cooldown > 0 || d.stumble > 0 || d.slot.position === 'GK') continue;
      if (Math.hypot(d.x - carrier.x, d.y - carrier.y) > range) continue;
      if (!st.rng.chance(pressing ? TACKLE.pressAttemptChance : TACKLE.attemptChance)) continue;
      const da = d.lp.attributes;
      const ca = carrier.lp.attributes;
      let p = TACKLE.baseSuccess + (da.tackling - ca.dribbling) / 110 + (da.strength - ca.strength) / 300 + (pressing ? TACKLE.pressSuccessBonus : 0);
      if (d.traits.has('brickWall')) p += 0.04;
      p -= (1 - d.stamina) * 0.15;
      const won = st.rng.chance(clamp(p, 0.12, 0.75));
      const at = { x: carrier.x, y: carrier.y };
      this.emit({ type: 'TACKLE', challengerId: d.id, carrierId: carrier.id, won, at });
      d.action = 'tackle';
      d.actionTicks = 4;
      d.cooldown = TACKLE.cooldownTicks;
      if (won) {
        st.stats.tacklesWon[side]++;
        this.endDribble(carrier);
        carrier.stumble = TACKLE.tackledStumbleTicks;
        carrier.action = 'stumble';
        carrier.actionTicks = TACKLE.tackledStumbleTicks;
        if (st.rng.chance(0.6)) {
          this.giveBall(d);
        } else {
          b.state = 'loose';
          b.ownerId = null;
          b.lastTouchSide = d.side;
          b.lastTouchId = d.id;
          b.vx = (carrier.x - d.x) * 0.25 + st.rng.range(-0.5, 0.5);
          b.vy = (carrier.y - d.y) * 0.25 + st.rng.range(-0.5, 0.5);
        }
      } else {
        d.stumble = TACKLE.beatenStumbleTicks;
        d.action = 'stumble';
        d.actionTicks = TACKLE.beatenStumbleTicks;
      }
      return;
    }
  }

  // ---------------------------------------------------------------- movement

  private maxSpeed(p: PState): number {
    const a = p.lp.attributes;
    let s = (MOVE.baseSpeed + (a.pace / 100) * MOVE.paceSpeed) * (0.6 + 0.4 * p.stamina);
    if (isTacticActive(this.st, p.side, 'PRESS') && this.st.possession !== p.side) s *= 1.1;
    if (this.st.ball.ownerId === p.id) s *= MOVE.carrierSpeedFactor;
    return s;
  }

  private moveTowards(p: PState, tx: number, ty: number, maxSpeed: number): void {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const desired = Math.min(maxSpeed, d * 0.45);
    const dvx = d > 0.01 ? (dx / d) * desired : 0;
    const dvy = d > 0.01 ? (dy / d) * desired : 0;
    let accel = MOVE.baseAccel + (p.lp.attributes.acceleration / 100) * MOVE.accelBonus;
    if (p.traits.has('rocketStart') && Math.hypot(p.vx, p.vy) < maxSpeed * 0.5) accel *= 1.08;
    const ax = dvx - p.vx;
    const ay = dvy - p.vy;
    const am = Math.hypot(ax, ay);
    const k = am > accel ? accel / am : 1;
    p.vx += ax * k;
    p.vy += ay * k;
    p.x = clamp(p.x + p.vx, 0.3, PITCH_W - 0.3);
    p.y = clamp(p.y + p.vy, -2, PITCH_L + 2);
    if (Math.abs(p.vx) > 0.06) p.facing = p.vx > 0 ? 1 : -1;
    if (p.action === 'idle' || p.action === 'run') {
      p.action = Math.hypot(p.vx, p.vy) > 0.15 ? 'run' : 'idle';
    }
  }

  private drainStamina(p: PState): void {
    const st = this.st;
    const speed = Math.hypot(p.vx, p.vy);
    const sprint = Math.max(0, speed / (MOVE.baseSpeed + MOVE.paceSpeed) - 0.55);
    const pressing = isTacticActive(st, p.side, 'PRESS');
    let mult = pressing && st.possession !== p.side ? STAMINA.pressMultiplier : 1;
    if (p.traits.has('ironLungs')) mult *= 0.8;
    const fitness = 1.15 - (p.lp.attributes.stamina / 100) * 0.5;
    const base = STAMINA.baseDrain * (pressing ? 1.6 : 1);
    p.stamina = Math.max(0.05, p.stamina - (base + sprint * STAMINA.sprintDrain * mult) * fitness);
  }

  private emit(e: EventInput): FootballEvent {
    const ev = { ...e, id: this.st.events.length + 1, tick: this.st.tick, minute: this.minute() } as FootballEvent;
    this.st.events.push(ev);
    return ev;
  }

  /** Test/debug access to raw positions. Never use from presentation code. */
  debugState(): Readonly<EngineState> {
    return this.st;
  }
}

export function createMatch(args: CreateMatchArgs): MatchEngine {
  return new MatchEngine(args);
}
