import { BALL, DECISION, MOVE, PITCH_L } from './constants';
import { clamp, segmentDistance } from './geometry';
import { locationXg } from './shotModel';
import {
  attackGoalY,
  depthToY,
  isTacticActive,
  other,
  ownGoalY,
  pressureAt,
  yToDepth,
  type EngineState,
  type PState,
} from './state';
import type { SimPos, TeamSide } from './types';

/**
 * Off-ball positioning. Every outfielder starts from his formation anchor, shifted by the
 * ball and phase, then applies role behaviour (pressing, marking, runs, supporting angles).
 * Results are written to p.targetX / p.targetY; movement happens in the engine.
 */
export function assignTargets(st: EngineState): void {
  const ball = st.ball;
  for (const side of ['home', 'away'] as const) {
    const team = st.teams[side];
    const inPoss = st.possession === side;
    const pressing = isTacticActive(st, side, 'PRESS');
    const ballDepth = yToDepth(st, side, ball.y);
    const opponents = st.teams[other(side)].players;
    const oppOutfield = opponents.filter((o) => o.slot.position !== 'GK');
    // Opposition's deepest outfielder (in our attacking frame) = the line our forwards play on.
    const lastLine = Math.max(...oppOutfield.map((o) => yToDepth(st, side, o.y)));

    // Who goes to the ball when we don't have it.
    const chasers = new Set<string>();
    if (!inPoss && (ball.state === 'owned' || ball.state === 'loose' || ball.state === 'pass')) {
      const count = ball.state === 'loose' ? 1 : pressing ? (ballDepth > 0.62 ? 3 : 2) : 1;
      const ranked = team.players
        .filter((p) => p.slot.position !== 'GK' || (ball.state === 'loose' && yToDepth(st, side, ball.y) < 0.12))
        .map((p) => ({ p, d: Math.hypot(p.x - ball.x, p.y - ball.y) }))
        .sort((a, b) => a.d - b.d || a.p.index - b.p.index);
      for (const r of ranked.slice(0, count)) chasers.add(r.p.id);
    }
    if (inPoss && ball.state === 'loose') {
      const nearest = [...team.players].filter((p) => p.slot.position !== 'GK').sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y) || a.index - b.index)[0];
      if (nearest) chasers.add(nearest.id);
    }

    for (const p of team.players) {
      if (p.id === ball.ownerId) continue; // carrier movement is decided separately
      const slot = p.slot;
      let depth: number;
      let x: number;

      if (slot.position === 'GK') {
        const sweeper = p.traits.has('sweeperKeeper') ? 0.04 : 0;
        depth = clamp(0.025 + sweeper + (inPoss ? 0.03 : 0) + Math.max(0, 0.25 - ballDepth) * -0.02, 0.012, 0.12);
        x = 50 + (ball.x - 50) * 0.22;
        // Keeper reacts to a shot heading his way.
        if (ball.state === 'shot' && ball.flight?.shot?.keeperId === p.id) {
          const f = ball.flight;
          const t = Math.min(1, (f.tick + 2) / f.total);
          x = f.fromX + (f.toX - f.fromX) * Math.max(t, 0.85);
          depth = yToDepth(st, side, f.fromY + (f.toY - f.fromY) * Math.max(t, 0.85));
          depth = clamp(depth, 0, 0.1);
        }
        setTarget(st, p, x, depthToY(st, side, depth));
        continue;
      }

      const lineShift = inPoss ? 0.1 : pressing ? 0.07 : -0.05;
      depth = slot.depth + (ballDepth - 0.45) * 0.55 + lineShift;
      const widthScale = inPoss ? 1.05 : 0.82;
      x = 50 + (slot.x - 50) * widthScale + (ball.x - 50) * 0.3;
      const maxDepth = slot.position === 'DEF' ? 0.62 : slot.position === 'MID' ? 0.82 : 0.9;
      depth = clamp(depth, 0.08, maxDepth);

      if (chasers.has(p.id)) {
        // Press the carrier / attack the loose ball; the second presser screens the nearest pass.
        const lead = ball.state === 'loose' ? 3 : 1;
        let tx = ball.x + ball.vx * lead;
        let ty = ball.y + ball.vy * lead;
        const order = [...chasers].indexOf(p.id);
        if (order > 0 && ball.ownerId) {
          // Second and third pressers screen the carrier's nearest outlets.
          const carrier = opponents.find((o) => o.id === ball.ownerId);
          const outlets = carrier ? outletsOf(opponents, carrier) : [];
          const outlet = outlets[order - 1];
          if (outlet && carrier) {
            tx = carrier.x + (outlet.x - carrier.x) * 0.6;
            ty = carrier.y + (outlet.y - carrier.y) * 0.6;
          }
        }
        setTarget(st, p, tx, ty);
        continue;
      }

      if (ball.state === 'pass' && ball.flight?.intendedId === p.id) {
        setTarget(st, p, ball.flight.toX, ball.flight.toY);
        continue;
      }

      if (ball.state === 'pass' && ball.flight && ball.flight.side !== side) {
        // Defenders near the lane step in to cut it out.
        const f = ball.flight;
        const seg = segmentDistance(p, { x: ball.x, y: ball.y }, { x: f.toX, y: f.toY });
        if (seg.d < 9) {
          setTarget(st, p, ball.x + (f.toX - ball.x) * seg.t, ball.y + (f.toY - ball.y) * seg.t);
          continue;
        }
      }

      if (inPoss) {
        if (slot.position === 'FWD') {
          // Play on the last line; occasionally sprint in behind.
          if (p.runTicks > 0) {
            p.runTicks--;
            depth = Math.min(0.95, lastLine + 0.12);
            x = 50 + (slot.x - 50) * 0.5;
          } else {
            depth = Math.min(Math.max(depth, ballDepth + 0.06), lastLine + 0.01);
            const quick = isTacticActive(st, side, 'QUICK_PASS');
            // A pressing opponent's high line invites runs in behind.
            const theyPress = isTacticActive(st, other(side), 'PRESS');
            const runChance = 0.012 + (p.lp.attributes.acceleration / 100) * 0.012 + (quick ? 0.01 : 0) + (theyPress ? 0.045 : 0);
            if (ball.ownerId && ballDepth > 0.3 && st.rng.chance(runChance)) p.runTicks = 18;
          }
        } else {
          // Offer an angle: drift away from the nearest marker.
          const marker = nearest(opponents, p);
          if (marker && marker.d < 10) {
            const dx = p.x - marker.p.x;
            const dy = p.y - marker.p.y;
            const len = Math.hypot(dx, dy) || 1;
            x += (dx / len) * 4;
            depth += ((attackGoalY(st, side) === 0 ? -dy : dy) / len) * 0.02;
          }
        }
      } else {
        // Mark the most dangerous attacker near our zone, staying goal-side.
        const anchor: SimPos = { x, y: depthToY(st, side, depth) };
        let best: { o: PState; d: number } | null = null;
        const radius = pressing ? 24 : 18;
        for (const o of oppOutfield) {
          if (o.id === ball.ownerId) continue;
          const d = Math.hypot(o.x - anchor.x, o.y - anchor.y);
          if (d < radius && (!best || d < best.d)) best = { o, d };
        }
        if (best) {
          // Normal: goal-side. Pressing: tight on the ball side to jump the pass.
          const refX = pressing ? ball.x : 50;
          const refY = pressing ? ball.y : ownGoalY(st, side);
          const toX = refX - best.o.x;
          const toY = refY - best.o.y;
          const len = Math.hypot(toX, toY) || 1;
          const gap = pressing ? 2.2 : 3;
          const markX = best.o.x + (toX / len) * gap;
          const markY = best.o.y + (toY / len) * gap;
          const w = pressing ? 0.85 : slot.position === 'DEF' ? 0.6 : 0.45;
          setTarget(st, p, anchor.x + (markX - anchor.x) * w, anchor.y + (markY - anchor.y) * w);
          continue;
        }
      }
      setTarget(st, p, x, depthToY(st, side, depth));
    }

    // Soft separation so cards never stack.
    for (const p of team.players) {
      if (p.id === ball.ownerId || p.slot.position === 'GK') continue;
      for (const q of team.players) {
        if (q === p) continue;
        const dx = p.targetX - q.x;
        const dy = p.targetY - q.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < MOVE.separationRadius) {
          const push = (1 - d / MOVE.separationRadius) * 3;
          p.targetX += (dx / d) * push;
          p.targetY += (dy / d) * push;
        }
      }
      p.targetX = clamp(p.targetX, 2, 98);
      p.targetY = clamp(p.targetY, 2, PITCH_L - 2);
    }
  }
}

