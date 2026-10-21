import type { LineupPlayer, TeamLineup, TeamSide } from '../../game/simulation/types';
import { clamp, stream } from '../rng';

/**
 * A penalty shootout after a drawn knockout tie. Pure and seeded: takers go in order of
 * finishing + composure (keeper last), each kick weighed against the opposing keeper's
 * reflexes and positioning. Five each, stopping once it can't be caught; then sudden death.
 */

export interface ShootoutKick {
  side: TeamSide;
  takerId: string;
  takerName: string;
  keeperName: string;
  scored: boolean;
}

export interface ShootoutResult {
  home: number;
  away: number;
  winner: TeamSide;
  kicks: ShootoutKick[];
}

const MAX_ROUNDS = 30;

export function takerOrder(team: TeamLineup): LineupPlayer[] {
  const outfield = team.players.filter((p) => p.role !== 'GK').sort((a, b) => b.attributes.finishing + b.attributes.composure - (a.attributes.finishing + a.attributes.composure) || a.id.localeCompare(b.id));
  const keepers = team.players.filter((p) => p.role === 'GK');
  return [...outfield, ...keepers];
}

/** Chance a taker scores against a keeper (0.55–0.92). */
export function kickChance(taker: LineupPlayer, keeper: LineupPlayer | undefined): number {
  const shot = (taker.attributes.finishing + taker.attributes.composure) / 2;
  const stop = keeper ? (keeper.attributes.reflexes + keeper.attributes.positioning) / 2 : 30;
  return clamp(0.76 + (shot - stop) * 0.004, 0.55, 0.92);
}

export function penaltyShootout(seed: string, home: TeamLineup, away: TeamLineup): ShootoutResult {
  const rng = stream(seed, 'shootout');
  const order = { home: takerOrder(home), away: takerOrder(away) };
  const keeper = { home: home.players.find((p) => p.role === 'GK'), away: away.players.find((p) => p.role === 'GK') };
  const score = { home: 0, away: 0 };
  const kicks: ShootoutKick[] = [];
  const kick = (side: TeamSide, n: number) => {
    const takers = order[side];
    const taker = takers[n % takers.length] as LineupPlayer;
    const gk = keeper[side === 'home' ? 'away' : 'home'];
    const scored = rng.chance(kickChance(taker, gk));
    if (scored) score[side]++;
    kicks.push({ side, takerId: taker.id, takerName: taker.name, keeperName: gk?.name ?? 'the keeper', scored });
  };
  // Best of five, ending early when one side can't catch up.
  for (let n = 0; n < 5; n++) {
    for (const side of ['home', 'away'] as const) {
      kick(side, n);
      const leftHome = 5 - (n + 1);
      const leftAway = 5 - (side === 'away' ? n + 1 : n);
      if (score.home > score.away + leftAway || score.away > score.home + leftHome) {
        return { ...score, winner: score.home > score.away ? 'home' : 'away', kicks };
      }
    }
  }
  for (let n = 5; n < MAX_ROUNDS && score.home === score.away; n++) {
    kick('home', n);
    kick('away', n);
  }
  // Practically unreachable; keep the result total and deterministic anyway.
  if (score.home === score.away) score[rng.chance(0.5) ? 'home' : 'away']++;
  return { ...score, winner: score.home > score.away ? 'home' : 'away', kicks };
}
