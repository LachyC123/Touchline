import { describe, expect, it } from 'vitest';
import type { FootballEvent } from '../../game/simulation/types';
import { strengthLap } from '../league/league';
import { factsFrom, judge, objectivesFor } from '../match/objectives';
import { acceptOffer, offersAfterMatch, setListed } from '../transfers/market';
import { migrateSave } from '../../storage/migrations';
import { clubOf } from '../world/world';
import { createCareer } from './newCareer';
import { opponentSquad } from './opponents';
import { nemesisOf, rivalryAfterMatch } from './rivalry';

const goal = (scorerId: string, team: 'home' | 'away', minute = 30) => ({ type: 'GOAL', scorerId, team, minute, shotEventId: 0, id: minute, tick: minute * 12 }) as unknown as FootballEvent;

describe('rivalries', () => {
  it('two goals against you make a nemesis; next time he scores again or is kept quiet', () => {
    const s = createCareer('riv-1', 'x');
    const opp = s.world.divisions[0]!.clubIds[1]!;
    const input = (events: FootballEvent[], n: number) => ({ events, side: 'home' as const, opponentId: opp, number: n, theirPlayers: new Set(['foe-9']), nameOf: () => 'Gary Striker' });
    expect(rivalryAfterMatch(s, input([goal('foe-9', 'away')], 1))).toEqual([]);
    const second = rivalryAfterMatch(s, input([goal('foe-9', 'away')], 2));
    expect(second[0]).toMatchObject({ kind: 'newNemesis', playerId: 'foe-9' });
    expect(nemesisOf(s)?.goals).toBe(2);
    expect(rivalryAfterMatch(s, input([goal('foe-9', 'away')], 3))[0]).toMatchObject({ kind: 'nemesisAgain' });
    expect(rivalryAfterMatch(s, input([], 4))[0]).toMatchObject({ kind: 'nemesisQuiet' });
  });

  it('with the nemesis in their side, stopping him is the objective — and it fails the moment he scores', () => {
    const s = createCareer('riv-2', 'x');
    s.foes = [{ playerId: 'foe-9', name: 'Gary Striker', clubId: 'x', goals: 3, lastMatch: 1 }];
    const obj = objectivesFor(s, new Set(['foe-9']));
    expect(obj[0]).toMatchObject({ id: 'stopNemesis', playerId: 'foe-9' });
    expect(obj).toHaveLength(3);
    expect(judge(obj[0]!, factsFrom([], 'home', false))).toBeNull();
    expect(judge(obj[0]!, factsFrom([goal('foe-9', 'away')], 'home', false))).toBe(false);
    expect(judge(obj[0]!, factsFrom([goal('ours', 'home')], 'home', true))).toBe(true);
    expect(objectivesFor(s, new Set()).some((o) => o.id === 'stopNemesis')).toBe(false);
  });

  it('a sold player turns up in his new club’s side with the same face, and haunts you when he scores', () => {
    const s = createCareer('riv-3', 'x');
    const id = s.lineup.FWD_R!;
    setListed(s, id, true);
    let offer;
    for (let i = 0; i < 10 && !offer; i++) {
      s.matchNumber++;
      offer = offersAfterMatch(s).find((o) => o.playerId === id);
    }
    acceptOffer(s, offer!.id);
    const club = clubOf(s.world, offer!.clubId)!;
    const theirs = opponentSquad(s.careerSeed, club, strengthLap(s.season), s.world);
    const him = theirs.find((p) => p.id === id);
    expect(him?.lastName).toBe(s.footballers[id]!.lastName);
    expect(him?.appearance).toEqual(s.footballers[id]!.appearance);
    const lines = rivalryAfterMatch(s, { events: [goal(id, 'away')], side: 'home', opponentId: club.id, number: s.matchNumber + 1, theirPlayers: new Set(theirs.map((p) => p.id)), nameOf: () => him!.lastName });
    expect(lines.some((l) => l.kind === 'exHaunts' && l.playerId === id)).toBe(true);
    expect(s.foes.find((f) => f.playerId === id)?.former).toBe(true);
  });

  it('a v9 save gains an empty rivalry record', () => {
    const s = createCareer('riv-4', 'x') as unknown as Record<string, unknown>;
    const old = { ...s, schemaVersion: 9 } as Record<string, unknown>;
    delete old.foes;
    old.world = { ...(s.world as object), arrivals: undefined };
    const m = migrateSave(old);
    expect(m.schemaVersion).toBe(10);
    expect(m.foes).toEqual([]);
    expect(m.world.arrivals).toEqual([]);
  });
});
