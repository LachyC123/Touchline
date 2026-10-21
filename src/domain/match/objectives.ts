import type { FootballEvent, TeamSide } from '../../game/simulation/types';
import { stream } from '../rng';
import type { ClubSave } from '../save/types';

/**
 * Three objectives per match, drawn from the career seed and the match number, some naming
 * your own players ("Get Okafor on the scoresheet"). Each is judged only from recorded match
 * events, so the live HUD and settlement can never disagree. Stars pay coins at full time.
 */

export const OBJECTIVE_IDS = ['winBy2', 'cleanSheet', 'header', 'longShot', 'cards2', 'subScores', 'captainScores', 'playerScores', 'playerAssists', 'early', 'threeGoals', 'onTarget6'] as const;
export type ObjectiveId = (typeof OBJECTIVE_IDS)[number];

export interface Objective {
  id: ObjectiveId;
  text: string;
  playerId?: string;
}

export const OBJECTIVE_REWARD = { perStar: 25, allThree: 50 } as const;

interface Facts {
  final: boolean;
  /** Latest minute seen (live); after full time everything is decided. */
  minute: number;
  gf: number;
  ga: number;
  goals: { scorerId: string; assistId?: string; minute: number; style: string }[];
  cardsPlayed: number;
  onTarget: number;
  subsIn: Set<string>;
}

export function factsFrom(events: readonly FootballEvent[], side: TeamSide, final: boolean): Facts {
  const shots = new Map<number, Extract<FootballEvent, { type: 'SHOT' }>>();
  const f: Facts = { final, minute: final ? 999 : (events.at(-1)?.minute ?? 0), gf: 0, ga: 0, goals: [], cardsPlayed: 0, onTarget: 0, subsIn: new Set() };
  for (const e of events) {
    if (e.type === 'SHOT') {
      shots.set(e.id, e);
      if (e.team === side && (e.outcome === 'goal' || e.outcome === 'saved')) f.onTarget++;
    } else if (e.type === 'GOAL') {
      if (e.team === side) {
        f.gf++;
        f.goals.push({ scorerId: e.scorerId, ...(e.assistId ? { assistId: e.assistId } : {}), minute: e.minute, style: shots.get(e.shotEventId)?.style ?? 'normal' });
      } else f.ga++;
    } else if (e.type === 'TACTIC_APPLIED' && e.team === side) f.cardsPlayed++;
    else if (e.type === 'SUB' && e.team === side) f.subsIn.add(e.inId);
  }
  return f;
}

/** Done (true), failed for good (false) or still open (null) given the facts so far. */
export function judge(o: Objective, f: Facts): boolean | null {
  const open = f.final ? false : null;
  const yes = (b: boolean) => (b ? true : open);
  switch (o.id) {
    case 'winBy2':
      return f.final ? f.gf - f.ga >= 2 : null;
    case 'cleanSheet':
      return f.ga > 0 ? false : f.final ? true : null;
    case 'header':
      return yes(f.goals.some((g) => g.style === 'header'));
    case 'longShot':
      return yes(f.goals.some((g) => g.style === 'long'));
    case 'cards2':
      return yes(f.cardsPlayed >= 2);
    case 'subScores':
      return yes(f.goals.some((g) => f.subsIn.has(g.scorerId)));
    case 'captainScores':
    case 'playerScores':
      return yes(f.goals.some((g) => g.scorerId === o.playerId));
    case 'playerAssists':
      return yes(f.goals.some((g) => g.assistId === o.playerId));
    case 'early':
      return f.goals.some((g) => g.minute <= 15) ? true : f.minute > 15 ? false : null;
    case 'threeGoals':
      return yes(f.gf >= 3);
    case 'onTarget6':
      return yes(f.onTarget >= 6);
  }
}

/** This match's three objectives (pure: same squad and match number, same three). */
export function objectivesFor(save: Pick<ClubSave, 'careerSeed' | 'matchNumber' | 'lineup' | 'footballers' | 'captainId'>): Objective[] {
  const rng = stream(`${save.careerSeed}:objectives:${save.matchNumber + 1}`, 'reward');
  const starters = Object.values(save.lineup).flatMap((id) => (save.footballers[id] ? [save.footballers[id]] : []));
  const attackers = starters.filter((p) => p.primaryPosition === 'FWD' || p.primaryPosition === 'MID').sort((a, b) => a.id.localeCompare(b.id));
  const captain = save.captainId ? starters.find((p) => p.id === save.captainId && p.primaryPosition !== 'GK') : undefined;
  const scorer = attackers.length ? rng.pick(attackers) : undefined;
  const creator = attackers.filter((p) => p !== scorer).length ? rng.pick(attackers.filter((p) => p !== scorer)) : undefined;
  const pool: (readonly [Objective, number])[] = [
    [{ id: 'winBy2', text: 'Win by two goals or more' }, 2],
    [{ id: 'cleanSheet', text: 'Keep a clean sheet' }, 2],
    [{ id: 'header', text: 'Score a header' }, 2],
    [{ id: 'longShot', text: 'Score from outside the box' }, 1.5],
    [{ id: 'cards2', text: 'Play two manager cards' }, 3],
    [{ id: 'subScores', text: 'A substitute scores' }, 0.8],
    [{ id: 'early', text: 'Score in the first 15 minutes' }, 1.5],
    [{ id: 'threeGoals', text: 'Score three goals' }, 1],
    [{ id: 'onTarget6', text: 'Six shots on target' }, 1.5],
    ...(scorer ? [[{ id: 'playerScores', text: `Get ${scorer.lastName} on the scoresheet`, playerId: scorer.id }, 3] as const] : []),
    ...(creator ? [[{ id: 'playerAssists', text: `${creator.lastName} sets up a goal`, playerId: creator.id }, 1.5] as const] : []),
    ...(captain ? [[{ id: 'captainScores', text: `Your captain ${captain.lastName} scores`, playerId: captain.id }, 1.5] as const] : []),
  ];
  const out: Objective[] = [];
  let left = [...pool];
  while (out.length < 3 && left.length) {
    const pick = rng.weighted(left);
    out.push(pick);
    // One player-named objective per match keeps the three varied.
    left = left.filter(([o]) => o.id !== pick.id && !(pick.playerId && o.playerId));
  }
  return out;
}

export interface ObjectiveResult extends Objective {
  done: boolean;
}

/** Full-time verdicts and the coins they pay. */
export function settleObjectives(objectives: readonly Objective[], events: readonly FootballEvent[], side: TeamSide): { results: ObjectiveResult[]; stars: number; coins: number } {
  const facts = factsFrom(events, side, true);
  const results = objectives.map((o) => ({ ...o, done: judge(o, facts) === true }));
  const stars = results.filter((r) => r.done).length;
  const coins = stars * OBJECTIVE_REWARD.perStar + (stars === 3 && objectives.length === 3 ? OBJECTIVE_REWARD.allThree : 0);
  return { results, stars, coins };
}
