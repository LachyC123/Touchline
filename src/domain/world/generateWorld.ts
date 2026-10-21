import { DIVISION_NAMES, DIVISION_RULES, type ClubDef } from '../../data/clubs';
import { CLUB_NAME_PATTERNS, CLUB_QUIRKS, GROUND_PATTERNS, INDUSTRIES, KIT_PAIRS, NICKNAMES, REAL_TOWNS, STYLE_LINES, TOWN_PREFIXES, TOWN_SUFFIXES } from '../../data/world';
import { FORMATION_IDS } from '../formations';
import type { AiStyle } from '../../game/simulation/types';
import { KIT_PRESETS, shortNameFor } from '../club/onboarding';
import { CREST_SHAPES, KIT_CUTS, KIT_PATTERNS, type ClubIdentity } from '../club/types';
import { stream, type Rng } from '../rng';
import type { World } from './world';

const AI_STYLES: readonly AiStyle[] = ['balanced', 'press', 'passing', 'counter', 'direct'];
/** Seven AI clubs per division: the player's club makes eight wherever it plays. */
const DIVISION_SIZES = [7, 7] as const;
/** Season-one squad strength bands (the top division is stronger). */
const STRENGTH = [
  [44, 57],
  [53, 64],
] as const;

function townName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 200; i++) {
    const prefix = rng.pick(TOWN_PREFIXES);
    const suffix = rng.pick(TOWN_SUFFIXES);
    // Avoid doubled letters across the join reading oddly ("Millley").
    if (prefix.slice(-1).toLowerCase() === suffix[0] && prefix.slice(-2, -1).toLowerCase() === suffix[0]) continue;
    const name = `${prefix}${suffix}`;
    const stem = prefix.toLowerCase();
    if (REAL_TOWNS.has(name) || used.has(name) || [...used].some((u) => u.toLowerCase().startsWith(stem))) continue;
    used.add(name);
    return name;
  }
  throw new Error('Could not name a town');
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function industryOf(rng: Rng): (typeof INDUSTRIES)[number] {
  return rng.pick(INDUSTRIES);
}

function groundName(rng: Rng, town: string, industry: (typeof INDUSTRIES)[number]): string {
  return rng.chance(0.6) ? rng.pick(industry.grounds) : rng.pick(GROUND_PATTERNS).replace('{t}', town);
}

function uniqueShort(name: string, used: Set<string>): string {
  let code = shortNameFor(name);
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '');
  for (let i = 2; used.has(code) && i < letters.length; i++) code = `${letters[0]}${letters[1]}${letters[i]}`;
  used.add(code);
  return code;
}

/** Generates a whole world from the career seed. Pure: the same seed always builds the same world. */
export function generateWorld(careerSeed: string): { world: World; identity: ClubIdentity } {
  const rng = stream(careerSeed, 'world');
  const usedTowns = new Set<string>();
  const usedShort = new Set<string>();
  const usedQuirks = new Set<number>();

  // ---- home ---------------------------------------------------------------------------
  const homeTown = townName(rng, usedTowns);
  const homeIndustry = industryOf(rng);
  const preset = rng.pick(KIT_PRESETS);
  const homeName = rng.weighted(CLUB_NAME_PATTERNS).replace('{t}', homeTown);
  const identity: ClubIdentity = {
    name: homeName,
    shortName: uniqueShort(homeName, usedShort),
    stadiumName: groundName(rng, homeTown, homeIndustry),
    kit: { primary: preset.primary, secondary: preset.secondary, pattern: rng.pick(KIT_PATTERNS), cut: rng.pick(KIT_CUTS) },
    crest: rng.pick(CREST_SHAPES),
  };
  const kitsTaken = new Set([preset.primary.toLowerCase()]);

  const makeClub = (division: number, baseOvr: number, guest = false): ClubDef => {
    const town = townName(rng, usedTowns);
    const industry = industryOf(rng);
    const name = guest ? `${town} ${rng.pick(['Athletic', 'Rovers', 'Sunday XI', 'Old Boys'])}` : rng.weighted(CLUB_NAME_PATTERNS).replace('{t}', town);
    let pair = rng.pick(KIT_PAIRS);
    for (let i = 0; i < 20 && kitsTaken.has(pair[0].toLowerCase()); i++) pair = rng.pick(KIT_PAIRS);
    kitsTaken.add(pair[0].toLowerCase());
    let quirk = rng.int(0, CLUB_QUIRKS.length - 1);
    for (let i = 0; i < 20 && usedQuirks.has(quirk); i++) quirk = rng.int(0, CLUB_QUIRKS.length - 1);
    usedQuirks.add(quirk);
    const aiStyle = rng.pick(AI_STYLES);
    return {
      id: `${slug(town)}-${division < 0 ? 'nl' : `d${division}`}`,
      name,
      shortName: uniqueShort(name, usedShort),
      stadiumName: groundName(rng, town, industry),
      kit: { primary: pair[0], secondary: pair[1], pattern: rng.pick(KIT_PATTERNS), cut: rng.pick(KIT_CUTS) },
      crest: rng.pick(CREST_SHAPES),
      formation: rng.pick(FORMATION_IDS),
      aiStyle,
      baseOvr,
      styleLine: guest ? 'Non-league part-timers with nothing to lose.' : rng.pick(STYLE_LINES[aiStyle]),
      town,
      industry: industry.id,
      nickname: rng.chance(0.55) ? `The ${industry.nick}` : `The ${rng.pick(NICKNAMES)}`,
      quirk: CLUB_QUIRKS[quirk] as string,
      founded: rng.int(1872, 1965),
    };
  };

  const clubs: ClubDef[] = [];
  const divisions = DIVISION_SIZES.map((size, d) => {
    const [lo, hi] = STRENGTH[d] as readonly [number, number];
    // Spread strengths across the band so every division has minnows and favourites.
    const strengths = Array.from({ length: size }, (_, i) => Math.round(lo + ((hi - lo) * i) / (size - 1) + rng.int(-1, 1))).sort((a, b) => a - b);
    const made = strengths.map((ovr) => makeClub(d, ovr));
    clubs.push(...made);
    return { name: DIVISION_NAMES[d] as string, clubIds: made.map((c) => c.id), ...(DIVISION_RULES[d] as { promote: number; relegate: number }) };
  });

  // Rivals: a mid-table neighbour in the first division you play in, and an old enemy above.
  const derbyId = divisions[0]!.clubIds[rng.int(2, 4)];
  const derby = clubs.find((c) => c.id === derbyId) as ClubDef;
  derby.rival = true;
  derby.industry = homeIndustry.id;
  derby.styleLine = `${derby.styleLine} The ${homeIndustry.label} next door; nobody remembers who started it.`;
  const enemyId = divisions[1]!.clubIds[rng.int(2, 5)];
  const enemy = clubs.find((c) => c.id === enemyId) as ClubDef;
  enemy.rival = true;
  enemy.styleLine = `${enemy.styleLine} They knocked your town out of the cup in ${rng.int(1952, 1999)}, and it still hurts.`;

  const guest = makeClub(-1, rng.int(41, 44), true);
  clubs.push(guest);

  return {
    world: {
      kind: 'generated',
      home: { town: homeTown, industry: homeIndustry.id, nickname: rng.chance(0.6) ? `The ${homeIndustry.nick}` : `The ${rng.pick(NICKNAMES)}`, line: rng.pick(homeIndustry.lines), founded: rng.int(1880, 1960) },
      clubs,
      divisions,
      cupGuestIds: [guest.id],
      departed: [],
    },
    identity,
  };
}
