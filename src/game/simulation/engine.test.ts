import { describe, expect, it } from 'vitest';
import { makeTeam, mirrorOf } from '../../test/fixtures/teams';
import { FULL_TICKS, PITCH_L, PITCH_W, TACTIC_COOLDOWN_MIN, TICKS_PER_MINUTE } from './constants';
import { createMatch, type CreateMatchArgs } from './engine';
import { replayMatch, replayTo, resultOf } from './replay';
import type { FootballEvent, MatchCommand } from './types';

const home = makeTeam('t-home', 55);
const away = makeTeam('t-away', 55);
const args = (seed: string, extra: Partial<CreateMatchArgs> = {}): CreateMatchArgs => ({ matchId: seed, seed, home, away, userSide: 'home', ...extra });

/** Play a match "live", dispatching commands at fixed ticks, like the UI does. */
function playLive(a: CreateMatchArgs, at: Record<number, MatchCommand['type']>) {
  const e = createMatch(a);
  while (!e.isFinished()) {
    const cmd = at[e.tick];
    if (cmd) e.dispatch(cmd, 'home');
    e.advanceTicks(1);
  }
  return e;
}

describe('determinism & replay', () => {
  it('same seed + same commands = identical events, score and snapshots', () => {
    const a = playLive(args('det-1'), { 200: 'PRESS', 700: 'QUICK_PASS' });
    const b = playLive(args('det-1'), { 200: 'PRESS', 700: 'QUICK_PASS' });
    expect(b.getEvents()).toEqual(a.getEvents());
    expect(b.getSnapshot()).toEqual(a.getSnapshot());
    expect(a.getCommands().map((c) => c.tick)).toEqual([200, 700]);
  });

  it('replaying the recorded command log reproduces the live match exactly', () => {
    const live = playLive(args('det-2'), { 150: 'QUICK_PASS', 610: 'PRESS' });
    const liveResult = resultOf(live, args('det-2'));
    const replayed = replayMatch(args('det-2'), live.getCommands());
    expect(replayed.events).toEqual(liveResult.events);
    expect(replayed.score).toEqual(liveResult.score);
    expect(replayed.playerOfMatchId).toBe(liveResult.playerOfMatchId);
  });

  it('resumes from a checkpoint (seed + commands + tick) to the same final result', () => {
    const live = playLive(args('det-3'), { 320: 'PRESS' });
    const resumed = replayTo(args('det-3'), live.getCommands(), 500);
    expect(resumed.tick).toBe(500);
    resumed.runToEnd();
    expect(resumed.getEvents()).toEqual(live.getEvents());
  });

  it('a different command changes the match (tactics are real inputs)', () => {
    const a = playLive(args('det-4'), {});
    const b = playLive(args('det-4'), { 100: 'PRESS' });
    expect(b.getEvents()).not.toEqual(a.getEvents());
  });
});

describe('termination & physical invariants (200 seeds)', () => {
  it('always finishes at 90 minutes with integer scores, monotonic clock and finite positions', () => {
    for (let i = 0; i < 200; i++) {
      const e = createMatch(args(`inv-${i}`, { userSide: null }));
      let lastMinute = 0;
      let lastTick = -1;
      while (!e.isFinished()) {
        e.advanceTicks(1);
        const s = e.getSnapshot();
        expect(s.minute).toBeGreaterThanOrEqual(lastMinute);
        expect(s.tick).toBe(lastTick + 2 === s.tick ? s.tick : lastTick + 1);
        lastMinute = s.minute;
        lastTick = s.tick;
        if (s.tick % 50 === 0) {
          for (const p of s.players) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(PITCH_W);
          }
          expect(Number.isFinite(s.ball.x) && Number.isFinite(s.ball.y) && Number.isFinite(s.ball.z)).toBe(true);
        }
        expect(s.tick).toBeLessThan(FULL_TICKS * 2);
      }
      const s = e.getSnapshot();
      expect(s.minute).toBe(90);
      expect(Number.isInteger(s.score.home) && Number.isInteger(s.score.away)).toBe(true);
      const ft = e.getEvents().at(-1) as FootballEvent;
      expect(ft.type).toBe('FULLTIME');
      expect(e.getEvents().filter((x) => x.type === 'HALFTIME')).toHaveLength(1);
    }
  });

  it('the ball never jumps during open play', () => {
    for (let i = 0; i < 30; i++) {
      const e = createMatch(args(`jump-${i}`, { userSide: null }));
      let prev = e.getSnapshot();
      while (!e.isFinished()) {
        e.advanceTicks(1);
        const s = e.getSnapshot();
        // Only restarts (dead ball placed on a spot) and the halftime reset may relocate the ball.
        if (prev.phase === 'play' && s.phase === 'play' && prev.ball.state !== 'dead' && s.ball.state !== 'dead') {
          expect(Math.hypot(s.ball.x - prev.ball.x, s.ball.y - prev.ball.y)).toBeLessThan(9);
        }
        prev = s;
      }
    }
  });
});

