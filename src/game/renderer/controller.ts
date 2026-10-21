import { BALL, TICKS_PER_SECOND } from '../simulation/constants';
import type { MatchEngine } from '../simulation/engine';
import type { CommandResult, FootballEvent, MatchSnapshot, TacticCommand, TeamLineup, TeamSide } from '../simulation/types';

/**
 * Presentation clock between the pure engine and the renderer/HUD.
 * - Advances the engine at a fixed 10 ticks/s × speed, independent of frame rate.
 * - Keeps previous/current snapshots so the renderer can interpolate smoothly.
 * - Reveals events only when the ball physically gets there (e.g. a shot's outcome).
 * - Holds presentation for goal banners and halftime without touching the simulation.
 * Nothing here can change a result.
 */
export interface CommentaryLine {
  id: number;
  text: string;
  tone: 'info' | 'chance' | 'goal' | 'save' | 'tactic' | 'whistle';
  side?: TeamSide;
}

export type HoldReason = 'goal' | 'halftime' | 'paused' | 'hidden' | 'fulltime' | null;

export interface ControllerListener {
  onCommentary?(line: CommentaryLine): void;
  onGoal?(e: Extract<FootballEvent, { type: 'GOAL' }>): void;
  onSave?(e: Extract<FootballEvent, { type: 'SAVE' }>): void;
  onShot?(e: Extract<FootballEvent, { type: 'SHOT' }>): void;
  onTackle?(e: Extract<FootballEvent, { type: 'TACKLE' }>): void;
  /** A shot that missed (wide / woodwork / blocked), revealed when the ball gets there. */
  onMiss?(e: Extract<FootballEvent, { type: 'SHOT' }>): void;
  onHold?(reason: HoldReason): void;
  onTick?(snap: MatchSnapshot): void;
  onCommand?(result: CommandResult): void;
}

const TICK_MS = 1000 / TICKS_PER_SECOND;
export const GOAL_HOLD_MS = 1900;

export class MatchController {
  readonly engine: MatchEngine;
  readonly home: TeamLineup;
  readonly away: TeamLineup;
  readonly userSide: TeamSide;
  speed = 1;
  private prev: MatchSnapshot;
  private curr: MatchSnapshot;
  private acc = 0;
  private hold: HoldReason = null;
  private holdMs = 0;
  private userPaused = false;
  private eventCursor: number;
  private queued: { atTick: number; line: Omit<CommentaryLine, 'id'>; miss?: Extract<FootballEvent, { type: 'SHOT' }> }[] = [];
  private lineId = 1;
  private listeners = new Set<ControllerListener>();
  private names = new Map<string, string>();

  constructor(engine: MatchEngine, home: TeamLineup, away: TeamLineup, userSide: TeamSide) {
    this.engine = engine;
    this.home = home;
    this.away = away;
    this.userSide = userSide;
    for (const p of [...home.players, ...away.players]) this.names.set(p.id, p.shortName);
    this.curr = engine.getSnapshot();
    this.prev = this.curr;
    // When resuming from a checkpoint, don't replay old commentary.
    this.eventCursor = engine.getEvents().length;
    if (engine.isFinished()) this.hold = 'fulltime';
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.min(4, Math.max(0.5, Number.isFinite(multiplier) ? multiplier : 1));
  }

  subscribe(l: ControllerListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  get snapshot(): MatchSnapshot {
    return this.curr;
  }

  get previous(): MatchSnapshot {
    return this.prev;
  }

  /** 0..1 between previous and current snapshot. */
  get alpha(): number {
    return this.isRunning() ? Math.min(1, this.acc / TICK_MS) : 1;
  }

  get holdReason(): HoldReason {
    return this.hold;
  }

  isRunning(): boolean {
    return this.hold === null && !this.userPaused;
  }

  isPaused(): boolean {
    return this.userPaused;
  }

  nameOf(id: string): string {
    return this.names.get(id) ?? '';
  }

  /** Called every animation frame with real elapsed milliseconds. */
  update(dtMs: number): void {
    const dt = Math.min(Math.max(0, Number.isFinite(dtMs) ? dtMs : 0), 250);
    if (this.hold === 'goal') {
      this.holdMs -= dt;
      if (this.holdMs <= 0) this.setHold(null);
      return;
    }
    if (!this.isRunning()) return;
    this.acc += dt * this.speed;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < 8 && this.isRunning()) {
      this.acc -= TICK_MS;
      this.stepOnce();
      steps++;
    }
    if (steps === 8) this.acc = 0;
  }

  private stepOnce(): void {
    this.prev = this.curr;
    this.engine.advanceTicks(1);
    this.curr = this.engine.getSnapshot();
    this.flushQueued();
    this.consumeEvents();
    for (const l of this.listeners) l.onTick?.(this.curr);
  }

  dispatch(type: TacticCommand): CommandResult {
    const r = this.engine.dispatch(type, this.userSide);
    for (const l of this.listeners) l.onCommand?.(r);
    return r;
  }

  pause(): void {
    this.userPaused = true;
    for (const l of this.listeners) l.onHold?.('paused');
  }

