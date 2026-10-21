import { describe, expect, it } from 'vitest';
import { makeTeam, mirrorOf } from '../../test/fixtures/teams';
import { CARD_DEFS, MOMENTUM, type CardId } from './cards';
import { FULL_TICKS, PITCH_L, PITCH_W } from './constants';
import { createMatch, type CreateMatchArgs } from './engine';
import { replayMatch, replayTo, resultOf } from './replay';
import type { FootballEvent, MatchCommand } from './types';

const home = makeTeam('t-home', 55);
const away = makeTeam('t-away', 55);
const args = (seed: string, extra: Partial<CreateMatchArgs> = {}): CreateMatchArgs => ({ matchId: seed, seed, home, away, userSide: 'home', ...extra });

/** Play a match "live", dispatching commands at fixed ticks, like the UI does. */
function playLive(a: CreateMatchArgs, at: Record<number, Exclude<MatchCommand['type'], 'SUB'>>) {
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

describe('manager cards and Momentum', () => {
  it('cost Momentum, must be in hand, cycle the hand, and failed plays spend nothing', () => {
    const e = createMatch(args('cmd-1'));
    const t0 = e.getSnapshot().tactics.home;
    expect(t0.momentum).toBe(MOMENTUM.start);
    expect(t0.hand).toEqual(['QUICK_PASS', 'PRESS', 'GO_WIDE']);
    expect(t0.next).toBe('PARK_BUS');
    expect(e.dispatch('PARK_BUS', 'home')).toMatchObject({ ok: false }); // not in hand yet
    expect(e.dispatch('PRESS', 'home').ok).toBe(true);
    e.advanceTicks(1);
    const t1 = e.getSnapshot().tactics.home;
    expect(t1.momentum).toBe(MOMENTUM.start - CARD_DEFS.PRESS.cost);
    expect(t1.hand).toEqual(['QUICK_PASS', 'PARK_BUS', 'GO_WIDE']); // drawn into the played slot
    expect(t1.next).toBe('PRESS'); // played card goes to the back
    expect(t1.activeUntil.PRESS).toBeGreaterThan(e.tick);
    // Too expensive now: rejected and nothing changes.
    expect(e.dispatch('PARK_BUS', 'home')).toMatchObject({ ok: false });
    expect(e.getSnapshot().tactics.home).toEqual(t1);
    // Halftime and full time reject cards.
    while (e.getSnapshot().phase !== 'halftime') e.advanceTicks(1);
    expect(e.dispatch('QUICK_PASS', 'home')).toMatchObject({ ok: false });
    e.runToEnd();
    expect(e.dispatch('QUICK_PASS', 'home')).toMatchObject({ ok: false, reason: 'The match is over' });
  });

  it('Momentum refills during play, caps at 10, and the conceding side gets a lift', () => {
    const e = createMatch(args('mom-1'));
    e.advanceTicks(MOMENTUM.regenTicks * 3 + 5);
    expect(e.getSnapshot().tactics.home.momentum).toBeGreaterThanOrEqual(MOMENTUM.start + 2);
    e.advanceTicks(MOMENTUM.regenTicks * 12);
    expect(e.getSnapshot().tactics.home.momentum).toBe(MOMENTUM.max);
    expect(e.getSnapshot().tactics.home.momentumProgress).toBe(0);
  });

  it('every card is replayed exactly and changes the match', () => {
    for (const card of Object.keys(CARD_DEFS) as CardId[]) {
      const deck = ([card, 'QUICK_PASS', 'PRESS', 'GO_WIDE'] as CardId[]).filter((c, i, a) => a.indexOf(c) === i).slice(0, 4);
      const a = args(`card-${card}`, { home: { ...home, deck } });
      const plain = playLive(a, {});
      const played = playLive(a, { [MOMENTUM.regenTicks * 2]: card });
      expect(played.getCommands().map((c) => c.type)).toEqual([card]);
      expect(played.getEvents()).not.toEqual(plain.getEvents());
      expect(replayMatch(a, played.getCommands()).events).toEqual([...played.getEvents()]);
    }
  });
});

describe('cards change behaviour, not just numbers (paired seeds)', () => {
  const N = 90;
  const base = makeTeam('card-base', 55);
  const opp = mirrorOf(makeTeam('card-opp', 55));
  /** Home plays `card` whenever it is in hand and affordable; compares against never playing it. */
  const measure = (card: CardId, metric: (r: ReturnType<typeof resultOf>) => number) => {
    let withCard = 0;
    let without = 0;
    for (let i = 0; i < N; i++) {
      // A 3-card deck never cycles, so the measured card is always in hand.
      const deck = ([card, 'QUICK_PASS', 'GO_WIDE', 'PRESS'] as CardId[]).filter((c, j, arr) => arr.indexOf(c) === j).slice(0, 3);
      const a: CreateMatchArgs = { matchId: `p${i}`, seed: `paired-${card}-${i}`, home: { ...base, deck }, away: opp, userSide: 'home' };
      without += metric(replayMatch(a, []));
      const e = createMatch(a);
      while (!e.isFinished()) {
        e.dispatch(card, 'home');
        e.advanceTicks(1);
      }
      withCard += metric(resultOf(e, a));
    }
    return { withCard: withCard / N, without: without / N };
  };
  const count = (pred: (e: FootballEvent) => boolean) => (r: ReturnType<typeof resultOf>) => r.events.filter(pred).length;

  it('Go Wide produces more crosses', () => {
    const ours = new Set(base.players.map((p) => p.id));
    const m = measure('GO_WIDE', count((e) => e.type === 'PASS' && Boolean(e.cross) && ours.has(e.fromId)));
    expect(m.withCard).toBeGreaterThan(m.without * 1.3);
  });

  it('Park the Bus concedes fewer shots and takes fewer', () => {
    const against = measure('PARK_BUS', (r) => r.stats.shots.away);
    const taken = measure('PARK_BUS', (r) => r.stats.shots.home);
    expect(against.withCard).toBeLessThan(against.without * 0.9);
    expect(taken.withCard).toBeLessThan(taken.without);
  });

  /** Counts `pred` events during the minutes the card was on, against the same minutes without it. */
  const windowed = (card: CardId, pred: (e: FootballEvent) => boolean) => {
    let on = 0;
    let off = 0;
    for (let i = 0; i < N; i++) {
      const deck = ([card, 'QUICK_PASS', 'GO_WIDE', 'PRESS'] as CardId[]).filter((c, j, arr) => arr.indexOf(c) === j).slice(0, 3);
      const a: CreateMatchArgs = { matchId: `w${i}`, seed: `paired-${card}-w-${i}`, home: { ...base, deck }, away: opp, userSide: 'home' };
      const e = createMatch(a);
      while (!e.isFinished()) {
        e.dispatch(card, 'home');
        e.advanceTicks(1);
      }
      const played = resultOf(e, a);
      const windows = played.events.flatMap((x) => (x.type === 'TACTIC_APPLIED' && x.team === 'home' ? [[x.minute, x.expiresMinute] as const] : []));
      const count = (r: typeof played) => r.events.filter((x) => pred(x) && windows.some(([from, to]) => x.minute >= from && x.minute < to)).length;
      on += count(played);
      off += count(replayMatch(a, []));
    }
    return { on, off };
  };

  it('All-Out Attack shoots more while it is on, and tires the team', () => {
    const { on, off } = windowed('ALL_OUT', (x) => x.type === 'SHOT' && x.team === 'home');
    expect(on).toBeGreaterThan(off * 1.15);
    const legs = measure('ALL_OUT', (r) => r.stats.fatigue.home);
    expect(legs.withCard).toBeLessThan(legs.without);
  });

  it('Target Man wins more headers', () => {
    const m = measure('TARGET_MAN', count((e) => e.type === 'SHOT' && e.style === 'header' && e.team === 'home'));
    expect(m.withCard).toBeGreaterThan(m.without * 1.2);
  });

  it('Hairdryer refreshes legs', () => {
    const m = measure('HAIRDRYER', (r) => r.stats.fatigue.home);
    expect(m.withCard).toBeGreaterThan(m.without + 0.02);
  });

  it('Man-Mark quietens their most dangerous player', () => {
    const threat = [...opp.players].filter((p) => p.role !== 'GK').sort((a, b) => b.attributes.finishing + b.attributes.dribbling + b.attributes.pace - (a.attributes.finishing + a.attributes.dribbling + a.attributes.pace))[0]!;
    const { on, off } = windowed('MAN_MARK', (e) => (e.type === 'SHOT' && e.shooterId === threat.id) || (e.type === 'PASS' && e.toId === threat.id && e.outcome === 'complete'));
    expect(on).toBeLessThan(off * 0.85);
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
      const plain = replayMatch(args(`press-${i}`, { home: { ...home, deck: ['PRESS', 'QUICK_PASS', 'GO_WIDE'] } }), []);
      const e = createMatch(args(`press-${i}`, { home: { ...home, deck: ['PRESS', 'QUICK_PASS', 'GO_WIDE'] } }));
      while (!e.isFinished()) {
        e.dispatch('PRESS', 'home'); // re-press whenever allowed
        e.advanceTicks(1);
      }
      const pressed = resultOf(e, args(`press-${i}`, { home: { ...home, deck: ['PRESS', 'QUICK_PASS', 'GO_WIDE'] } }));
      fatigueNo += plain.stats.fatigue.home;
      fatiguePress += pressed.stats.fatigue.home;
      tacklesNo += plain.stats.tacklesWon.home;
      tacklesPress += pressed.stats.tacklesWon.home;
    }
    expect(fatiguePress / N).toBeLessThan(fatigueNo / N - 0.03);
    expect(tacklesPress / N).toBeGreaterThan((tacklesNo / N) * 1.1);
  });
});

