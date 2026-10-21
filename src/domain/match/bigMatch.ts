import { CUP_NAME, CUP_ROUNDS, cupRoundName } from '../cup/cup';
import { fixtureStorylines, type Storyline } from '../league/stories';
import type { UserFixture } from '../league/league';
import type { ClubSave } from '../save/types';

export interface BigMatch {
  kind: 'cupFinal' | 'cup' | 'derby' | 'decider' | 'finalDay' | 'summit';
  /** Shown big on the walk-out, e.g. "COUNTY CUP FINAL". */
  title: string;
  /** The one line that says why it matters (a real storyline). */
  line: string;
}

const LEAGUE_BIG: Partial<Record<Storyline['kind'], BigMatch['kind']>> = {
  clinch: 'decider',
  survive: 'decider',
  finalDay: 'finalDay',
  summit: 'summit',
  derby: 'derby',
  revenge: 'derby',
};

const TITLES: Record<BigMatch['kind'], string> = {
  cupFinal: `${CUP_NAME} final`,
  cup: CUP_NAME,
  derby: 'Derby day',
  decider: 'Everything to play for',
  finalDay: 'Final day',
  summit: 'Top of the table',
};

/**
 * Whether a fixture deserves a walk-out, and what to say: every cup tie, derbies, games that
 * can seal a title/promotion/survival, top-of-the-table clashes and the final day. Built from
 * the same storylines the lobby shows, so the two never disagree.
 */
export function bigMatch(save: Parameters<typeof fixtureStorylines>[0], fixture: UserFixture): BigMatch | null {
  const lines = fixtureStorylines(save, fixture, 6);
  if (fixture.competition === 'cup') {
    const final = fixture.cupRound === CUP_ROUNDS.length - 1;
    return {
      kind: final ? 'cupFinal' : 'cup',
      title: final ? TITLES.cupFinal : `${CUP_NAME} · ${cupRoundName(fixture.cupRound ?? 0)}`,
      line: lines[0]?.text ?? 'Knockout football.',
    };
  }
  for (const l of lines) {
    const kind = LEAGUE_BIG[l.kind];
    if (kind && !(l.kind === 'summit' && l.tone !== 'hype')) return { kind, title: TITLES[kind], line: l.text };
  }
  return null;
}

/** The fixture a pending match was frozen from (for the walk-out on the live screen). */
export function fixtureOfPending(save: Pick<ClubSave, 'pendingMatch' | 'league' | 'season'>, club: UserFixture['club']): UserFixture | null {
  const pm = save.pendingMatch;
  if (!pm) return null;
  return {
    club,
    home: pm.userSide === 'home',
    round: pm.round ?? save.league.round,
    lap: 0,
    competition: pm.competition ?? 'league',
    ...(pm.cupRound !== undefined ? { cupRound: pm.cupRound } : {}),
  };
}
