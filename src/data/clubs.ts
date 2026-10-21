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
  /** Squad strength in season 1; each later season adds a little. */
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
    kit: { primary: '#8A3324', secondary: '#E8D9A8', pattern: 'sash', cut: 'vneck' },
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
    kit: { primary: '#2E4DA8', secondary: '#FFF7E9', pattern: 'stripes', cut: 'crew' },
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

/** Division One: the level above. Stronger, more varied benches. */
export const DIVISION_ONE_CLUBS: readonly ClubDef[] = [
  {
    id: 'wexham',
    name: 'Wexham Orient',
    shortName: 'WEX',
    stadiumName: 'The Tannery',
    kit: { primary: '#C8382E', secondary: '#1B2235', pattern: 'stripes', cut: 'collar' },
    crest: 'shield',
    formation: '2-2-2',
    aiStyle: 'press',
    baseOvr: 58,
    styleLine: 'Loud, proud and relentless. They press from the first whistle.',
    rival: true,
  },
  {
    id: 'saltmarsh',
    name: 'Saltmarsh Albion',
    shortName: 'SAL',
    stadiumName: 'Marsh Road',
    kit: { primary: '#E9E4D4', secondary: '#2C6E8F', pattern: 'hoops', cut: 'crew' },
    crest: 'round',
    formation: '3-2-1',
    aiStyle: 'counter',
    baseOvr: 58,
    styleLine: 'A back three that never panics, and a striker who never stops running.',
  },
  {
    id: 'fernhill',
    name: 'Fernhill Wanderers',
    shortName: 'FER',
    stadiumName: 'Bracken Park',
    kit: { primary: '#7B2D8E', secondary: '#F4C653', pattern: 'halves', cut: 'vneck' },
    crest: 'pennant',
    formation: '2-2-2',
    aiStyle: 'passing',
    baseOvr: 59,
    styleLine: 'Neat, patient passers who will happily keep the ball all day.',
  },
  {
    id: 'gallowmere',
    name: 'Gallowmere City',
    shortName: 'GAL',
    stadiumName: 'The Mere',
    kit: { primary: '#2A2D5C', secondary: '#9FD3F0', pattern: 'sash', cut: 'collar' },
    crest: 'shield',
    formation: '3-2-1',
    aiStyle: 'direct',
    baseOvr: 60,
    styleLine: 'Big, direct and dangerous from every cross.',
  },
  {
    id: 'brightwater',
    name: 'Brightwater Town',
    shortName: 'BRT',
    stadiumName: 'The Lido Ground',
    kit: { primary: '#F28C28', secondary: '#FFF7E9', pattern: 'plain', cut: 'crew' },
    crest: 'round',
    formation: '2-2-2',
    aiStyle: 'balanced',
    baseOvr: 61,
    styleLine: 'Seaside favourites with a winger everyone is talking about.',
  },
  {
    id: 'corran',
    name: 'Corran Athletic',
    shortName: 'CRN',
    stadiumName: 'Slate Yard',
    kit: { primary: '#3A3F4A', secondary: '#E8D9A8', pattern: 'stripes', cut: 'vneck' },
    crest: 'pennant',
    formation: '3-2-1',
    aiStyle: 'counter',
    baseOvr: 62,
    styleLine: 'Quarry-hard defenders. Score first or you will not score at all.',
  },
  {
    id: 'halverton',
    name: 'Halverton Rangers',
    shortName: 'HAL',
    stadiumName: 'Halverton Common',
    kit: { primary: '#1D3557', secondary: '#F4F1EA', pattern: 'hoops', cut: 'collar' },
    crest: 'shield',
    formation: '2-2-2',
    aiStyle: 'passing',
    baseOvr: 63,
    styleLine: 'The money club of the division, and they play like it.',
  },
];

export interface DivisionDef {
  index: number;
  name: string;
  clubs: readonly ClubDef[];
  /** Places promoted at the end of a season (0 = top division for now). */
  promote: number;
  /** Places relegated (bottom); 0 = the lowest division. */
  relegate: number;
}

export const DIVISIONS: readonly DivisionDef[] = [
  { index: 0, name: 'County League Division Two', clubs: CLUBS, promote: 2, relegate: 0 },
  { index: 1, name: 'County League Division One', clubs: DIVISION_ONE_CLUBS, promote: 0, relegate: 2 },
];

export const CLUB_BY_ID: Readonly<Record<string, ClubDef>> = Object.fromEntries([...CLUBS, ...DIVISION_ONE_CLUBS].map((c) => [c.id, c]));