function setTarget(_st: EngineState, p: PState, x: number, y: number): void {
  p.targetX = clamp(x, 1, 99);
  p.targetY = clamp(y, 1, PITCH_L - 1);
}

function nearest(list: readonly PState[], p: { x: number; y: number }): { p: PState; d: number } | undefined {
  let best: { p: PState; d: number } | undefined;
  for (const o of list) {
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (!best || d < best.d) best = { p: o, d };
  }
  return best;
}

function outletsOf(team: readonly PState[], p: PState): PState[] {
  return team
    .filter((t) => t !== p && t.slot.position !== 'GK')
    .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) || a.index - b.index);
}

export type CarrierDecision =
  | { kind: 'shoot'; score: number }
  | { kind: 'pass'; to: PState; target: SimPos; through: boolean; score: number }
  | { kind: 'dribble'; target: SimPos; score: number }
  | { kind: 'hold'; score: number };

/** Score every physically valid option, then choose with a seeded softmax. */
export function decide(st: EngineState, carrier: PState): CarrierDecision {
  const side = carrier.side;
  const opps = st.teams[other(side)].players;
  const mates = st.teams[side].players;
  const quick = isTacticActive(st, side, 'QUICK_PASS');
  const oppPressing = isTacticActive(st, other(side), 'PRESS');
  const goalY = attackGoalY(st, side);
  const pos = { x: carrier.x, y: carrier.y };
  const depth = yToDepth(st, side, carrier.y);
  const pressure = pressureAt(st, side, pos);
  const a = carrier.lp.attributes;
  const isKeeper = carrier.slot.position === 'GK';
  const options: CarrierDecision[] = [];

  // Shot
  const dGoal = Math.hypot(50 - carrier.x, goalY - carrier.y);
  if (!isKeeper && dGoal < DECISION.shootRange && depth > 0.58) {
    const q = locationXg(pos, goalY);
    const tendency = (a.shooting + a.finishing) / 2;
    let score = 0.25 + q * 8 + (tendency - 50) / 90 - pressure * 0.2;
    if (carrier.traits.has('longRanger') && dGoal > 28) score += 0.3;
    if (quick) score -= 0.15;
    options.push({ kind: 'shoot', score });
  }

  // Passes
  const lastLine = Math.max(...opps.filter((o) => o.slot.position !== 'GK').map((o) => yToDepth(st, side, o.y)));
  for (const t of mates) {
    if (t === carrier || t.stumble > 0) continue;
    if (t.slot.position === 'GK' && depth > 0.35) continue;
    const dRaw = Math.hypot(t.x - carrier.x, t.y - carrier.y);
    if (dRaw < 6 || dRaw > 75) continue;
    const speed = clamp(BALL.passSpeedMin + dRaw * 0.035, BALL.passSpeedMin, BALL.passSpeedMax);
    const ticks = Math.ceil(dRaw / speed);
    const through = t.runTicks > 0;
    const lead = through ? 0.9 : 0.55;
    const target = { x: clamp(t.x + t.vx * ticks * lead, 2, 98), y: clamp(t.y + t.vy * ticks * lead, 2, PITCH_L - 2) };
    const d = Math.hypot(target.x - carrier.x, target.y - carrier.y);
    let laneOpen = 99;
    let recvOpen = 99;
    for (const o of opps) {
      const seg = segmentDistance(o, pos, target);
      if (seg.t > 0.08) laneOpen = Math.min(laneOpen, seg.d);
      recvOpen = Math.min(recvOpen, Math.hypot(o.x - target.x, o.y - target.y));
    }
    const lofted = d > BALL.loftDistance;
    const laneScore = clamp((laneOpen - (lofted ? 0 : 1.8)) / 6, -1, 1);
    const recvScore = clamp((recvOpen - 3) / 8, -1, 1);
    const progress = yToDepth(st, side, target.y) - depth;
    let score = 0.25 + laneScore * 1.15 + recvScore * 0.85 + progress * (isKeeper ? 1.2 : 3.6) - Math.max(0, d - 34) * 0.03;
    score += ((a.vision - 50) / 100) * (progress > 0.1 ? 0.6 : 0.1);
    if (through && yToDepth(st, side, target.y) > lastLine) score += 0.5 + (a.vision / 100) * 0.4 + (carrier.traits.has('needlePass') ? 0.15 : 0) + (oppPressing ? 0.6 : 0);
    if (quick) score += d < 30 ? 0.55 : -0.2;
    if (isKeeper && t.slot.position === 'FWD') score -= 0.3;
    options.push({ kind: 'pass', to: t, target, through, score });
  }

  // Dribble
  if (!isKeeper) {
    const forwardY = goalY === 0 ? -1 : 1;
    let ahead = 99;
    for (const o of opps) {
      const dy = (o.y - carrier.y) * forwardY;
      if (dy > -1 && dy < 14 && Math.abs(o.x - carrier.x) < 9) ahead = Math.min(ahead, Math.hypot(o.x - carrier.x, o.y - carrier.y));
    }
    const space = clamp((ahead - 3) / 9, 0, 1);
    let score = -0.15 + space * 1.25 + (a.dribbling - 50) / 60 - pressure * 0.55;
    if (quick) score -= 0.6;
    if (oppPressing) score -= 0.1;
    // Bend the carry towards goal, away from the nearest defender.
    const tx = clamp(carrier.x + (50 - carrier.x) * 0.25 + (ahead < 10 ? (carrier.x < 50 ? -6 : 6) : 0), 4, 96);
    const ty = clamp(carrier.y + forwardY * 14, 2, PITCH_L - 2);
    options.push({ kind: 'dribble', target: { x: tx, y: ty }, score });
  }

  options.push({ kind: 'hold', score: isKeeper ? -1.2 : -0.6 });

  const temp = DECISION.temperature;
  const max = Math.max(...options.map((o) => o.score));
  const weights = options.map((o) => [o, Math.exp((o.score - max) / temp)] as const);
  return st.rng.weighted(weights);
}

export function nearestOpponentDistance(st: EngineState, side: TeamSide, p: SimPos): number {
  let best = 99;
  for (const o of st.teams[other(side)].players) best = Math.min(best, Math.hypot(o.x - p.x, o.y - p.y));
  return best;
}
