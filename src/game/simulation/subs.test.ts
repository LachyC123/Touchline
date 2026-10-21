import { describe, expect, it } from 'vitest';
import { makeTeam, withBench } from '../../test/fixtures/teams';
import { SUBS } from './constants';
import { createMatch, type CreateMatchArgs, type MatchEngine } from './engine';
import { replayMatch, replayTo, resultOf } from './replay';
import type { FootballEvent } from './types';

const home = withBench(makeTeam('s-home', 55), 's-home', 55, 4);
const away = makeTeam('s-away', 55);
const args = (seed: string): CreateMatchArgs => ({ matchId: seed, seed, home, away, userSide: 'home' });

function toHalftime(e: MatchEngine): void {
  while (e.getSnapshot().phase !== 'halftime') e.advanceTicks(1);
}

/** The most tired home outfielder at half-time and the first bench player. */
function plannedSub(e: MatchEngine): { outId: string; inId: string } {
  const snap = e.getSnapshot();
  const tired = snap.players.filter((p) => p.side === 'home' && home.players.find((x) => x.id === p.id)?.role !== 'GK').sort((a, b) => a.stamina - b.stamina)[0]!;
  return { outId: tired.id, inId: home.bench![0]!.id };
}

describe('half-time substitutions', () => {
  it('only at half-time, from the bench, for a player on the pitch, at most twice', () => {
    const e = createMatch(args('sub-1'));
    e.advanceTicks(50);
    expect(e.dispatchSub('home', home.players[3]!.id, home.bench![0]!.id).ok).toBe(false);
    toHalftime(e);
    expect(e.dispatchSub('home', home.players[3]!.id, 'nobody').ok).toBe(false);
    expect(e.dispatchSub('home', 'nobody', home.bench![0]!.id).ok).toBe(false);
    expect(e.dispatchSub('home', home.players[3]!.id, home.bench![0]!.id).ok).toBe(true);
    expect(e.dispatchSub('home', home.players[4]!.id, home.bench![0]!.id).ok).toBe(false); // already coming on
    expect(e.dispatchSub('home', home.players[3]!.id, home.bench![1]!.id).ok).toBe(false); // already going off
    expect(e.dispatchSub('home', home.players[4]!.id, home.bench![1]!.id).ok).toBe(true);
    expect(SUBS.max).toBe(2);
    expect(e.dispatchSub('home', home.players[5]!.id, home.bench![2]!.id).ok).toBe(false);
    expect(e.benchFor('home').changesLeft).toBe(0);
    expect(e.dispatchSub('away', away.players[3]!.id, home.bench![2]!.id).ok).toBe(false); // not their bench
  });

  it('the substitute takes over the slot, fresh, and the change is logged', () => {
    const e = createMatch(args('sub-2'));
    toHalftime(e);
    const { outId, inId } = plannedSub(e);
    const outStamina = e.getSnapshot().players.find((p) => p.id === outId)!.stamina;
    expect(e.dispatchSub('home', outId, inId).ok).toBe(true);
    e.advanceTicks(1);
    const snap = e.getSnapshot();
    const ids = snap.players.map((p) => p.id);
    expect(ids).toContain(inId);
    expect(ids).not.toContain(outId);
    expect(snap.players.filter((p) => p.side === 'home')).toHaveLength(7);
    expect(snap.players.find((p) => p.id === inId)!.stamina).toBeGreaterThan(outStamina);
    const sub = e.getEvents().find((ev): ev is Extract<FootballEvent, { type: 'SUB' }> => ev.type === 'SUB');
    expect(sub).toMatchObject({ team: 'home', outId, inId, minute: 45 });
    e.runToEnd();
    const result = resultOf(e, args('sub-2'));
    // Both players get a line: the starter for his 45 minutes, the substitute after.
    expect(result.players.find((l) => l.playerId === outId)).toBeDefined();
    expect(result.players.find((l) => l.playerId === inId)).toBeDefined();
    // Nothing the substitute does is credited to the man he replaced, and vice versa.
    for (const ev of e.getEvents()) if (ev.tick > sub!.tick && 'shooterId' in ev) expect(ev.shooterId).not.toBe(outId);
  });

  it('replays exactly, including from a checkpoint saved at the half-time tick', () => {
    const live = createMatch(args('sub-3'));
    toHalftime(live);
    const htTick = live.tick;
    const { outId, inId } = plannedSub(live);
    live.dispatchSub('home', outId, inId);
    live.runToEnd();
    const commands = live.getCommands();
    expect(commands).toEqual([{ type: 'SUB', side: 'home', tick: htTick, outId, inId }]);
    expect(replayMatch(args('sub-3'), commands).events).toEqual([...live.getEvents()]);
    // Resume from a checkpoint at exactly the half-time tick: the queued change still happens.
    const resumed = replayTo(args('sub-3'), commands, htTick);
    resumed.runToEnd();
    expect(resumed.getEvents()).toEqual(live.getEvents());
  });

  it('fresh legs show: two changes leave the side less tired at full time (paired seeds)', () => {
    let withSubs = 0;
    let without = 0;
    for (let i = 0; i < 12; i++) {
      const a = createMatch(args(`sub-fit-${i}`));
      a.runToEnd();
      without += a.getStats().fatigue.home;
      const b = createMatch(args(`sub-fit-${i}`));
      toHalftime(b);
      const tired = b.getSnapshot().players.filter((p) => p.side === 'home').sort((x, y) => x.stamina - y.stamina);
      const outfield = tired.filter((p) => home.players.find((x) => x.id === p.id)?.role !== 'GK');
      b.dispatchSub('home', outfield[0]!.id, home.bench![0]!.id);
      b.dispatchSub('home', outfield[1]!.id, home.bench![1]!.id);
      b.runToEnd();
      withSubs += b.getStats().fatigue.home;
    }
    expect(withSubs).toBeGreaterThan(without);
  });
});
