import { createMatch, type CreateMatchArgs, type MatchEngine } from './engine';
import { ENGINE_VERSION } from './constants';
import { playerLines, playerOfMatch } from './summary';
import type { MatchCommand, MatchResult } from './types';

/** Feeds recorded commands back in at exactly the ticks they were applied. */
export function replayTo(args: CreateMatchArgs, commands: readonly MatchCommand[], untilTick: number): MatchEngine {
  const engine = createMatch(args);
  const queue = [...commands].sort((a, b) => a.tick - b.tick);
  let qi = 0;
  while (!engine.isFinished() && engine.tick < untilTick) {
    while (qi < queue.length && (queue[qi] as MatchCommand).tick === engine.tick) {
      const c = queue[qi] as MatchCommand;
      const r = engine.dispatch(c.type, c.side);
      if (!r.ok) throw new Error(`Recorded command rejected on replay at tick ${c.tick}: ${r.reason}`);
      qi++;
    }
    if (qi < queue.length && (queue[qi] as MatchCommand).tick < engine.tick) throw new Error('Recorded command tick is in the past');
    engine.advanceTicks(1);
  }
  return engine;
}

export function resultOf(engine: MatchEngine, args: CreateMatchArgs): MatchResult {
  if (!engine.isFinished()) throw new Error('Match is not finished');
  const snap = engine.getSnapshot();
  const events = [...engine.getEvents()];
  const lines = playerLines(events, args.home, args.away, snap.score);
  return {
    matchId: args.matchId,
    seed: args.seed,
    engineVersion: ENGINE_VERSION,
    score: snap.score,
    events,
    stats: engine.getStats(),
    players: lines,
    playerOfMatchId: playerOfMatch(lines, snap.score),
    commands: engine.getCommands(),
  };
}

/** Authoritative result: replay seed + commands to full time. */
export function replayMatch(args: CreateMatchArgs, commands: readonly MatchCommand[]): MatchResult {
  const engine = replayTo(args, commands, Number.MAX_SAFE_INTEGER);
  return resultOf(engine, args);
}
