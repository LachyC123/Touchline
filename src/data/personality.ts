import type { CelebrationId, PersonalityType, Position } from '../domain/players/types';

export interface PersonalityDef {
  id: PersonalityType;
  label: string;
  blurb: string;
  /** Nudges applied on top of rolled personality modifiers (bounded). */
  bias: Partial<Record<'loyalty' | 'ambition' | 'professionalism' | 'confidence' | 'sociability', number>>;
}

export const PERSONALITIES: readonly PersonalityDef[] = [
  { id: 'selfless', label: 'Selfless', blurb: 'Would rather lay it on a plate than score himself.', bias: { sociability: 12, ambition: -6, loyalty: 6 } },
  { id: 'hotHeaded', label: 'Hot-headed', blurb: 'Plays on the edge. Usually the right side of it.', bias: { confidence: 8, professionalism: -10 } },
  { id: 'ambitious', label: 'Ambitious', blurb: 'Has a plan for the next five years. And the five after.', bias: { ambition: 18, loyalty: -8 } },
  { id: 'laidBack', label: 'Laid-back', blurb: 'Nothing rattles him — not even the warm-up.', bias: { professionalism: -6, sociability: 8, confidence: 4 } },
  { id: 'resilient', label: 'Resilient', blurb: 'Gets knocked down, bounces back up grinning.', bias: { confidence: 6, professionalism: 8 } },
  { id: 'anxious', label: 'Feels the pressure', blurb: 'Cares enormously. Grows with trust and minutes.', bias: { confidence: -12, professionalism: 8, loyalty: 6 } },
  { id: 'perfectionist', label: 'Perfectionist', blurb: 'First in, last out, re-laces his boots twice.', bias: { professionalism: 18, sociability: -6 } },
  { id: 'joker', label: 'Dressing-room joker', blurb: 'Keeps spirits up. Occasionally the kit man\'s nemesis.', bias: { sociability: 18, professionalism: -8 } },
  { id: 'bigGame', label: 'Big-game player', blurb: 'Quiet on a Tuesday, unstoppable under the lights.', bias: { confidence: 14, ambition: 6 } },
];

export const PERSONALITY_BY_ID: Readonly<Record<PersonalityType, PersonalityDef>> = Object.fromEntries(
  PERSONALITIES.map((p) => [p.id, p]),
) as Record<PersonalityType, PersonalityDef>;

export interface DreamDef {
  id: string;
  text: string;
  positions: readonly Position[];
}

export const DREAMS: readonly DreamDef[] = [
  { id: 'scoreFinal', text: 'Score in a cup final', positions: ['MID', 'FWD'] },
  { id: 'captain', text: 'Wear the captain’s armband', positions: ['GK', 'DEF', 'MID', 'FWD'] },
  { id: 'distanceGoal', text: 'Score from outside the box', positions: ['DEF', 'MID', 'FWD'] },
  { id: 'starts25', text: 'Play 25 games for the club', positions: ['GK', 'DEF', 'MID', 'FWD'] },
  { id: 'cleanSheets10', text: 'Keep 10 clean sheets', positions: ['GK', 'DEF'] },
  { id: 'penaltySave', text: 'Save a penalty', positions: ['GK'] },
  { id: 'hatTrick', text: 'Bag a hat-trick', positions: ['FWD'] },
  { id: 'promotion', text: 'Win promotion with the club', positions: ['GK', 'DEF', 'MID', 'FWD'] },
  { id: 'derbyWinner', text: 'Score the winner in a derby', positions: ['DEF', 'MID', 'FWD'] },
  { id: 'assists10', text: 'Set up 10 goals in a season', positions: ['DEF', 'MID', 'FWD'] },
  { id: 'legend', text: 'Get his name on the clubhouse wall', positions: ['GK', 'DEF', 'MID', 'FWD'] },
];

export const DREAM_BY_ID: Readonly<Record<string, DreamDef>> = Object.fromEntries(DREAMS.map((d) => [d.id, d]));

export const CELEBRATIONS: Readonly<Record<CelebrationId, string>> = {
  kneeSlide: 'Knee slide',
  aeroplane: 'Aeroplane arms',
  salute: 'Salute to the stand',
  cuppedEar: 'Cupped ear',
  shush: 'Finger to lips',
  robot: 'The robot',
  heartHands: 'Heart hands',
  cornerFlag: 'Corner-flag jig',
  backflip: 'Backflip',
};

export interface OriginStory {
  id: string;
  chip: string;
  line: string;
  minAge: number;
  maxAge: number;
}

/** `{town}` resolves to the player's hometown. Short, specific, never mocking. */
export const ORIGIN_STORIES: readonly OriginStory[] = [
  { id: 'sundayLeague', chip: 'Sunday League hero', line: 'Top scorer for a pub side in {town} three seasons running.', minAge: 18, maxAge: 34 },
  { id: 'academyRelease', chip: 'Second chance', line: 'Released by a big academy at 16. Never stopped training.', minAge: 17, maxAge: 24 },
  { id: 'localLad', chip: 'Local lad', line: 'Grew up two streets from the ground in {town}.', minAge: 16, maxAge: 34 },
  { id: 'schoolsCup', chip: 'Schools Cup winner', line: 'Lifted the county Schools Cup with {town} Grammar.', minAge: 16, maxAge: 21 },
  { id: 'futsal', chip: 'Futsal convert', line: 'Learned his touch on the indoor courts of {town}.', minAge: 17, maxAge: 30 },
  { id: 'comeback', chip: 'Comeback kid', line: 'Back after a year out injured — hungrier than ever.', minAge: 21, maxAge: 34 },
  { id: 'journeyman', chip: 'Journeyman', line: 'Seven clubs in seven years. Wants to finally settle.', minAge: 25, maxAge: 34 },
  { id: 'trialist', chip: 'Open trial find', line: 'Turned up to an open trial in borrowed boots.', minAge: 16, maxAge: 26 },
  { id: 'beachFootball', chip: 'Beach baller', line: 'Grew up playing barefoot on the sands near {town}.', minAge: 17, maxAge: 30 },
  { id: 'cupGiantKiller', chip: 'Giant-killer', line: 'Scored against a pro side in a famous {town} cup run.', minAge: 20, maxAge: 34 },
  { id: 'coachKid', chip: 'Coach’s kid', line: 'Has been carrying the cones since he could walk.', minAge: 16, maxAge: 25 },
  { id: 'lateBloomer', chip: 'Late bloomer', line: 'Worked as an electrician in {town} until a scout spotted him.', minAge: 23, maxAge: 34 },
];

export const ORIGIN_BY_ID: Readonly<Record<string, OriginStory>> = Object.fromEntries(ORIGIN_STORIES.map((o) => [o.id, o]));

export const NICKNAME_TEMPLATES: readonly { pattern: string; when?: 'fwd' | 'def' | 'gk' | 'fast' | 'any' }[] = [
  { pattern: 'The Wall', when: 'def' },
  { pattern: 'Rocket', when: 'fast' },
  { pattern: 'Gloves', when: 'gk' },
  { pattern: 'Ice', when: 'fwd' },
  { pattern: 'Sniper', when: 'fwd' },
  { pattern: 'Duracell', when: 'any' },
  { pattern: 'Smudge', when: 'any' },
  { pattern: 'Gaffer', when: 'any' },
  { pattern: 'Spider', when: 'gk' },
  { pattern: 'Bulldog', when: 'def' },
  { pattern: 'Whippet', when: 'fast' },
  { pattern: 'Maestro', when: 'any' },
];
