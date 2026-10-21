import type { Footballer } from './types';

/**
 * Career landmarks for a footballer, decided from his stored stats before and after a match.
 * Pure: the same stats always produce the same moments.
 */

export const APPEARANCE_MILESTONES: readonly number[] = [10, 25, 50, 100, 200];
export const GOAL_MILESTONES: readonly number[] = [5, 10, 25, 50, 100];
export const ASSIST_MILESTONES: readonly number[] = [5, 10, 25, 50];
export const CLEAN_SHEET_MILESTONES: readonly number[] = [5, 10, 25, 50];

export const MILESTONE_KINDS = ['debut', 'firstGoal', 'hatTrick', 'goals', 'assists', 'apps', 'firstCleanSheet', 'cleanSheets'] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export interface Milestone {
  kind: MilestoneKind;
  /** Scrapbook line, built from real facts. */
  headline: string;
}

type Stats = Footballer['stats'];

function crossed(list: readonly number[], before: number, after: number): number | undefined {
  return list.filter((m) => before < m && after >= m).at(-1);
}

/** Everything a match added to one player's story, most important first. */
export function matchMilestones(before: Stats, after: Stats, ctx: { goals: number; opponent: string; firstGoalMinute?: number; keeper: boolean }): Milestone[] {
  const out: Milestone[] = [];
  if (ctx.goals >= 3) out.push({ kind: 'hatTrick', headline: `HAT-TRICK HERO: ${ctx.goals === 3 ? 'three' : ctx.goals} goals against ${ctx.opponent}.` });
  if (before.goals === 0 && after.goals > 0) out.push({ kind: 'firstGoal', headline: `First goal for the club${ctx.firstGoalMinute !== undefined ? ` (${ctx.firstGoalMinute}')` : ''} against ${ctx.opponent}.` });
  const goals = crossed(GOAL_MILESTONES, before.goals, after.goals);
  if (goals) out.push({ kind: 'goals', headline: `${goals} GOALS for the club, the latest against ${ctx.opponent}.` });
  const assists = crossed(ASSIST_MILESTONES, before.assists, after.assists);
  if (assists) out.push({ kind: 'assists', headline: `PROVIDER: ${assists} assists for the club.` });
  if (ctx.keeper && before.cleanSheets === 0 && after.cleanSheets > 0) out.push({ kind: 'firstCleanSheet', headline: `First clean sheet for the club, against ${ctx.opponent}.` });
  const sheets = crossed(CLEAN_SHEET_MILESTONES, before.cleanSheets, after.cleanSheets);
  if (sheets) out.push({ kind: 'cleanSheets', headline: `SHUT-OUT SPECIALIST: ${sheets} clean sheets for the club.` });
  if (before.matches === 0 && after.matches > 0) out.push({ kind: 'debut', headline: `Made his debut against ${ctx.opponent}.` });
  const apps = crossed(APPEARANCE_MILESTONES, before.matches, after.matches);
  if (apps) out.push({ kind: 'apps', headline: `A TRUE CLUB PLAYER: ${apps} appearances.` });
  return out;
}

export interface UpcomingMilestone {
  playerId: string;
  text: string;
  /** Higher = more notable. */
  weight: number;
}

/**
 * Landmarks one match away for the starting seven: the next appearance milestone, or one goal /
 * clean sheet short of the next round number.
 */
export function upcomingMilestones(players: readonly Footballer[]): UpcomingMilestone[] {
  const out: UpcomingMilestone[] = [];
  for (const p of players) {
    const nextApps = APPEARANCE_MILESTONES.find((m) => m === p.stats.matches + 1);
    if (nextApps) out.push({ playerId: p.id, text: `${p.lastName} is set for his ${nextApps}th appearance for the club.`, weight: 20 + nextApps / 10 });
    const nextGoals = GOAL_MILESTONES.find((m) => m === p.stats.goals + 1);
    if (nextGoals) out.push({ playerId: p.id, text: `${p.lastName} is one goal from ${nextGoals} for the club.`, weight: 28 + nextGoals / 5 });
    if (p.primaryPosition === 'GK') {
      const nextSheets = CLEAN_SHEET_MILESTONES.find((m) => m === p.stats.cleanSheets + 1);
      if (nextSheets) out.push({ playerId: p.id, text: `A clean sheet today would be ${p.lastName}’s ${nextSheets}th.`, weight: 24 + nextSheets / 5 });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}
