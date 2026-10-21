import { FORMATION_DEFS, type FormationId } from '../../domain/formations';
import { generateFootballer } from '../../domain/players/generator';
import type { Footballer } from '../../domain/players/types';
import { buildTeamLineup, toLineupPlayer } from '../../game/simulation/fromSquad';
import type { AiStyle, TeamLineup } from '../../game/simulation/types';

/** Deterministic test team: one generated player per formation slot at a target rating. */
export function makeTeam(prefix: string, ovr: number, formation: FormationId = '2-2-2', aiStyle: AiStyle = 'balanced'): TeamLineup {
  const footballers: Record<string, Footballer> = {};
  const lineup: Record<string, string> = {};
  FORMATION_DEFS[formation].slots.forEach((slot, i) => {
    const p = generateFootballer({ seed: `${prefix}-${i}`, position: slot.position, targetOvr: ovr, tier: 'street' });
    footballers[p.id] = p;
    lineup[slot.id] = p.id;
  });
  return buildTeamLineup(
    { clubId: prefix, name: prefix, shortName: prefix.slice(0, 3).toUpperCase(), kit: { primary: '#E2563B', secondary: '#FFF7E9' }, aiStyle },
    formation,
    lineup,
    footballers,
  );
}

/** The same eleven… er, seven, with fresh ids so a team can face its own mirror image. */
export function mirrorOf(team: TeamLineup, suffix = 'mirror'): TeamLineup {
  return { ...team, clubId: `${team.clubId}-${suffix}`, name: `${team.name} ${suffix}`, players: team.players.map((p) => ({ ...p, id: `${p.id}-${suffix}` })) };
}

/** Adds `n` generated substitutes (one per outfield position in turn, then a keeper). */
export function withBench(team: TeamLineup, prefix: string, ovr: number, n = 3): TeamLineup {
  const positions = ['DEF', 'MID', 'FWD', 'GK', 'MID'] as const;
  const bench = Array.from({ length: n }, (_, i) => toLineupPlayer(generateFootballer({ seed: `${prefix}-bench-${i}`, position: positions[i % positions.length] as (typeof positions)[number], targetOvr: ovr, tier: 'street' }), 'bench', positions[i % positions.length] as (typeof positions)[number]));
  return { ...team, bench };
}
