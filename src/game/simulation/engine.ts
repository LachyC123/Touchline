import { FORMATION_DEFS } from '../../domain/formations';
import { createRng } from '../../domain/rng';
import { assignTargets, decide } from './ai';
import {
  AERIAL,
  BALL,
  DECISION,
  FOUL,
  ENGINE_VERSION,
  FULL_TICKS,
  GOAL_HALF_WIDTH,
  HALF_TICKS,
  MOVE,
  PITCH_L,
  PITCH_W,
  REBOUND_TICKS,
  RESTART,
  SETPIECE,
  SKILL,
  SLIDE,
  STAMINA,
  TACKLE,
  TICKS_PER_MINUTE,
} from './constants';
import { clamp, segmentDistance } from './geometry';
import { AI_DECKS, CARD_DEFS, DECK_MAX, DECK_MIN, DEFAULT_DECK, HAND_SIZE, MOMENTUM, isCardId, type CardId } from './cards';
import { keeperSkill, shotXg } from './shotModel';
import {
  allPlayers,
  attackGoalY,
  attacksUp,
  buildPlayers,
  depthToY,
  findPlayer,
  inOwnBox,
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
  SaveStyle,
  ShotOutcome,
  ShotStyle,
  SimPos,
  SkillMove,
  TackleStyle,
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

/** A valid brought deck (3–5 distinct cards), else the default for this bench. */
function deckOf(l: TeamLineup, controlled: boolean): CardId[] {
  const d = l.deck;
  if (d && d.length >= DECK_MIN && d.length <= DECK_MAX && new Set(d).size === d.length && d.every(isCardId)) return [...d];
  return [...(controlled ? DEFAULT_DECK : AI_DECKS[l.aiStyle])];
}

function teamState(l: TeamLineup, side: TeamSide, controlledBy: 'user' | 'ai'): EngineState['teams'][TeamSide] {
  const deck = deckOf(l, controlledBy === 'user');
  return {
    side,
    lineup: l,
    players: buildPlayers(l, side),
    activeUntil: {},
    momentum: MOMENTUM.start,
    momentumTicks: 0,
    hand: deck.slice(0, HAND_SIZE),
    queue: deck.slice(HAND_SIZE),
    marking: null,
    controlledBy,
  };
}

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
    fouls: pair(),
    skills: pair(),
    corners: pair(),
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
        home: teamState(args.home, 'home', args.userSide === 'home' ? 'user' : 'ai'),
        away: teamState(args.away, 'away', args.userSide === 'away' ? 'user' : 'ai'),
      },
      ball: { x: 50, y: 75, z: 0, vx: 0, vy: 0, state: 'dead', ownerId: null, lastTouchSide: 'home', lastTouchId: null, flight: null },
      restart: null,
      lastScorerId: null,
      events: [],
      commands: [],
      pending: [],
      stats: emptyStats(),
      lastCompletedPass: null,
      lastSave: null,
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
    if (!isCardId(type)) return { ok: false, reason: 'Unknown card' };
    if (st.phase === 'fulltime') return { ok: false, reason: 'The match is over' };
    if (st.phase === 'halftime') return { ok: false, reason: 'Wait for the second half' };
    const tick = atTick ?? st.tick;
    if (tick !== st.tick) return { ok: false, reason: 'Commands can only be applied at the current tick' };
    const team = st.teams[side];
    if (!team.hand.includes(type)) return { ok: false, reason: 'That card is not in your hand' };
    if ((team.activeUntil[type] ?? 0) > tick) return { ok: false, reason: 'Already active' };
    const queuedCost = st.pending.filter((c) => c.side === side).reduce((sum, c) => sum + CARD_DEFS[c.type].cost, 0);
    if (team.momentum - queuedCost < CARD_DEFS[type].cost) return { ok: false, reason: `Needs ${CARD_DEFS[type].cost} Momentum` };
    if (st.pending.some((c) => c.type === type && c.side === side)) return { ok: false, reason: 'Already queued' };
    const command: MatchCommand = { type, side, tick };
    st.pending.push(command);
    return { ok: true, command };
  }

  getSnapshot(): MatchSnapshot {
    const st = this.st;
    const tactic = (side: TeamSide) => {
      const t = st.teams[side];
      return {
        momentum: t.momentum,
        momentumProgress: t.momentum >= MOMENTUM.max ? 0 : t.momentumTicks / MOMENTUM.regenTicks,
        hand: [...t.hand],
        next: t.queue[0] ?? null,
        activeUntil: { ...t.activeUntil },
        marking: t.marking && (t.activeUntil.MAN_MARK ?? 0) > st.tick ? { ...t.marking } : null,
      };
    };
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
        detail: p.detail,
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
      if (p.actionTicks > 0 && --p.actionTicks === 0) {
        p.action = 'idle';
        p.detail = null;
        p.diveTarget = null;
      }
      if (p.cooldown > 0) p.cooldown--;
      if (p.stumble > 0) p.stumble--;
      if (p.firstTime > 0) p.firstTime--;
    }

    st.tick++;
    st.phaseTicks++;
    if (st.phase === 'play' || st.phase === 'restart') {
      st.playTick++;
      this.regenMomentum();
      if (st.possession) st.stats.possessionTicks[st.possession]++;
    }
    // The whistle waits for a goal celebration, a penalty to be taken and any shot in flight.
    const canBlow = st.phase !== 'goal' && st.restart?.kind !== 'penalty' && st.ball.state !== 'shot';
    if (st.half === 1 && st.playTick >= HALF_TICKS && canBlow) this.halftime();
    else if (st.half === 2 && st.playTick >= FULL_TICKS && canBlow) this.fulltime();
  }

  private applyPending(): void {
    const st = this.st;
    if (st.pending.length === 0) return;
    const now = st.pending.filter((c) => c.tick <= st.tick);
    st.pending = st.pending.filter((c) => c.tick > st.tick);
    for (const c of now) this.playCard(c);
  }

  /** Spend Momentum, cycle the hand and start the card's effect on the simulation. */
  private playCard(c: MatchCommand): void {
    const st = this.st;
    const team = st.teams[c.side];
    const def = CARD_DEFS[c.type];
    const slot = team.hand.indexOf(c.type);
    if (slot < 0 || team.momentum < def.cost) return; // validated at dispatch; defensive
    team.momentum -= def.cost;
    // Played card goes to the back of the draw pile; the next card takes its slot.
    const drawn = team.queue.shift();
    team.queue.push(c.type);
    if (drawn !== undefined) team.hand[slot] = drawn;
    else team.hand.splice(slot, 1, c.type);
    if (def.shape) {
      for (const other of ['PARK_BUS', 'ALL_OUT'] as const) if (other !== c.type) delete team.activeUntil[other];
    }
    const minutes = def.durationMin > 0 ? def.durationMin : 0;
    team.activeUntil[c.type] = st.tick + Math.max(1, minutes * TICKS_PER_MINUTE);
    let extra: { markerId?: string; markedId?: string } = {};
    if (c.type === 'HAIRDRYER') {
      for (const p of team.players) p.stamina = Math.min(1, p.stamina + 0.15);
    }
    if (c.type === 'MAN_MARK') {
      const threat = (p: PState) => p.lp.attributes.finishing + p.lp.attributes.dribbling + p.lp.attributes.pace;
      const guard = (p: PState) => p.lp.attributes.marking * 1.2 + p.lp.attributes.tackling + (p.slot.position === 'DEF' ? 20 : 0);
      const target = [...st.teams[other(c.side)].players].filter((p) => p.slot.position !== 'GK').sort((a, b) => threat(b) - threat(a) || a.index - b.index)[0];
      const marker = [...team.players].filter((p) => p.slot.position !== 'GK').sort((a, b) => guard(b) - guard(a) || a.index - b.index)[0];
      if (target && marker) {
        team.marking = { markerId: marker.id, targetId: target.id };
        extra = { markerId: marker.id, markedId: target.id };
      }
    }
    st.commands.push({ ...c, tick: st.tick });
    this.emit({ type: 'TACTIC_APPLIED', team: c.side, command: c.type, expiresMinute: Math.min(90, this.minute() + minutes), ...extra });
  }

  /** Momentum fills during play (not during goal celebrations or the break). A full bar wastes regen. */
  private regenMomentum(): void {
    for (const side of ['home', 'away'] as const) {
      const team = this.st.teams[side];
      if (team.momentum >= MOMENTUM.max) {
        team.momentumTicks = 0;
        continue;
      }
      if (++team.momentumTicks >= MOMENTUM.regenTicks) {
        team.momentum++;
        team.momentumTicks = 0;
      }
    }
  }

  /**
   * Deterministic AI manager: plays the same cards under the same Momentum rules as the
   * player, reading the score, the clock and its own style.
   */
  private aiManagers(): void {
    const st = this.st;
    if (st.tick % 30 !== 0 || st.phase === 'goal' || st.phase === 'halftime') return;
    for (const side of ['home', 'away'] as const) {
      const team = st.teams[side];
      if (team.controlledBy !== 'ai') continue;
      const minute = this.minute();
      const diff = st.score[side] - st.score[other(side)];
      const style = team.lineup.aiStyle;
      const tiredness = 1 - team.players.reduce((s, p) => s + p.stamina, 0) / team.players.length;
      const want = (c: CardId): number => {
        if (!team.hand.includes(c) || (team.activeUntil[c] ?? 0) > st.tick || team.momentum < CARD_DEFS[c].cost) return -1;
        switch (c) {
          case 'ALL_OUT':
            return diff < 0 && minute > 60 ? 3 : -1;
          case 'PARK_BUS':
            return diff > 0 && minute > 70 ? 3 : style === 'counter' && diff >= 0 && minute > 30 ? 1 : -1;
          case 'HAIRDRYER':
            return tiredness > 0.22 || (diff < 0 && minute > 45) ? 2 : -1;
          case 'PRESS':
            return (diff < 0 && minute > 50 ? 2 : 0) + (style === 'press' && minute > 8 ? 1.5 : 0) + (diff > 1 ? -2 : 0) || (minute > 15 ? 0.4 : -1);
          case 'QUICK_PASS':
            return (style === 'passing' ? 1.5 : 0.5) + (diff < 0 && minute > 70 ? 1 : 0);
          case 'GO_WIDE':
            return style === 'direct' || style === 'balanced' ? 1 : 0.4;
          case 'TARGET_MAN':
            return style === 'direct' ? 1.4 : 0.5;
          case 'MAN_MARK':
            return minute > 10 ? (style === 'counter' || style === 'passing' ? 1.3 : 0.6) : -1;
        }
      };
      // Save up a little unless the moment is right; spend when the bar is nearly full.
      const best = team.hand.map((c) => ({ c, w: want(c) })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w || CARD_DEFS[b.c].cost - CARD_DEFS[a.c].cost)[0];
      if (!best) continue;
      const urgency = best.w >= 2 || team.momentum >= 8 ? 0.8 : 0.25;
      if (st.rng.chance(urgency)) {
        this.dispatch(best.c, side);
        this.applyPending();
      }
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
    st.restart = { kind: 'kickoff', side, spot: { x: 50, y: 75 }, takerId: taker.id, waited: 0, wall: [], direct: false };
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
      p.firstTime = 0;
      p.diveTarget = null;
    }
    st.lastSave = null;
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
    const goalY = attackGoalY(st, r.side);
    const dirOut = goalY === 0 ? 1 : -1;
    for (const p of allPlayers(st)) {
      if (p === taker) continue;
      let tx = p.targetX;
      let ty = p.targetY;
      const wallSpot = r.wall.find((w) => w.id === p.id);
      if (r.kind === 'penalty') {
        // Only the taker and the keeper may be in the box.
        if (p.slot.position === 'GK' && p.side !== r.side) {
          tx = 50;
          ty = goalY + dirOut * 0.8;
        } else if (Math.abs(ty - goalY) < 23 && Math.abs(tx - 50) < 26) {
          ty = goalY + dirOut * 24;
        }
      } else if (wallSpot) {
        tx = wallSpot.x;
        ty = wallSpot.y;
        if (Math.hypot(p.x - tx, p.y - ty) < 1.5) {
          p.action = 'wall';
          p.actionTicks = 2;
        }
      } else if (p.side !== r.side) {
        const d = Math.hypot(tx - r.spot.x, ty - r.spot.y);
        if (d < 9) {
          const k = 9 / (d || 1);
          tx = r.spot.x + (tx - r.spot.x) * k;
          ty = r.spot.y + (ty - r.spot.y) * k;
        }
      }
      this.moveTowards(p, clamp(tx, 1, 99), clamp(ty, 0.5, PITCH_L - 0.5), this.maxSpeed(p) * (wallSpot ? 1 : 0.8));
    }
    this.moveTowards(taker, r.spot.x, r.spot.y, this.maxSpeed(taker));

    const arrived = Math.hypot(taker.x - r.spot.x, taker.y - r.spot.y) < BALL.controlRadius;
    const minWait = r.kind === 'kickoff' ? RESTART.kickoffMinTicks : r.kind === 'penalty' ? SETPIECE.penaltyWait : r.kind === 'freeKick' ? SETPIECE.freeKickWait : 4;
    if ((arrived && r.waited >= minWait) || r.waited >= RESTART.maxWaitTicks) {
      taker.x = r.spot.x;
      taker.y = r.spot.y;
      this.giveBall(taker);
      st.restart = null;
      st.phase = 'play';
      this.takeRestart(taker, r);
    }
  }

  /** Corners are crossed, penalties struck, direct free kicks usually shot; the rest are played quickly. */
  private takeRestart(taker: PState, r: NonNullable<EngineState['restart']>): void {
    const st = this.st;
    taker.hold = r.kind === 'kickoff' ? DECISION.holdTicks - 1 : 99;
    taker.restartKind = r.kind;
    if (r.kind === 'penalty') {
      this.shoot(taker, 'penalty');
      return;
    }
    if (r.kind === 'freeKick' && r.direct) {
      const a = taker.lp.attributes;
      if (st.rng.chance(clamp(0.45 + a.setPieces / 220 + (taker.traits.has('setPieceArtist') ? 0.1 : 0), 0.4, 0.92))) {
        this.shoot(taker, 'freeKick', r.wall);
        return;
      }
    }
    if (r.kind === 'corner' || (r.kind === 'freeKick' && yToDepth(st, taker.side, taker.y) > 0.62)) {
      const target = this.crossTarget(taker);
      if (target) this.crossTo(taker, target);
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
      if (p.action === 'dive' && p.diveTarget) {
        // A committed dive: fast, straight, no steering.
        const dx = p.diveTarget.x - p.x;
        const dy = p.diveTarget.y - p.y;
        const d = Math.hypot(dx, dy);
        const step = Math.min(d, 0.9 + (p.lp.attributes.reach / 100) * 0.7);
        if (d > 0.01) {
          p.x = clamp(p.x + (dx / d) * step, 0.3, PITCH_W - 0.3);
          p.y = clamp(p.y + (dy / d) * step, -2, PITCH_L + 2);
        }
        p.vx = 0;
        p.vy = 0;
        continue;
      }
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
    // Rebounds and knock-downs are hit first time.
    if (c.firstTime > 0 && c.slot.position !== 'GK') {
      c.firstTime = 0;
      const dGoal = Math.hypot(50 - c.x, attackGoalY(st, c.side) - c.y);
      if (dGoal < AERIAL.headerRange + 4 && st.rng.chance(0.85)) {
        this.endDribble(c);
        this.shoot(c, 'volley');
        return;
      }
    }
    if (this.takeOn(c)) return;
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
      if (choice.kind === 'cross') {
        this.endDribble(c);
        this.crossTo(c, choice.to);
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
    // A rainbow flick lifts the ball over the defender for a moment.
    st.ball.z = c.action === 'skill' && c.detail === 'flick' ? 2.4 * Math.sin((Math.PI * (SKILL.actionTicks - c.actionTicks)) / SKILL.actionTicks) : 0;
  }

  /**
   * A dribbler running at a defender may take him on. The duel is skill against skill:
   * success is a named skill move and a beaten defender; failure loses the ball.
   */
  private takeOn(c: PState): boolean {
    const st = this.st;
    if (!c.dribbleTarget || c.cooldown > 0 || c.slot.position === 'GK' || c.action === 'skill') return false;
    const fwd = attackGoalY(st, c.side) === 0 ? -1 : 1;
    let d: PState | null = null;
    let best = SKILL.takeOnRange;
    for (const o of st.teams[other(c.side)].players) {
      if (o.slot.position === 'GK' || o.stumble > 0) continue;
      const ahead = (o.y - c.y) * fwd;
      const dist = Math.hypot(o.x - c.x, o.y - c.y);
      if (ahead > -0.5 && dist < best) {
        d = o;
        best = dist;
      }
    }
    if (!d) return false;
    const ca = c.lp.attributes;
    if (!st.rng.chance(SKILL.takeOnChance * (ca.dribbling / 70) * (ca.dribbling / 70))) return false;
    const da = d.lp.attributes;
    const p = clamp(0.32 + (ca.dribbling - da.tackling) / 85 + (ca.ballControl - 50) / 300 + (ca.acceleration - da.pace) / 400 - (1 - c.stamina) * 0.15, 0.08, 0.82);
    if (st.rng.chance(p)) {
      this.skillMove(c, d, best);
      return true;
    }
    // Stopped: the defender reads it.
    this.emit({ type: 'TACKLE', challengerId: d.id, carrierId: c.id, won: true, at: { x: c.x, y: c.y }, style: 'standing' });
    st.stats.tacklesWon[d.side]++;
    d.action = 'tackle';
    d.actionTicks = 4;
    d.cooldown = TACKLE.cooldownTicks;
    this.endDribble(c);
    c.stumble = TACKLE.tackledStumbleTicks;
    c.action = 'stumble';
    c.actionTicks = TACKLE.tackledStumbleTicks;
    this.giveBall(d);
    return true;
  }

  private skillMove(c: PState, beaten: PState, dist: number): void {
    const st = this.st;
    const a = c.lp.attributes;
    const moves: [SkillMove, number][] = [
      ['stepover', 3],
      ['dragBack', 2],
      ['roulette', a.ballControl > 60 ? 2 : 0.6],
      ['nutmeg', dist < 2.2 ? 2.2 : 0.6],
      ['flick', a.dribbling > 72 ? 1.4 : 0.15],
    ];
    const move = st.rng.weighted(moves);
    this.emit({ type: 'SKILL', playerId: c.id, beatenId: beaten.id, move, at: { x: c.x, y: c.y } });
    st.stats.skills[c.side]++;
    c.action = 'skill';
    c.detail = move;
    c.actionTicks = SKILL.actionTicks;
    c.cooldown = 6;
    beaten.stumble = SKILL.beatenStumbleTicks;
    beaten.action = 'stumble';
    beaten.actionTicks = SKILL.beatenStumbleTicks;
    beaten.cooldown = TACKLE.cooldownTicks;
    // Burst past him.
    const fwd = attackGoalY(st, c.side) === 0 ? -1 : 1;
    c.vy += fwd * 0.35;
    c.vx += (c.x < beaten.x ? -1 : 1) * 0.25;
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
    // Quick Pass is the answer to a press: one-touch balls don't give the pressers time to bite.
    const quick = isTacticActive(st, c.side, 'QUICK_PASS');
    const quickUnderPress = isTacticActive(st, other(c.side), 'PRESS') ? (quick ? 0.9 : 1 + pressure * 0.35) : 1;
    const weakFoot = c.lp.strongFoot === 'both' || c.traits.has('twoFooted') ? 1 : 1.08;
    const calm = isTacticActive(st, c.side, 'HAIRDRYER') ? 0.6 : 1;
    const errRadius = d * (0.015 + ((100 - a.passing) / 100) * 0.17) * (1 + pressure * 0.7 * calm) * quickUnderPress * weakFoot * (c.traits.has('needlePass') ? 0.9 : 1);
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

  /** Best aerial target in the box for a cross, if anyone is there. */
  private crossTarget(c: PState): PState | undefined {
    const st = this.st;
    if (isTacticActive(st, c.side, 'TARGET_MAN')) {
      const tm = this.targetManOf(c.side);
      if (tm && tm !== c && tm.stumble === 0) return tm;
    }
    const goalY = attackGoalY(st, c.side);
    return st.teams[c.side].players
      .filter((t) => t !== c && t.slot.position !== 'GK' && t.stumble === 0 && Math.abs(t.y - goalY) < 30 && Math.abs(t.x - 50) < 20)
      .sort((x, y) => y.lp.attributes.strength + y.lp.attributes.finishing - (x.lp.attributes.strength + x.lp.attributes.finishing) || x.index - y.index)[0];
  }

  private crossTo(c: PState, to: PState): void {
    const st = this.st;
    const a = c.lp.attributes;
    const goalY = attackGoalY(st, c.side);
    // Aim at the runner, a little towards goal; delivery quality decides how close it lands.
    const delivery = c.restartKind === 'corner' || c.restartKind === 'freeKick' ? a.setPieces : a.passing;
    const err = 1.2 + ((100 - delivery) / 100) * 6 - (c.traits.has('setPieceArtist') ? 1 : 0);
    const aim = { x: clamp(to.x + (50 - to.x) * 0.2, 30, 70), y: clamp(to.y + (goalY - to.y) * 0.25, 3, PITCH_L - 3) };
    const target = { x: clamp(aim.x + st.rng.normal(0, err * 0.6), 2, 98), y: clamp(aim.y + st.rng.normal(0, err * 0.5), 1, PITCH_L - 1) };
    const dist = Math.hypot(target.x - c.x, target.y - c.y);
    this.launch('pass', c, target, Math.max(4, Math.ceil(dist / 3.4)), AERIAL.crossPeak + dist * 0.02, to.id);
    if (st.ball.flight) st.ball.flight.cross = true;
    st.stats.passes[c.side]++;
    c.restartKind = null;
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

  private shoot(c: PState, forced?: ShotStyle, wall: { id: string }[] = []): void {
    const st = this.st;
    const side = c.side;
    const goalY = attackGoalY(st, side);
    const keeper = keeperOf(st, other(side));
    const from = { x: c.x, y: c.y };
    const dGoal = Math.hypot(50 - c.x, goalY - c.y);
    const style: ShotStyle = forced === 'volley' && st.ball.z < 0.6 && dGoal > 26 ? 'long' : (forced ?? (dGoal > 26 ? 'long' : 'normal'));
    const setPiece = style === 'penalty' || style === 'freeKick';
    const pressure = setPiece ? 0 : Math.min(1.5, pressureAt(st, side, c) * (isTacticActive(st, side, 'HAIRDRYER') ? 0.6 : 1) + (this.markerNear(c, 5) ? 0.4 : 0));
    const keeperDown = Boolean(keeper && (keeper.stumble > 0 || keeper.action === 'dive'));
    const xg = shotXg({
      from,
      goalY,
      shooter: c.lp.attributes,
      shooterTraits: c.lp.traitIds,
      keeper: keeper?.lp.attributes ?? null,
      keeperTraits: keeper?.lp.traitIds ?? [],
      pressure,
      style,
      keeperDown,
    });
    const a = c.lp.attributes;
    const dir = goalY === 0 ? -1 : 1;
    const keeperX = keeper?.x ?? 50;

    let outcome: ShotOutcome;
    let aimX: number;
    let blocker: PState | null = null;
    let blockT = 1;
    let diveX: number | undefined;

    if (style === 'penalty') {
      // Taker picks a side; keeper guesses. Same corner = a genuine chance to save it.
      const aimSide = st.rng.weighted<-1 | 0 | 1>([[-1, 42], [0, 12], [1, 46]]);
      const guess = st.rng.weighted<-1 | 0 | 1>([[-1, 45], [0, 10], [1, 45]]);
      aimX = 50 + aimSide * (GOAL_HALF_WIDTH - 1.4) * st.rng.range(0.6, 1);
      diveX = 50 + guess * (GOAL_HALF_WIDTH - 1);
      const pMiss = clamp(0.05 + (60 - a.composure) / 400 - (c.traits.has('bigGame') ? 0.02 : 0), 0.02, 0.14);
      const ks = keeper ? keeperSkill(keeper.lp.attributes) : 0;
      if (st.rng.chance(pMiss)) outcome = st.rng.chance(0.3) ? 'woodwork' : 'wide';
      else if (keeper && guess === aimSide && st.rng.chance(clamp(0.45 + ks / 260 - a.setPieces / 500, 0.3, 0.75))) outcome = 'saved';
      else if (keeper && aimSide === 0 && guess === 0) outcome = 'saved';
      else outcome = 'goal';
    } else {
      // Aim away from the keeper.
      const aimSide = keeperX > 50 ? -1 : keeperX < 50 ? 1 : st.rng.chance(0.5) ? 1 : -1;
      aimX = 50 + aimSide * (GOAL_HALF_WIDTH - 1.2) * st.rng.range(0.35, 1);
      // Is a defender standing in the shot lane close to the shooter (or a wall)?
      for (const o of st.teams[other(side)].players) {
        if (o.slot.position === 'GK') continue;
        const seg = segmentDistance(o, from, { x: aimX, y: goalY });
        if (seg.d < 2.2 && seg.t > 0.03 && seg.t < 0.6 && seg.t < blockT) {
          blocker = o;
          blockT = seg.t;
        }
      }
      const inWall = Boolean(blocker && wall.some((w) => w.id === blocker?.id));
      const accuracy = (a.shooting * 0.5 + a.composure * 0.25 + a.finishing * 0.25) / 100;
      let pOnTarget = clamp(0.25 + accuracy * 0.75 - dGoal / 220 - pressure * 0.12, 0.2, 0.9);
      if (style === 'header') pOnTarget = clamp(0.25 + (a.strength * 0.4 + a.finishing * 0.6) / 160 - dGoal / 160, 0.2, 0.75);
      if (style === 'freeKick') pOnTarget = clamp(0.3 + a.setPieces / 220, 0.3, 0.75);
      const pBlock = style === 'freeKick' ? (inWall ? clamp(0.32 - a.setPieces / 400, 0.12, 0.3) : 0) : style === 'header' ? 0.25 : 0.55;
      if (blocker && st.rng.chance(pBlock)) outcome = 'blocked';
      else if (st.rng.chance(pOnTarget)) outcome = st.rng.chance(clamp(xg / pOnTarget, 0.04, 0.96)) ? 'goal' : 'saved';
      else outcome = st.rng.chance(style === 'freeKick' || style === 'long' ? 0.14 : 0.1) ? 'woodwork' : 'wide';
      if (outcome === 'blocked' && !blocker) outcome = 'wide';
      if (keeper) {
        // Where the keeper's dive ends: on the ball for a save, short of it for a goal.
        const reach = 2 + keeper.lp.attributes.reach / 40;
        const gap = aimX - keeper.x;
        diveX = outcome === 'saved' ? aimX : keeper.x + Math.sign(gap) * Math.min(Math.abs(gap) * 0.8, reach);
      }
    }

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
        target = { x: 50 + Math.sign(aimX - 50 || 1) * GOAL_HALF_WIDTH, y: goalY };
        break;
      default: {
        const missBy = st.rng.range(1.5, 7);
        target = { x: clamp(50 + Math.sign(aimX - 50 || 1) * (GOAL_HALF_WIDTH + missBy), 2, 98), y: goalY + dir * 3 };
      }
    }

    // Save type, decided with the shot so the keeper visibly reacts before it arrives.
    let save: { style: SaveStyle; held: boolean; double: boolean } | undefined;
    if (outcome === 'saved' && keeper) {
      const ka = keeper.lp.attributes;
      const gap = Math.abs(target.x - keeper.x);
      const high = style === 'long' || style === 'freeKick' || style === 'header';
      const routine = style !== 'penalty' && (gap < 3.4 || (style === 'long' && gap < 5 && st.rng.chance(0.5)));
      let saveStyle: SaveStyle = routine ? 'catch' : high && st.rng.chance(0.4) ? 'fingertip' : 'dive';
      let held = saveStyle === 'catch' ? st.rng.chance(clamp(0.55 + ka.handling / 220, 0.55, 0.94)) : saveStyle === 'dive' ? st.rng.chance(clamp(0.2 + ka.handling / 300, 0.2, 0.5)) : false;
      if (keeperDown) held = false;
      if (!held && saveStyle !== 'fingertip') saveStyle = 'parry';
      const double = Boolean(st.lastSave && st.lastSave.keeperId === keeper.id && st.tick - st.lastSave.tick < REBOUND_TICKS + 12);
      save = { style: saveStyle, held, double };
      if (saveStyle === 'catch') diveX = undefined;
    }

    const assist = st.lastCompletedPass && st.lastCompletedPass.toId === c.id && st.lastCompletedPass.side === side && st.tick - st.lastCompletedPass.tick < 100 ? st.lastCompletedPass.fromId : undefined;
    const ev = this.emit({ type: 'SHOT', shooterId: c.id, team: side, from, target, xg: Math.round(xg * 1000) / 1000, outcome, style, ...(outcome === 'blocked' && blocker ? { blockerId: blocker.id } : {}) });
    st.stats.shots[side]++;
    st.stats.xg[side] += xg;
    if (outcome === 'goal' || outcome === 'saved') st.stats.onTarget[side]++;

    const dist = Math.hypot(target.x - from.x, target.y - from.y);
    const speed = style === 'header' ? BALL.shotSpeed * 0.7 : style === 'freeKick' ? BALL.shotSpeed * 0.85 : BALL.shotSpeed;
    const peak = style === 'freeKick' ? 2.6 : style === 'long' ? 1.8 : style === 'header' ? 0.9 : outcome === 'wide' && st.rng.chance(0.4) ? 3.5 : 1.2;
    this.launch('shot', c, target, Math.max(2, Math.ceil(dist / speed)), peak, undefined, {
      eventId: ev.id,
      outcome,
      style,
      keeperId: keeper?.id ?? null,
      blockerId: outcome === 'blocked' ? (blocker?.id ?? null) : null,
      ...(assist ? { assistId: assist } : {}),
      goalY,
      ...(save ? { save } : {}),
      ...(diveX !== undefined ? { diveX } : {}),
      ...(outcome === 'wide' && !setPiece && st.rng.chance(blocker || pressure > 0.5 ? 0.45 : 0.15) ? { deflected: true } : {}),
    });
    c.restartKind = null;
    if (style === 'header' || style === 'volley') {
      c.action = style;
      c.actionTicks = 5;
    }
    // Penalty keepers commit as the ball is struck.
    if (style === 'penalty' && keeper && diveX !== undefined) this.startDive(keeper, diveX);
  }

  private startDive(keeper: PState, toX: number): void {
    if (Math.abs(toX - keeper.x) < 1.2) {
      keeper.action = 'catch';
      keeper.actionTicks = 7;
      return;
    }
    keeper.action = 'dive';
    keeper.actionTicks = 15;
    keeper.facing = toX >= keeper.x ? 1 : -1;
    keeper.diveTarget = { x: clamp(toX, 40, 60), y: keeper.y };
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

    // Shot in flight: the keeper reacts in the last moments (dive, or set to catch).
    const plan = f.shot;
    if (plan && f.total - f.tick <= 4 && f.total - f.tick >= 1) {
      const keeper = findPlayer(st, plan.keeperId);
      if (keeper && keeper.action !== 'dive' && keeper.action !== 'catch' && keeper.stumble === 0) {
        if (plan.save?.style === 'catch') {
          keeper.action = 'catch';
          keeper.actionTicks = 7;
        } else if (plan.diveX !== undefined && (plan.outcome === 'saved' || plan.outcome === 'goal' || Math.abs(f.toX - keeper.x) < 9)) {
          this.startDive(keeper, plan.diveX);
        }
      }
    }
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
    if (f.cross) {
      this.resolveCross(f, receiver, start, end);
      return;
    }
    if (receiver && Math.hypot(receiver.x - b.x, receiver.y - b.y) <= BALL.receiveRadius && receiver.stumble === 0) {
      const pressure = pressureAt(st, receiver.side, receiver);
      const pressedBy = isTacticActive(st, other(receiver.side), 'PRESS') ? 0.1 : 0;
      const calm = isTacticActive(st, receiver.side, 'HAIRDRYER') ? 0.6 : 1;
      const shadowed = this.markerNear(receiver, 4) ? 0.1 : 0;
      const pControl = clamp(0.72 + (receiver.lp.attributes.ballControl / 100) * 0.3 - pressure * (0.16 + pressedBy) * calm - shadowed - (f.peakZ > 2 ? 0.08 : 0), 0.4, 0.99);
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

  /**
   * A cross arrives: the keeper may claim it, otherwise the nearest attacker and defender go
   * up for it. Strength and timing decide the header; the attacker's header is a real shot.
   */
  private resolveCross(f: NonNullable<EngineState['ball']['flight']>, receiver: PState | undefined, start: SimPos, end: SimPos): void {
    const st = this.st;
    const b = st.ball;
    const defSide = other(f.side);
    const near = (list: PState[]) =>
      list
        .filter((p) => p.stumble === 0 && Math.hypot(p.x - end.x, p.y - end.y) < AERIAL.contestRadius)
        .sort((x, y) => Math.hypot(x.x - end.x, x.y - end.y) - Math.hypot(y.x - end.x, y.y - end.y) || x.index - y.index)[0];
    const keeper = keeperOf(st, defSide);
    if (keeper && keeper.stumble === 0 && Math.hypot(keeper.x - end.x, keeper.y - end.y) < 5 && inOwnBox(st, defSide, end)) {
      const ka = keeper.lp.attributes;
      if (st.rng.chance(clamp(0.35 + ka.handling / 300 + ka.reach / 300, 0.3, 0.85))) {
        this.emit({ type: 'CLEARANCE', playerId: keeper.id, team: defSide, at: end });
        this.giveBall(keeper);
        keeper.action = 'catch';
        keeper.actionTicks = 6;
        keeper.cooldown = 6;
        return;
      }
    }
    const att = receiver && Math.hypot(receiver.x - end.x, receiver.y - end.y) < AERIAL.contestRadius && receiver.stumble === 0 ? receiver : near(st.teams[f.side].players.filter((p) => p.slot.position !== 'GK'));
    const def = near(st.teams[defSide].players.filter((p) => p.slot.position !== 'GK'));
    if (att) {
      const aa = att.lp.attributes;
      const targetMan = isTacticActive(st, f.side, 'TARGET_MAN') && att === this.targetManOf(f.side) ? 0.12 : 0;
      const pWin = def ? clamp(0.48 + targetMan + (aa.strength - def.lp.attributes.strength) / 140 + (aa.finishing - def.lp.attributes.marking) / 320, 0.15, 0.88) : 0.92;
      if (st.rng.chance(pWin)) {
        this.emit({ type: 'PASS', fromId: f.kickerId, toId: att.id, start, end, outcome: 'complete', cross: true });
        st.stats.passesCompleted[f.side]++;
        st.lastCompletedPass = { fromId: f.kickerId, toId: att.id, side: f.side, tick: st.tick };
        att.x = clamp(end.x, 1, 99);
        att.y = clamp(end.y, 1, PITCH_L - 1);
        this.giveBall(att);
        const dGoal = Math.hypot(50 - att.x, attackGoalY(st, att.side) - att.y);
        if (dGoal < AERIAL.headerRange) this.shoot(att, 'header');
        return;
      }
    }
    this.emit({ type: 'PASS', fromId: f.kickerId, toId: f.intendedId ?? '', start, end, outcome: def ? 'intercepted' : 'loose', cross: true, ...(def ? { interceptedBy: def.id } : {}) });
    b.flight = null;
    b.z = 0;
    if (def) {
      // Headed clear, away from goal.
      this.emit({ type: 'CLEARANCE', playerId: def.id, team: defSide, at: end });
      def.action = 'header';
      def.actionTicks = 6;
      const away = attackGoalY(st, defSide) === 0 ? -1 : 1;
      b.state = 'loose';
      b.vx = st.rng.range(-1.4, 1.4);
      b.vy = away * st.rng.range(1.6, 2.6);
      b.lastTouchSide = defSide;
      b.lastTouchId = def.id;
    } else {
      b.state = 'loose';
      b.vx *= 0.3;
      b.vy *= 0.3;
    }
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
        const lifted = st.teams[other(f.side)];
        lifted.momentum = Math.min(MOMENTUM.max, lifted.momentum + MOMENTUM.concedeBonus);
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
        const save = plan.save ?? { style: 'parry' as SaveStyle, held: false, double: false };
        this.emit({ type: 'SAVE', keeperId: keeper.id, shotEventId: plan.eventId, at: { x: b.x, y: b.y }, held: save.held, style: save.style, double: save.double });
        st.stats.saves[keeper.side]++;
        // He is where the ball is (the dive has carried him most of the way).
        keeper.x = clamp(b.x, 1, 99);
        keeper.y = clamp(b.y, 0.5, PITCH_L - 0.5);
        keeper.diveTarget = null;
        if (save.style === 'catch' || (save.held && keeper.action !== 'dive')) {
          keeper.action = 'catch';
          keeper.actionTicks = 7;
        } else if (keeper.action !== 'dive') {
          keeper.action = 'dive';
          keeper.facing = b.x >= keeper.x ? 1 : -1;
          keeper.actionTicks = 9;
        }
        if (save.held) {
          this.giveBall(keeper);
          keeper.hold = 0;
          // Gets up (or gathers himself) before distributing: the save gets its moment.
          keeper.cooldown = save.style === 'catch' ? 8 : 18;
          st.lastSave = null;
        } else if (save.style === 'fingertip') {
          b.flight = null;
          keeper.stumble = 6;
          st.lastSave = null;
          this.setRestart('corner', other(keeper.side), { x: b.x < 50 ? 0.8 : PITCH_W - 0.8, y: plan.goalY === 0 ? 0.8 : PITCH_L - 0.8 });
        } else {
          // Parried: the rebound is live and anyone can follow it in.
          b.state = 'loose';
          b.flight = null;
          b.vx = (b.x < 50 ? -1 : 1) * st.rng.range(0.4, 1.5) * (st.rng.chance(0.35) ? -0.6 : 1);
          b.vy = -dir * st.rng.range(0.9, 1.9);
          b.z = st.rng.range(0, 1.4);
          b.lastTouchSide = keeper.side;
          b.lastTouchId = keeper.id;
          keeper.stumble = 8;
          st.lastSave = { tick: st.tick, keeperId: keeper.id, side: keeper.side };
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
        if (plan.deflected) this.setRestart('corner', f.side, { x: b.x < 50 ? 0.8 : PITCH_W - 0.8, y: plan.goalY === 0 ? 0.8 : PITCH_L - 0.8 });
        else this.setRestart('goalKick', other(f.side), { x: 50, y: plan.goalY - dir * 8 });
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
    const outfield = team.filter((p) => p.slot.position !== 'GK');
    let taker: PState;
    if (kind === 'goalKick') taker = keeperOf(st, side) ?? (team[0] as PState);
    else if (kind === 'corner' || kind === 'freeKick' || kind === 'penalty') {
      // Set pieces go to the specialist: set-piece skill (and composure for penalties).
      const score = (p: PState) => {
        const a = p.lp.attributes;
        const base = kind === 'penalty' ? a.composure * 0.45 + a.finishing * 0.3 + a.setPieces * 0.25 : a.setPieces;
        return base + (p.traits.has('setPieceArtist') ? 12 : 0);
      };
      taker = [...outfield].sort((a, b) => score(b) - score(a) || a.index - b.index)[0] as PState;
    } else {
      taker = [...outfield].sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y) || a.index - b.index)[0] as PState;
    }
    if (st.possession !== side) st.possession = side;
    Object.assign(st.ball, { x: spot.x, y: spot.y, z: 0, vx: 0, vy: 0, state: 'dead', ownerId: null, flight: null });

    let wall: { id: string; x: number; y: number }[] = [];
    let direct = false;
    if (kind === 'freeKick') {
      const goalY = attackGoalY(st, side);
      const dGoal = Math.hypot(50 - spot.x, goalY - spot.y);
      direct = dGoal < SETPIECE.directRange && Math.abs(spot.x - 50) < 30;
      if (direct) {
        // Two defenders line up 9 units away, on the line to goal.
        const ux = (50 - spot.x) / dGoal;
        const uy = (goalY - spot.y) / dGoal;
        const cx = spot.x + ux * SETPIECE.wallDistance;
        const cy = spot.y + uy * SETPIECE.wallDistance;
        const defenders = st.teams[other(side)].players
          .filter((p) => p.slot.position !== 'GK')
          .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.index - b.index)
          .slice(0, 2);
        wall = defenders.map((p, i) => ({ id: p.id, x: clamp(cx + -uy * (i === 0 ? -0.9 : 0.9), 1, 99), y: clamp(cy + ux * (i === 0 ? -0.9 : 0.9), 1, PITCH_L - 1) }));
      }
    }
    if (kind === 'corner') st.stats.corners[side]++;
    st.restart = { kind, side, spot, takerId: taker.id, waited: 0, wall, direct };
    st.phase = 'restart';
    st.phaseTicks = 0;
    for (const p of allPlayers(st)) {
      p.runTicks = 0;
      p.dribbleTarget = null;
      p.dribbleFrom = null;
      p.firstTime = 0;
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
      const p = best.p;
      this.giveBall(p); // also records a turnover if the other side had it
      // Following in a parried shot: hit it first time while the keeper is down.
      const ls = st.lastSave;
      if (ls && ls.side !== p.side && st.tick - ls.tick <= REBOUND_TICKS && p.slot.position !== 'GK') {
        p.firstTime = 3;
        p.hold = 99;
      }
      if (ls && st.tick - ls.tick > REBOUND_TICKS) st.lastSave = null;
    } else if (Math.hypot(b.vx, b.vy) < 0.05) {
      // A dead-still loose ball: possession is contested.
      st.possession = null;
    }
  }

  private resolveTackles(): void {
    const st = this.st;
    const b = st.ball;
    const carrier = findPlayer(st, b.ownerId);
    if (!carrier || carrier.slot.position === 'GK' || carrier.action === 'skill') return;
    const side = other(carrier.side);
    const pressing = isTacticActive(st, side, 'PRESS');
    const range = TACKLE.range + (pressing ? TACKLE.pressRangeBonus : 0);
    for (const d of st.teams[side].players) {
      if (d.cooldown > 0 || d.stumble > 0 || d.slot.position === 'GK') continue;
      const dist = Math.hypot(d.x - carrier.x, d.y - carrier.y);
      if (dist > range + SLIDE.extraRange) continue;
      // Chasing a runner who is getting away = slide; close and square = stay on your feet.
      const runningAway = carrier.vx * (carrier.x - d.x) + carrier.vy * (carrier.y - d.y) > 0;
      const style: TackleStyle = dist > range ? 'slide' : runningAway && d.slot.position !== 'FWD' && st.rng.chance(0.35) ? 'slide' : 'standing';
      if (dist > range && !runningAway) continue;
      let attempt = pressing ? TACKLE.pressAttemptChance : TACKLE.attemptChance;
      if (style === 'slide') attempt *= 0.45;
      if (this.isMarking(d, carrier)) attempt = Math.min(0.9, attempt * 1.5);
      if (d.booked) attempt *= 0.6;
      if (!st.rng.chance(attempt)) continue;

      const da = d.lp.attributes;
      const ca = carrier.lp.attributes;
      const at = { x: carrier.x, y: carrier.y };
      d.cooldown = TACKLE.cooldownTicks;

      // A skilful dribbler can make a standing challenge look silly.
      if (style === 'standing' && st.rng.chance(clamp(0.08 + (ca.dribbling - da.tackling) / 140 + (ca.ballControl - 50) / 300, 0.02, 0.4))) {
        this.skillMove(carrier, d, dist);
        return;
      }

      // Fouls: mistimed challenges, more likely sliding, under the press and for poor tacklers.
      let pFoul = (style === 'slide' ? FOUL.slide : FOUL.standing) + (60 - da.tackling) / FOUL.skillPenalty + (pressing ? FOUL.pressBonus : 0) + (ca.dribbling - 60) / 900;
      if (d.booked) pFoul *= FOUL.bookedFactor;
      if (st.rng.chance(clamp(pFoul, 0.01, 0.3))) {
        this.foul(d, carrier, style);
        return;
      }

      const onHisMan = this.isMarking(d, carrier) ? 0.1 : 0;
      let p = onHisMan + TACKLE.baseSuccess + (da.tackling - ca.dribbling) / 110 + (da.strength - ca.strength) / 300 + (pressing ? TACKLE.pressSuccessBonus : 0) + (style === 'slide' ? SLIDE.successBonus : 0);
      if (d.traits.has('brickWall')) p += 0.04;
      p -= (1 - d.stamina) * 0.15;
      const won = st.rng.chance(clamp(p, 0.12, 0.78));
      this.emit({ type: 'TACKLE', challengerId: d.id, carrierId: carrier.id, won, at, style });
      d.action = style === 'slide' ? 'slide' : 'tackle';
      d.actionTicks = style === 'slide' ? SLIDE.actionTicks : 4;
      if (style === 'slide') d.stumble = SLIDE.groundTicks; // committed: on the deck either way
      if (won) {
        st.stats.tacklesWon[side]++;
        this.endDribble(carrier);
        carrier.stumble = TACKLE.tackledStumbleTicks;
        carrier.action = 'stumble';
        carrier.actionTicks = TACKLE.tackledStumbleTicks;
        if (style === 'standing' && st.rng.chance(0.6)) {
          this.giveBall(d);
        } else {
          b.state = 'loose';
          b.ownerId = null;
          b.lastTouchSide = d.side;
          b.lastTouchId = d.id;
          b.vx = (carrier.x - d.x) * 0.25 + st.rng.range(-0.5, 0.5);
          b.vy = (carrier.y - d.y) * 0.25 + st.rng.range(-0.5, 0.5);
        }
      } else if (style === 'standing') {
        d.stumble = TACKLE.beatenStumbleTicks;
        d.action = 'stumble';
        d.actionTicks = TACKLE.beatenStumbleTicks;
      }
      return;
    }
  }

  /** Whistle: free kick where it happened, or a penalty if it was inside the box. */
  private foul(d: PState, victim: PState, style: TackleStyle): void {
    const st = this.st;
    const at = { x: victim.x, y: victim.y };
    const penalty = inOwnBox(st, d.side, at);
    const goalY = ownGoalY(st, d.side);
    const breakaway = yToDepth(st, victim.side, victim.y) > 0.7 && Math.abs(victim.x - 50) < 25;
    const booked =
      !d.booked && (st.rng.chance(style === 'slide' ? FOUL.slideBooking : FOUL.standingBooking) || d.fouls >= 2 || (breakaway && st.rng.chance(0.5)));
    d.fouls++;
    if (booked) d.booked = true;
    st.stats.fouls[d.side]++;
    this.emit({ type: 'FOUL', foulerId: d.id, victimId: victim.id, team: d.side, at, award: penalty ? 'penalty' : 'freeKick', booked });
    d.action = style === 'slide' ? 'slide' : 'tackle';
    d.actionTicks = style === 'slide' ? SLIDE.actionTicks : 4;
    victim.action = 'fouled';
    victim.actionTicks = 10;
    victim.stumble = 10;
    this.endDribble(victim);
    const dir = goalY === 0 ? 1 : -1;
    const spot = penalty ? { x: 50, y: goalY + dir * SETPIECE.penaltySpot } : { x: clamp(at.x, 2, 98), y: clamp(at.y, 2, PITCH_L - 2) };
    this.setRestart(penalty ? 'penalty' : 'freeKick', victim.side, spot);
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
    if (isTacticActive(st, p.side, 'ALL_OUT')) mult *= 1.3;
    if (p.traits.has('ironLungs')) mult *= 0.8;
    const fitness = 1.15 - (p.lp.attributes.stamina / 100) * 0.5;
    const base = STAMINA.baseDrain * (pressing ? 1.6 : 1);
    p.stamina = Math.max(0.05, p.stamina - (base + sprint * STAMINA.sprintDrain * mult) * fitness);
  }

  /** Target Man: the team's best header of the ball (strength first). */
  private targetManOf(side: TeamSide): PState | undefined {
    const score = (p: PState) => p.lp.attributes.strength * 0.6 + p.lp.attributes.finishing * 0.4;
    return [...this.st.teams[side].players].filter((p) => p.slot.position !== 'GK').sort((a, b) => score(b) - score(a) || a.index - b.index)[0];
  }

  /** Is `d` the Man-Mark shadow assigned to `target`? */
  private isMarking(d: PState, target: PState): boolean {
    const t = this.st.teams[d.side];
    return Boolean(t.marking && isTacticActive(this.st, d.side, 'MAN_MARK') && t.marking.markerId === d.id && t.marking.targetId === target.id);
  }

  /** The player being man-marked has his shadow within `r` units. */
  private markerNear(p: PState, r: number): boolean {
    const opp = this.st.teams[other(p.side)];
    if (!opp.marking || opp.marking.targetId !== p.id || !isTacticActive(this.st, opp.side, 'MAN_MARK')) return false;
    const m = findPlayer(this.st, opp.marking.markerId);
    return Boolean(m && Math.hypot(m.x - p.x, m.y - p.y) < r);
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
