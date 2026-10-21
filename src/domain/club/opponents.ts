import type { ClubDef } from '../../data/clubs';
import { FORMATION_DEFS } from '../formations';
import { AI_DECKS } from '../../game/simulation/cards';
import { buildTeamLineup } from '../../game/simulation/fromSquad';
import type { TeamLineup } from '../../game/simulation/types';
import { generateFootballer } from '../players/generator';
import { overall } from '../players/rating';
import type { Footballer } from '../players/types';
import { stream } from '../rng';

export interface Fixture {
  number: number;
  club: ClubDef;
  lap: number;
  /** Is the player's club at home? */
  home: boolean;
}

/**
 * Opposition squads are generated from the career seed + club id, so the same club always
 * fields the same named, recognisable players (their ratings rise by lap). A player who has
 * left (signed by the player's club) is replaced in his slot by the next generated one.
 */
export function opponentSquad(careerSeed: string, club: ClubDef, lap: number, departed: readonly string[] = []): Footballer[] {
  const target = club.baseOvr + lap * 2;
  const gone = new Set(departed);
  return FORMATION_DEFS[club.formation].slots.map((slot, i) => {
    let seed = `${careerSeed}:club:${club.id}:${i}`;
    let p = generateFootballer({ seed, position: slot.position, targetOvr: target + stream(seed, 'roster').int(-3, 3), tier: 'street', season: 1 });
    for (let r = 1; gone.has(p.id) && r < 50; r++) {
      seed = `${careerSeed}:club:${club.id}:${i}:r${r}`;
      p = generateFootballer({ seed, position: slot.position, targetOvr: target + stream(seed, 'roster').int(-3, 3), tier: 'street', season: 1 });
    }
    p.isNew = false;
    return p;
  });
}

/** Two substitutes per club (a midfielder and a forward), a little below the first team. */
export function opponentBench(careerSeed: string, club: ClubDef, lap: number): Footballer[] {
  const target = club.baseOvr + lap * 2 - 3;
  return (['MID', 'FWD'] as const).map((position, i) => {
    const seed = `${careerSeed}:club:${club.id}:bench:${i}`;
    const p = generateFootballer({ seed, position, targetOvr: target + stream(seed, 'roster').int(-2, 2), tier: 'street', season: 1 });
    p.isNew = false;
    return p;
  });
}

export function opponentLineup(careerSeed: string, fixture: Fixture, departed: readonly string[] = []): { lineup: TeamLineup; squad: Footballer[] } {
  const squad = opponentSquad(careerSeed, fixture.club, fixture.lap, departed);
  const byId = Object.fromEntries(squad.map((p) => [p.id, p]));
  const slots = Object.fromEntries(FORMATION_DEFS[fixture.club.formation].slots.map((s, i) => [s.id, (squad[i] as Footballer).id]));
  const lineup = buildTeamLineup(
    {
      clubId: fixture.club.id,
      name: fixture.club.name,
      shortName: fixture.club.shortName,
      kit: { primary: fixture.club.kit.primary, secondary: fixture.club.kit.secondary, pattern: fixture.club.kit.pattern },
      aiStyle: fixture.club.aiStyle,
      deck: [...AI_DECKS[fixture.club.aiStyle]],
    },
    fixture.club.formation,
    slots,
    byId,
    opponentBench(careerSeed, fixture.club, fixture.lap),
  );
  return { lineup, squad };
}

export function squadAverage(squad: readonly Footballer[]): number {
  return Math.round((squad.reduce((s, p) => s + overall(p), 0) / squad.length) * 10) / 10;
}
