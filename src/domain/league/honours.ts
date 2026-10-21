import { seededUuid } from '../rng';
import { PLAYER_CLUB_ID, type ClubSave, type SeasonSummary } from '../save/types';
import { topScorers } from './league';

export interface ClubHonour {
  season: number;
  kind: 'title' | 'promotion';
  divisionName: string;
  points: number;
}

/** The trophy cabinet, from the season history alone (a league win also counts as promotion). */
export function clubHonours(seasons: readonly SeasonSummary[]): ClubHonour[] {
  return seasons.flatMap((s): ClubHonour[] => {
    if (s.position === 1) return [{ season: s.season, kind: 'title', divisionName: s.divisionName, points: s.points }];
    if (s.outcome === 'promoted') return [{ season: s.season, kind: 'promotion', divisionName: s.divisionName, points: s.points }];
    return [];
  });
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