  resume(): void {
    this.userPaused = false;
    if (this.hold === 'halftime' || this.hold === 'hidden') this.setHold(null);
    else for (const l of this.listeners) l.onHold?.(this.hold);
  }

  /** Backgrounded tab: freeze presentation (the sim never runs ahead unseen). */
  suspend(): void {
    if (this.hold === null) this.setHold('hidden');
  }

  /** Simulate the rest instantly. Tactics not used are simply not used. */
  skipToEnd(): void {
    this.engine.runToEnd();
    this.prev = this.curr = this.engine.getSnapshot();
    this.queued = [];
    this.eventCursor = this.engine.getEvents().length;
    this.setHold('fulltime');
  }

  private setHold(reason: HoldReason): void {
    this.hold = reason;
    this.acc = 0;
    for (const l of this.listeners) l.onHold?.(reason);
  }

  private say(line: Omit<CommentaryLine, 'id'>): void {
    const full = { ...line, id: this.lineId++ };
    for (const l of this.listeners) l.onCommentary?.(full);
  }

  private flushQueued(): void {
    const due = this.queued.filter((q) => q.atTick <= this.curr.tick);
    this.queued = this.queued.filter((q) => q.atTick > this.curr.tick);
    for (const q of due) {
      this.say(q.line);
      if (q.miss) for (const l of this.listeners) l.onMiss?.(q.miss);
    }
  }

  private teamName(side: TeamSide): string {
    return side === 'home' ? this.home.shortName : this.away.shortName;
  }

  private consumeEvents(): void {
    const events = this.engine.getEventsSince(this.eventCursor);
    this.eventCursor += events.length;
    for (const e of events) {
      switch (e.type) {
        case 'KICKOFF':
          if (e.half === 2 && e.minute === 45) this.say({ text: 'Second half under way.', tone: 'whistle' });
          else if (e.minute === 0) this.say({ text: `Kick-off! ${this.teamName(e.team)} get us started.`, tone: 'whistle' });
          break;
        case 'SHOT': {
          for (const l of this.listeners) l.onShot?.(e);
          this.say({ text: `${this.nameOf(e.shooterId)} shoots!`, tone: 'chance', side: e.team });
          // Misses have no follow-up event: reveal them when the ball gets there.
          const ticks = Math.max(2, Math.ceil(Math.hypot(e.target.x - e.from.x, e.target.y - e.from.y) / BALL.shotSpeed));
          const at = this.curr.tick + ticks;
          if (e.outcome === 'wide') this.queued.push({ atTick: at, line: { text: 'Wide of the post.', tone: 'info', side: e.team }, miss: e });
          if (e.outcome === 'woodwork') this.queued.push({ atTick: at, line: { text: 'Off the woodwork!', tone: 'chance', side: e.team }, miss: e });
          if (e.outcome === 'blocked') this.queued.push({ atTick: at, line: { text: `Blocked by ${this.nameOf(e.blockerId ?? '')}!`, tone: 'info' }, miss: e });
          break;
        }
        case 'SAVE':
          for (const l of this.listeners) l.onSave?.(e);
          this.say({ text: e.held ? `${this.nameOf(e.keeperId)} gathers it.` : `Great save by ${this.nameOf(e.keeperId)}!`, tone: 'save' });
          break;
        case 'GOAL':
          for (const l of this.listeners) l.onGoal?.(e);
          this.say({
            text: `GOAL! ${this.nameOf(e.scorerId)}${e.assistId ? `, set up by ${this.nameOf(e.assistId)}` : ''}. ${this.curr.score.home}–${this.curr.score.away}`,
            tone: 'goal',
            side: e.team,
          });
          this.holdMs = GOAL_HOLD_MS;
          this.setHold('goal');
          break;
        case 'TACKLE':
          for (const l of this.listeners) l.onTackle?.(e);
          if (e.won && this.lineId % 2 === 0) this.say({ text: `Strong tackle from ${this.nameOf(e.challengerId)}.`, tone: 'info' });
          break;
        case 'PASS':
          if (e.outcome === 'intercepted' && e.interceptedBy) this.say({ text: `Read it! ${this.nameOf(e.interceptedBy)} cuts it out.`, tone: 'info' });
          break;
        case 'TACTIC_APPLIED':
          this.say({
            text: `${this.teamName(e.team)} ${e.command === 'PRESS' ? 'press high' : 'move it quickly'} until ${e.expiresMinute}'.`,
            tone: 'tactic',
            side: e.team,
          });
          break;
        case 'RESTART':
          if (e.kind === 'corner') this.say({ text: `Corner to ${this.teamName(e.team)}.`, tone: 'info', side: e.team });
          break;
        case 'HALFTIME':
          this.say({ text: `Half-time: ${this.curr.score.home}–${this.curr.score.away}.`, tone: 'whistle' });
          this.setHold('halftime');
          return;
        case 'FULLTIME':
          this.say({ text: `Full time! ${e.home}–${e.away}.`, tone: 'whistle' });
          this.setHold('fulltime');
          return;
      }
    }
  }
}
