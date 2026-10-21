import type { FootballEvent, LineupPlayer, MatchStats, PlayerMatchLine, TeamLineup, TeamSide } from './types';

/**
 * Player ratings (3.0–10.0) are derived only from logged events, so every number on the
 * result screen can be traced back to something that happened on the pitch.
 */
export function playerLines(events: readonly FootballEvent[], home: TeamLineup, away: TeamLineup, score: { home: number; away: number }): PlayerMatchLine[] {
  const lines = new Map<string, PlayerMatchLine & { lost: number; tacklesLost: number; role: LineupPlayer['role'] }>();
  const add = (lp: LineupPlayer, side: TeamSide) =>
    lines.set(lp.id, { playerId: lp.id, side, goals: 0, assists: 0, shots: 0, saves: 0, tacklesWon: 0, passesCompleted: 0, skills: 0, fouls: 0, rating: 6, lost: 0, tacklesLost: 0, role: lp.role });
  home.players.forEach((p) => add(p, 'home'));
  away.players.forEach((p) => add(p, 'away'));

  for (const e of events) {
    switch (e.type) {
      case 'GOAL': {
        const l = lines.get(e.scorerId);
        if (l) l.goals++;
        if (e.assistId) {
          const a = lines.get(e.assistId);
          if (a) a.assists++;
        }
        break;
      }
      case 'SHOT': {
        const l = lines.get(e.shooterId);
        if (l) l.shots++;
        break;
      }
      case 'SAVE': {
        const l = lines.get(e.keeperId);
        if (l) l.saves++;
        break;
      }
      case 'TACKLE': {
        const c = lines.get(e.challengerId);
        if (c && e.won) c.tacklesWon++;
        if (c && !e.won) c.tacklesLost++;
        const v = lines.get(e.carrierId);
        if (v && e.won) v.lost++;
        break;
      }
      case 'SKILL': {
        const l = lines.get(e.playerId);
        if (l) l.skills++;
        break;
      }
      case 'FOUL': {
        const l = lines.get(e.foulerId);
        if (l) l.fouls++;
        break;
      }
      case 'CLEARANCE': {
        const l = lines.get(e.playerId);
        if (l) l.tacklesWon++;
        break;
      }
      case 'PASS': {
        const l = lines.get(e.fromId);
        if (!l) break;
        if (e.outcome === 'complete') l.passesCompleted++;
        else l.lost++;
        break;
      }
    }
  }

  return [...lines.values()].map((l) => {
    const conceded = l.side === 'home' ? score.away : score.home;
    const won = (l.side === 'home' ? score.home - score.away : score.away - score.home) > 0;
    let r = 6 + l.goals * 1.1 + l.assists * 0.7 + l.saves * 0.35 + l.tacklesWon * 0.18 + l.passesCompleted * 0.025 + l.shots * 0.05 - l.lost * 0.07 - l.tacklesLost * 0.05 + l.skills * 0.12 - l.fouls * 0.12;
    if ((l.role === 'GK' || l.role === 'DEF') && conceded === 0) r += 0.6;
    if (l.role === 'GK' || l.role === 'DEF') r -= conceded * 0.25;
    if (won) r += 0.3;
    const { lost: _lost, tacklesLost: _tl, role: _role, ...line } = l;
    return { ...line, rating: Math.round(Math.min(10, Math.max(3, r)) * 10) / 10 };
  });
}

export function playerOfMatch(lines: readonly PlayerMatchLine[], score: { home: number; away: number }): string {
  const winner: TeamSide | null = score.home > score.away ? 'home' : score.away > score.home ? 'away' : null;
  const sorted = [...lines].sort((a, b) => b.rating - a.rating || Number(b.side === winner) - Number(a.side === winner) || a.playerId.localeCompare(b.playerId));
  return sorted[0]?.playerId ?? '';
}

export function possessionShare(stats: MatchStats): { home: number; away: number } {
  const total = stats.possessionTicks.home + stats.possessionTicks.away || 1;
  const home = Math.round((stats.possessionTicks.home / total) * 100);
  return { home, away: 100 - home };
}
