import { CLUB_BY_ID, FIXTURE_ORDER, type ClubDef } from '../../data/clubs';
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
  /** Is the player's club at home? Home and away alternate. */
  home: boolean;
}

export function fixtureFor(matchNumber: number): Fixture {
  const id = FIXTURE_ORDER[matchNumber % FIXTURE_ORDER.length] as string;
  const club = CLUB_BY_ID[id];
  if (!club) throw new Error(`Unknown club ${id}`);
  return { number: matchNumber, club, lap: Math.floor(matchNumber / FIXTURE_ORDER.length), home: matchNumber % 2 === 0 };
}

/**
 * Opposition squads are generated from the career seed + club id, so the same club always
 * fields the same named, recognisable players (their ratings rise by lap).
 */
export function opponentSquad(careerSeed: string, club: ClubDef, lap: number): Footballer[] {
  const target = club.baseOvr + lap * 2;
  return FORMATION_DEFS[club.formation].slots.map((slot, i) => {
    const seed = `${careerSeed}:club:${club.id}:${i}`;
    const jitter = stream(seed, 'roster').int(-3, 3);
    const p = generateFootballer({ seed, position: slot.position, targetOvr: target + jitter, tier: 'street', season: 1 });
    p.isNew = false;
    return p;
  });
}

export function opponentLineup(careerSeed: string, fixture: Fixture): { lineup: TeamLineup; squad: Footballer[] } {
  const squad = opponentSquad(careerSeed, fixture.club, fixture.lap);
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
  );
  return { lineup, squad };
}

export function squadAverage(squad: readonly Footballer[]): number {
  return Math.round((squad.reduce((s, p) => s + overall(p), 0) / squad.length) * 10) / 10;
}