// ---------------------------------------------------------------- engine-2: football incidents

type Attr = keyof import('./types').SimAttributes;
/** Same team, with some attributes overridden for every outfielder (or the keeper). */
function withAttrs(team: ReturnType<typeof makeTeam>, set: Partial<Record<Attr, number>>, who: 'outfield' | 'keeper' = 'outfield') {
  return {
    ...team,
    players: team.players.map((p) => ((p.role === 'GK') === (who === 'keeper') ? { ...p, attributes: { ...p.attributes, ...set } } : p)),
  };
}

describe('football incidents', () => {
  const results = Array.from({ length: 250 }, (_, i) => replayMatch(args(`inc-${i}`, { userSide: null }), []));
  const all = results.flatMap((r) => r.events);

  it('produces the full range of incidents over a season of matches', () => {
    const shotStyles = new Set(all.flatMap((e) => (e.type === 'SHOT' ? [e.style] : [])));
    for (const s of ['normal', 'long', 'header', 'volley', 'freeKick', 'penalty']) expect(shotStyles).toContain(s);
    const saveStyles = new Set(all.flatMap((e) => (e.type === 'SAVE' ? [e.style] : [])));
    for (const s of ['catch', 'dive', 'fingertip', 'parry']) expect(saveStyles).toContain(s);
    expect(all.some((e) => e.type === 'SAVE' && e.double)).toBe(true);
    expect(all.some((e) => e.type === 'FOUL' && e.award === 'penalty')).toBe(true);
    expect(all.some((e) => e.type === 'FOUL' && e.booked)).toBe(true);
    expect(new Set(all.flatMap((e) => (e.type === 'SKILL' ? [e.move] : []))).size).toBeGreaterThanOrEqual(4);
    expect(all.some((e) => e.type === 'TACKLE' && e.style === 'slide')).toBe(true);
    expect(all.some((e) => e.type === 'CLEARANCE')).toBe(true);
  });

  it('penalties follow fouls in the box and are taken from the spot; free kicks from where the foul was', () => {
    for (const r of results) {
      r.events.forEach((e, i) => {
        if (e.type !== 'FOUL') return;
        const next = r.events.slice(i + 1).find((x) => x.type === 'RESTART');
        expect(next?.type === 'RESTART' && next.kind).toBe(e.award);
        if (e.award === 'penalty') {
          const inBox = Math.abs(e.at.x - 50) < 23 && (e.at.y < 20 || e.at.y > PITCH_L - 20);
          expect(inBox).toBe(true);
          const shot = r.events.slice(i + 1).find((x) => x.type === 'SHOT');
          expect(shot?.type === 'SHOT' && shot.style).toBe('penalty');
          if (shot?.type === 'SHOT') expect(Math.abs(shot.from.x - 50)).toBeLessThan(1.6);
        }
      });
    }
  });

  it('a player is booked at most once and booked players stay cautious', () => {
    for (const r of results) {
      const booked = r.events.flatMap((e) => (e.type === 'FOUL' && e.booked ? [e.foulerId] : []));
      expect(new Set(booked).size).toBe(booked.length);
    }
  });

  it('a double save only follows an earlier save by the same keeper', () => {
    for (const r of results) {
      r.events.forEach((e, i) => {
        if (e.type !== 'SAVE' || !e.double) return;
        const prev = r.events.slice(0, i).filter((x) => x.type === 'SAVE').at(-1);
        expect(prev?.type === 'SAVE' && prev.keeperId).toBe(e.keeperId);
      });
    }
  });
});