describe('event log integrity', () => {
  const results = Array.from({ length: 120 }, (_, i) => replayMatch(args(`ev-${i}`, { userSide: null }), []));

  it('every goal comes from a scoring shot by a player of that team, from a credible spot', () => {
    for (const r of results) {
      const shots = new Map(r.events.filter((e) => e.type === 'SHOT').map((e) => [e.id, e]));
      let goals = { home: 0, away: 0 };
      for (const e of r.events) {
        if (e.type !== 'GOAL') continue;
        goals = { ...goals, [e.team]: goals[e.team] + 1 };
        const shot = shots.get(e.shotEventId);
        expect(shot?.type).toBe('SHOT');
        if (shot?.type !== 'SHOT') continue;
        expect(shot.outcome).toBe('goal');
        expect(shot.shooterId).toBe(e.scorerId);
        const team = e.team === 'home' ? home : away;
        expect(team.players.some((p) => p.id === e.scorerId)).toBe(true);
        // Shot from inside the opponent's half, within shooting range of the goal it went into.
        const goalY = shot.target.y < PITCH_L / 2 ? 0 : PITCH_L;
        expect(Math.hypot(50 - shot.from.x, goalY - shot.from.y)).toBeLessThan(55);
        if (e.assistId) expect(team.players.some((p) => p.id === e.assistId)).toBe(true);
        expect(e.assistId).not.toBe(e.scorerId);
      }
      expect(goals).toEqual(r.score);
    }
  });

  it('a shot is never both saved and scored; saves follow saved shots; blockers are opponents', () => {
    for (const r of results) {
      const savedShotIds = r.events.filter((e) => e.type === 'SAVE').map((e) => (e.type === 'SAVE' ? e.shotEventId : -1));
      const goalShotIds = r.events.filter((e) => e.type === 'GOAL').map((e) => (e.type === 'GOAL' ? e.shotEventId : -1));
      expect(savedShotIds.filter((id) => goalShotIds.includes(id))).toEqual([]);
      for (const e of r.events) {
        if (e.type === 'SAVE') {
          const shot = r.events.find((s) => s.id === e.shotEventId);
          expect(shot?.type === 'SHOT' && shot.outcome).toBe('saved');
          expect(shot!.id).toBeLessThan(e.id);
        }
        if (e.type === 'SHOT' && e.outcome === 'blocked') {
          const defending = e.team === 'home' ? away : home;
          expect(defending.players.some((p) => p.id === e.blockerId)).toBe(true);
        }
      }
    }
  });
});

describe('tactical commands', () => {
  it('are rejected outside their window without consuming the cooldown', () => {
    const e = createMatch(args('cmd-1'));
    e.advanceTicks(100);
    expect(e.dispatch('PRESS', 'home').ok).toBe(true);
    e.advanceTicks(1);
    const before = e.getSnapshot().tactics.home;
    const again = e.dispatch('PRESS', 'home');
    expect(again.ok).toBe(false);
    expect(e.getSnapshot().tactics.home).toEqual(before);
    // Still on cooldown after it expires…
    e.advanceTicks(TICKS_PER_MINUTE * 13);
    expect(e.dispatch('PRESS', 'home').ok).toBe(false);
    // …and usable once the cooldown has passed.
    e.advanceTicks(TICKS_PER_MINUTE * TACTIC_COOLDOWN_MIN);
    expect(e.dispatch('PRESS', 'home').ok).toBe(true);
    // Halftime and full time reject commands.
    while (e.getSnapshot().phase !== 'halftime') e.advanceTicks(1);
    expect(e.dispatch('QUICK_PASS', 'home')).toMatchObject({ ok: false });
    e.runToEnd();
    expect(e.dispatch('QUICK_PASS', 'home')).toMatchObject({ ok: false, reason: 'The match is over' });
  });
});

describe('fairness and tactical influence (batch sims)', () => {
  it('a team against its own mirror image wins about as often as it loses', () => {
    const a = makeTeam('mirror-a', 55);
    const b = mirrorOf(a);
    let hw = 0;
    let aw = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const r = replayMatch({ matchId: `m${i}`, seed: `mirror-${i}`, home: a, away: b }, []);
      if (r.score.home > r.score.away) hw++;
      else if (r.score.away > r.score.home) aw++;
    }
    // Decisive results split ~50/50: allow 3.5 standard deviations.
    const n = hw + aw;
    expect(Math.abs(hw - n / 2)).toBeLessThan(3.5 * Math.sqrt(n / 4));
  });

  it('a much stronger team has a clear edge but does not win every time', () => {
    const strong = makeTeam('strong', 64);
    const weak = makeTeam('weak', 46);
    let wins = 0;
    let losses = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const r = replayMatch({ matchId: `s${i}`, seed: `gap-${i}`, home: i % 2 ? strong : weak, away: i % 2 ? weak : strong }, []);
      const strongGoals = i % 2 ? r.score.home : r.score.away;
      const weakGoals = i % 2 ? r.score.away : r.score.home;
      if (strongGoals > weakGoals) wins++;
      if (weakGoals > strongGoals) losses++;
    }
    expect(wins / N).toBeGreaterThan(0.6);
    expect(wins).toBeLessThan(N);
    expect(losses).toBeGreaterThan(0);
  });

  it('pressing costs stamina and wins the ball back more often', () => {
    let fatigueNo = 0;
    let fatiguePress = 0;
    let tacklesNo = 0;
    let tacklesPress = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const plain = replayMatch(args(`press-${i}`), []);
      const e = createMatch(args(`press-${i}`));
      while (!e.isFinished()) {
        e.dispatch('PRESS', 'home'); // re-press whenever allowed
        e.advanceTicks(1);
      }
      const pressed = resultOf(e, args(`press-${i}`));
      fatigueNo += plain.stats.fatigue.home;
      fatiguePress += pressed.stats.fatigue.home;
      tacklesNo += plain.stats.tacklesWon.home;
      tacklesPress += pressed.stats.tacklesWon.home;
    }
    expect(fatiguePress / N).toBeLessThan(fatigueNo / N - 0.03);
    expect(tacklesPress / N).toBeGreaterThan((tacklesNo / N) * 1.1);
  });
});
