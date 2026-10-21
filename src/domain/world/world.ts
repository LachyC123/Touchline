import { CLUBS, CUP_GUEST_CLUBS, DIVISION_NAMES, DIVISION_ONE_CLUBS, DIVISION_RULES, type ClubDef, type DivisionDef } from '../../data/clubs';

/**
 * A career's world: the other clubs, their towns and grounds, who the rivals are. Generated
 * once from the career seed and stored in the save, so two careers play in different leagues
 * and one career never changes under the player. Careers from before worlds were generated keep
 * the original ("classic") clubs.
 */
export interface HomeTown {
  town: string;
  industry: string;
  /** What the club's supporters call the team. */
  nickname: string;
  /** The town in a line. */
  line: string;
  founded: number;
}

export interface WorldDivision {
  name: string;
  clubIds: string[];
  promote: number;
  relegate: number;
}

export interface World {
  kind: 'classic' | 'generated';
  home: HomeTown;
  clubs: ClubDef[];
  divisions: WorldDivision[];
  cupGuestIds: string[];
  /** Players who have left their club (signed by the player's club); replaced at the club. */
  departed: string[];
}

interface Index {
  byId: Map<string, ClubDef>;
  divisions: DivisionDef[];
}

const cache = new WeakMap<World, Index>();

function index(world: World): Index {
  let i = cache.get(world);
  if (!i) {
    const byId = new Map(world.clubs.map((c) => [c.id, c] as const));
    const divisions = world.divisions.map((d, n) => ({ index: n, name: d.name, promote: d.promote, relegate: d.relegate, clubs: d.clubIds.map((id) => byId.get(id)).filter((c): c is ClubDef => Boolean(c)) }));
    i = { byId, divisions };
    cache.set(world, i);
  }
  return i;
}

export function clubOf(world: World, id: string): ClubDef | undefined {
  return index(world).byId.get(id);
}

export function divisionsOf(world: World): readonly DivisionDef[] {
  return index(world).divisions;
}

export function divisionOf(world: World, n: number): DivisionDef {
  const all = divisionsOf(world);
  return all[Math.max(0, Math.min(all.length - 1, n))] as DivisionDef;
}

/** League level of a club (-1 for non-league cup guests). */
export function divisionIndexOf(world: World, clubId: string): number {
  return world.divisions.findIndex((d) => d.clubIds.includes(clubId));
}

export function cupGuestsOf(world: World): ClubDef[] {
  return world.cupGuestIds.map((id) => clubOf(world, id)).filter((c): c is ClubDef => Boolean(c));
}

/** The original hand-made clubs (careers that started before worlds were generated). */
export function classicWorld(): World {
  const tiers = [CLUBS, DIVISION_ONE_CLUBS];
  return {
    kind: 'classic',
    home: { town: 'Millbrook', industry: 'mill', nickname: 'Brookers', line: 'A mill town with a gasworks where the stand should be.', founded: 1902 },
    clubs: [...CLUBS, ...DIVISION_ONE_CLUBS, ...CUP_GUEST_CLUBS].map((c) => ({ ...c, kit: { ...c.kit } })),
    divisions: tiers.map((clubs, n) => ({ name: DIVISION_NAMES[n] as string, clubIds: clubs.map((c) => c.id), ...(DIVISION_RULES[n] as { promote: number; relegate: number }) })),
    cupGuestIds: CUP_GUEST_CLUBS.map((c) => c.id),
    departed: [],
  };
}
