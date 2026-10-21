import { describe, expect, it } from 'vitest';
import { createCareer } from '../club/newCareer';
import { replayMatch } from '../../game/simulation/replay';
import { matchArgs, prepareMatch, settleMatch } from './settle';
import { factsFrom, judge, objectivesFor, OBJECTIVE_REWARD, settleObjectives } from './objectives';

describe('match objectives', () => {
  it('three per match, fixed for the match, at most one naming a player, varied across matches', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const s = createCareer(`obj-${i}`, 'x');
      const a = objectivesFor(s);
      expect(a).toHaveLength(3);
      expect(objectivesFor(structuredClone(s))).toEqual(a);
      expect(new Set(a.map((o) => o.id)).size).toBe(3);
      expect(a.filter((o) => o.playerId).length).toBeLessThanOrEqual(1);
      for (const o of a) {
        seen.add(o.id);
        if (o.playerId) expect(Object.values(s.lineup)).toContain(o.playerId);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it('frozen at kick-off, judged from the events, paid in stars; live and full-time verdicts agree', () => {
    let starsSeen = 0;
    for (let i = 0; i < 25; i++) {
      const s = createCareer(`obj-pay-${i}`, 'x');
      const pm = prepareMatch(s);
      expect(pm.objectives).toEqual(objectivesFor(s));
      const result = replayMatch(matchArgs(pm), []);
      const draft = structuredClone(s);
      const record = settleMatch(draft, pm, result);
      const { results, stars, coins } = settleObjectives(pm.objectives!, result.events, pm.userSide);
      expect(record.objectives).toEqual(results);
      expect(coins).toBe(stars * OBJECTIVE_REWARD.perStar + (stars === 3 ? OBJECTIVE_REWARD.allThree : 0));
      expect(record.rewards.lines.find((l) => l.label.startsWith('Objectives'))?.coins).toBe(coins);
      starsSeen += stars;
      // Anything ticked off during the match is still ticked at full time.
      for (let k = 1; k <= result.events.length; k += 25) {
        const live = factsFrom(result.events.slice(0, k), pm.userSide, false);
        pm.objectives!.forEach((o, j) => {
          if (judge(o, live) === true) expect(results[j]!.done).toBe(true);
          if (judge(o, live) === false) expect(results[j]!.done).toBe(false);
        });
      }
    }
    expect(starsSeen).toBeGreaterThan(0);
  });
});
