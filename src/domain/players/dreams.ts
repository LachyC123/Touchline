import { DREAM_BY_ID } from '../../data/personality';
import type { FootballEvent, TeamSide } from '../../game/simulation/types';
import { dreamFulfilled, newEvent, scrapbook } from '../club/dressingRoom';
import type { ClubSave } from '../save/types';
import { clampMorale } from './morale';
import type { Footballer } from './types';

/**
 * Every footballer arrives with a dream (data/personality DREAMS). These checks decide, from the
 * match that was just played (or the season that just ended), whether one came true. A dream
 * comes true once: a gold scrapbook entry, a big lift in morale (more if you backed him) and a
 * moment on the result screen.
 */

export const DREAM_MORALE = 25;
export const BACKED_BONUS = 10;

export interface DreamMatch {
  side: TeamSide;
  events: readonly FootballEvent[];
  started: ReadonlySet<string>;
  played: ReadonlySet<string>;
  cupFinal: boolean;
  rival: boolean;
  won: boolean;
}

/** The goal that put us ahead for good (in a win), if any. */
function winningGoalScorer(m: DreamMatch): string | null {
  if (!m.won) return null;
  const goals = m.events.filter((e): e is Extract<FootballEvent, { type: 'GOAL' }> => e.type === 'GOAL');
  const against = goals.filter((g) => g.team !== m.side).length;
  const ours = goals.filter((g) => g.team === m.side);
  return ours[against]?.scorerId ?? null;
}

/** Assists this season (from match records, plus this match's events). */
function seasonAssists(save: Pick<ClubSave, 'matchRecords' | 'season'>, playerId: string): number {
  return save.matchRecords.filter((r) => r.season === save.season).reduce((s, r) => s + r.scorers.filter((x) => x.side === r.userSide && x.assistId === playerId).length, 0);
}

/** Has this match (or his career so far) made his dream come true? */
export function dreamMetByMatch(p: Footballer, m: DreamMatch, save: Pick<ClubSave, 'captainId' | 'matchRecords' | 'season'>): boolean {
  if (!m.played.has(p.id)) return false;
  const goals = m.events.filter((e): e is Extract<FootballEvent, { type: 'GOAL' }> => e.type === 'GOAL' && e.team === m.side && e.scorerId === p.id);
  const shots = new Map(m.events.flatMap((e) => (e.type === 'SHOT' ? [[e.id, e] as const] : [])));
  switch (p.dreamId) {
    case 'scoreFinal':
      return m.cupFinal && goals.length > 0;
    case 'captain':
      return save.captainId === p.id && m.started.has(p.id);
    case 'distanceGoal':
      return goals.some((g) => ['long', 'freeKick'].includes(shots.get(g.shotEventId)?.style ?? ''));
    case 'starts25':
      return p.stats.matches >= 25;
    case 'cleanSheets10':
      return p.stats.cleanSheets >= 10;
    case 'penaltySave':
      return m.events.some((e) => e.type === 'SAVE' && e.keeperId === p.id && shots.get(e.shotEventId)?.style === 'penalty');
    case 'hatTrick':
      return goals.length >= 3;
    case 'derbyWinner':
      return m.rival && winningGoalScorer(m) === p.id;
    case 'assists10':
      return seasonAssists(save, p.id) >= 10;
    case 'legend':
      return p.stats.matches >= 100 || p.stats.goals >= 50;
    default:
      return false;
  }
}

/** Progress towards his dream, for the profile ("7 / 10 clean sheets"), or null if not countable. */
export function dreamProgress(p: Footballer, save: Pick<ClubSave, 'matchRecords' | 'season'>): string | null {
  switch (p.dreamId) {
    case 'starts25':
      return `${Math.min(25, p.stats.matches)} / 25 games`;
    case 'cleanSheets10':
      return `${Math.min(10, p.stats.cleanSheets)} / 10 clean sheets`;
    case 'assists10':
      return `${Math.min(10, seasonAssists(save, p.id))} / 10 assists this season`;
    case 'legend':
      return `${p.stats.matches} / 100 games or ${p.stats.goals} / 50 goals`;
    default:
      return null;
  }
}

/** Marks a dream as come true on the save draft. Returns the line for the result screen. */
export function fulfilDream(draft: ClubSave, playerId: string): { playerId: string; name: string; text: string } | null {
  const p = draft.footballers[playerId];
  const dream = p ? DREAM_BY_ID[p.dreamId] : undefined;
  if (!p || !dream || dreamFulfilled(p)) return null;
  const backed = draft.dressingRoom.backed.includes(p.id);
  const before = p.morale;
  p.morale = clampMorale(p.morale + DREAM_MORALE + (backed ? BACKED_BONUS : 0));
  scrapbook(draft, p.id, `DREAM COME TRUE: ${dream.text}.`, 'dream');
  draft.dressingRoom.backed = draft.dressingRoom.backed.filter((id) => id !== p.id);
  newEvent(draft, 'dreamCome', 'news', {
    playerId: p.id,
    outcome: `${p.firstName} ${p.lastName}’s dream came true: ${dream.text.toLowerCase()}.${backed ? ' You told him you’d help — he won’t forget it.' : ''} (+${p.morale - before} morale)`,
  });
  return { playerId: p.id, name: `${p.firstName} ${p.lastName}`, text: dream.text };
}

/** After a match: everyone whose dream this match made come true. */
export function dreamsAfterMatch(draft: ClubSave, m: DreamMatch): { playerId: string; name: string; text: string }[] {
  const out: { playerId: string; name: string; text: string }[] = [];
  for (const id of draft.squadIds) {
    const p = draft.footballers[id];
    if (!p || p.dreamId === 'promotion' || dreamFulfilled(p)) continue;
    if (dreamMetByMatch(p, m, draft)) {
      const line = fulfilDream(draft, id);
      if (line) out.push(line);
    }
  }
  return out;
}
