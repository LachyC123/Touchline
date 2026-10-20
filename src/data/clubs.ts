import type { CrestShape, KitCut, KitPattern } from '../domain/club/types';
import type { FormationId } from '../domain/formations';
import type { AiStyle } from '../game/simulation/types';

/** Fictional opposition. Any resemblance to a real club is unintended. */
export interface ClubDef {
  id: string;
  name: string;
  shortName: string;
  stadiumName: string;
  kit: { primary: string; secondary: string; pattern: KitPattern; cut: KitCut };
  crest: CrestShape;
  formation: FormationId;
  aiStyle: AiStyle;
  /** Squad strength on the first meeting; each lap of the fixture list adds +2. */
  baseOvr: number;
  styleLine: string;
  rival?: boolean;
}

export const CLUBS: readonly ClubDef[] = [
  {
    id: 'cinderfield',
    name: 'Cinderfield FC',
    shortName: 'CIN',
    stadiumName: 'Ashpit Lane',
    kit: { primary: '#F2A33A', secondary: '#1B2235', pattern: 'hoops', cut: 'crew' },
    crest: 'round',
    formation: '2-2-2',
    aiStyle: 'balanced',
    baseOvr: 47,
    styleLine: 'A young academy side. Quick, keen and a little naive.',
  },
  {
    id: 'copperton',
    name: 'Copperton Athletic',
    shortName: 'COP',
    stadiumName: 'The Smelt',
    kit: { primary: '#B5532A', secondary: '#FFF7E9', pattern: 'plain', cut: 'collar' },
    crest: 'shield',
    formation: '3-2-1',
    aiStyle: 'counter',
    baseOvr: 50,
    styleLine: 'Practical and stubborn. They sit deep and wait for your mistake.',
    rival: true,
  },
  {
    id: 'stagmoor',
    name: 'Stagmoor Town',
    shortName: 'STG',
    stadiumName: 'Heathside',
    kit: { primary: '#2F6B3A', secondary: '#E8D9A8', pattern: 'sash', cut: 'vneck' },
    crest: 'pennant',
    formation: '3-2-1',
    aiStyle: 'direct',
    baseOvr: 52,
    styleLine: 'Physical counter-attackers who go long at the first chance.',
  },
  {
    id: 'beacon',
    name: 'Beacon Vale',
    shortName: 'BEA',
    stadiumName: 'Lamp Hill',
    kit: { primary: '#F4F1E6', secondary: '#4178EF', pattern: 'plain', cut: 'vneck' },
    crest: 'round',
    formation: '2-2-2',
    aiStyle: 'passing',
    baseOvr: 54,
    styleLine: 'A technical passing team. Expect them to switch to quick passing.',
  },
  {
    id: 'harbour',
    name: 'Harbour Rovers',
    shortName: 'HAR',
    stadiumName: 'Quayside Park',
    kit: { primary: '#1FA3A0', secondary: '#FFF7E9', pattern: 'stripes', cut: 'crew' },
    crest: 'shield',
    formation: '2-2-2',
    aiStyle: 'balanced',
    baseOvr: 55,
    styleLine: 'Bright, attacking wingers who love the overlap.',
  },
  {
    id: 'kingsyard',
    name: "King's Yard FC",
    shortName: 'KYD',
    stadiumName: 'The Barracks',
    kit: { primary: '#5B2A86', secondary: '#F4C653', pattern: 'halves', cut: 'collar' },
    crest: 'shield',
    formation: '2-2-2',
    aiStyle: 'press',
    baseOvr: 56,
    styleLine: 'Highly disciplined pressers. They will hunt you in packs.',
  },
  {
    id: 'ironbridge',
    name: 'Ironbridge United',
    shortName: 'IRB',
    stadiumName: 'Rivet Road',
    kit: { primary: '#2B2F3A', secondary: '#E04848', pattern: 'stripes', cut: 'vneck' },
    crest: 'pennant',
    formation: '2-2-2',
    aiStyle: 'press',
    baseOvr: 57,
    styleLine: 'The old enemy. An arrogant striker and a noisy away end.',
    rival: true,
  },
];

export const CLUB_BY_ID: Readonly<Record<string, ClubDef>> = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

/** Order the opponents are met in, repeating with +2 strength each lap. */
export const FIXTURE_ORDER: readonly string[] = ['cinderfield', 'copperton', 'stagmoor', 'beacon', 'harbour', 'kingsyard', 'ironbridge'];
