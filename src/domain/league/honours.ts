import { seededUuid } from '../rng';
import { CUP_NAME, cupWinner } from '../cup/cup';
import { PLAYER_CLUB_ID, type ClubSave, type CupState, type SeasonSummary } from '../save/types';
import { topScorers } from './league';

export interface ClubHonour {
  season: number;
  kind: 'title' | 'promotion' | 'cup';
  divisionName: string;
  points: number;
}

/**
 * The trophy cabinet, from the season history (a league win also counts as promotion) plus a cup
 * won this season, which goes on the shelf straight after the final.
 */
export function clubHonours(seasons: readonly SeasonSummary[], currentCup: CupState | null = null): ClubHonour[] {
  const out = seasons.flatMap((s): ClubHonour[] => {
    const league: ClubHonour[] =
      s.position === 1 ? [{ season: s.season, kind: 'title', divisionName: s.divisionName, points: s.points }] : s.outcome === 'promoted' ? [{ season: s.season, kind: 'promotion', divisionName: s.divisionName, points: s.points }] : [];
    return s.cup?.won ? [...league, { season: s.season, kind: 'cup', divisionName: CUP_NAME, points: 0 }] : league;
  });
  if (currentCup && cupWinner(currentCup) === PLAYER_CLUB_ID && !seasons.some((s) => s.season === currentCup.season)) {
    out.push({ season: currentCup.season, kind: 'cup', divisionName: CUP_NAME, points: 0 });
  }
  return out;
}

/** Players who appeared for the club in a season, from the match records. */
export function seasonAppearances(save: Pick<ClubSave, 'matchRecords'>, season: number): Set<string> {
  const ids = new Set<string>();
  for (const r of save.matchRecords) if (r.season === season) for (const g of r.gains) if (g.rating !== undefined) ids.add(g.playerId);
  return ids;
}

/**
 * Stamps the season's honours into players' scrapbooks (on a save draft, inside the season-end
 * transaction): a medal for everyone who played in a title or promotion season, and the Golden
 * Boot for the division's top scorer if he is ours. Returns the number of entries written.
 */
export function awardSeasonHonours(draft: ClubSave, summary: SeasonSummary): number {
  let written = 0;
  const stamp = (playerId: string, headline: string) => {
    const p = draft.footballers[playerId];
    if (!p) return;
    p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`), kind: 'honour', season: summary.season, order: draft.nextSeq, headline });
    draft.nextSeq++;
    written++;
  };
  const division = summary.divisionName;
  const medal = summary.position === 1 ? `CHAMPIONS: ${division} title winner, season ${summary.season}.` : summary.outcome === 'promoted' ? `PROMOTED: up from ${division} in season ${summary.season}.` : null;
  if (medal) for (const id of seasonAppearances(draft, summary.season)) stamp(id, medal);
  const charts = topScorers(draft.league, 50);
  const best = charts[0]?.goals ?? 0;
  if (best > 0) {
    for (const s of charts.filter((x) => x.goals === best && x.clubId === PLAYER_CLUB_ID)) {
      stamp(s.playerId, `GOLDEN BOOT: ${best} league goals, top scorer in ${division}.`);
    }
  }
  return written;
}

/** Players who appeared in this season's cup ties (from the match records). */
export function cupAppearances(save: Pick<ClubSave, 'matchRecords' | 'season'>): Set<string> {
  const ids = new Set<string>();
  for (const r of save.matchRecords) if (r.season === save.season && r.competition === 'cup') for (const g of r.gains) if (g.rating !== undefined) ids.add(g.playerId);
  return ids;
}

/** Cup winners' medals: everyone who played in a tie this season, including today's starters. */
export function awardCupMedals(draft: ClubSave, todaysStarters: readonly string[]): number {
  const ids = new Set([...cupAppearances(draft), ...todaysStarters]);
  let written = 0;
  for (const id of ids) {
    const p = draft.footballers[id];
    if (!p) continue;
    p.history.push({ id: seededUuid(`${draft.careerSeed}:history:${draft.nextSeq}`), kind: 'honour', season: draft.season, order: draft.nextSeq, headline: `CUP WINNER: lifted the County Cup in season ${draft.season}.` });
    draft.nextSeq++;
    written++;
  }
  return written;
}