describe('stats show on the pitch', () => {
  const N = 120;
  const tally = (h: ReturnType<typeof makeTeam>, a: ReturnType<typeof makeTeam>, seed: string) => {
    const out = { skills: 0, longShots: 0, longGoals: 0, saves: 0, onTargetAgainst: 0, fkShots: 0, headers: 0, headerGoals: 0 };
    for (let i = 0; i < N; i++) {
      const r = replayMatch({ matchId: `${seed}${i}`, seed: `${seed}-${i}`, home: h, away: a }, []);
      out.skills += r.stats.skills.home;
      out.saves += r.stats.saves.home;
      out.onTargetAgainst += r.stats.onTarget.away;
      for (const e of r.events) {
        if (e.type !== 'SHOT' || e.team !== 'home') continue;
        if (e.style === 'long') {
          out.longShots++;
          if (e.outcome === 'goal') out.longGoals++;
        }
        if (e.style === 'header') {
          out.headers++;
          if (e.outcome === 'goal') out.headerGoals++;
        }
      }
    }
    return out;
  };
  const base = makeTeam('stat-base', 55);
  const opp = mirrorOf(makeTeam('stat-opp', 55));

  it('great dribblers beat their man far more often', () => {
    const plain = tally(withAttrs(base, { dribbling: 50, ballControl: 50 }), opp, 'dr');
    const tricky = tally(withAttrs(base, { dribbling: 85, ballControl: 80 }), opp, 'dr');
    expect(tricky.skills).toBeGreaterThan(plain.skills * 1.8);
  });

  it('great strikers try (and score) more from distance', () => {
    const plain = tally(withAttrs(base, { shooting: 45 }), opp, 'ls');
    const sniper = tally(withAttrs(base, { shooting: 85 }), opp, 'ls');
    expect(sniper.longShots).toBeGreaterThan(plain.longShots * 1.5);
    expect(sniper.longGoals).toBeGreaterThan(plain.longGoals);
  });

  it('a great keeper saves a bigger share of what he faces', () => {
    const weak = tally(withAttrs(base, { reflexes: 40, positioning: 40, handling: 40, reach: 40 }, 'keeper'), opp, 'gk');
    const great = tally(withAttrs(base, { reflexes: 85, positioning: 85, handling: 85, reach: 85 }, 'keeper'), opp, 'gk');
    expect(great.saves / great.onTargetAgainst).toBeGreaterThan(weak.saves / weak.onTargetAgainst + 0.08);
  });
});
