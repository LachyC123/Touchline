import type { AttributeKey, Foot, Position } from '../domain/players/types';

/**
 * Playing archetypes. `offsets` shape the attribute profile around a base level;
 * the generator then shifts everything so the role-weighted Overall hits its target.
 * `subtitles` are the one-line card captions ("Last-ditch wall"); `{foot}` is replaced
 * with Left/Right/Two depending on the player.
 */
export interface Archetype {
  id: string;
  position: Position;
  name: string;
  subtitles: readonly string[];
  offsets: Partial<Record<AttributeKey, number>>;
  traitBias: readonly string[];
  secondary: readonly Position[];
  weight: number;
}

export const ARCHETYPES: readonly Archetype[] = [
  // Goalkeepers
  {
    id: 'gkShotStopper', position: 'GK', name: 'Shot Stopper', weight: 3,
    subtitles: ['Shot-stopping cat', 'Hands like glue', 'Point-blank specialist'],
    offsets: { reflexes: 10, handling: 6, reach: 4, distribution: -6, positioning: 2 },
    traitBias: ['reflexCat', 'bigGame'], secondary: [],
  },
  {
    id: 'gkSweeper', position: 'GK', name: 'Sweeper Keeper', weight: 2,
    subtitles: ['Rushes out to sweep', 'Eleventh outfielder', 'Starts every attack'],
    offsets: { distribution: 10, positioning: 6, pace: 8, passing: 8, reflexes: -3, handling: -2 },
    traitBias: ['sweeperKeeper', 'captainsVoice'], secondary: [],
  },
  {
    id: 'gkCommander', position: 'GK', name: 'Commanding Keeper', weight: 2,
    subtitles: ['Owns the six-yard box', 'Loud, tall and fearless', 'Claims every cross'],
    offsets: { reach: 10, handling: 6, strength: 10, composure: 6, reflexes: -2 },
    traitBias: ['captainsVoice', 'bigGame'], secondary: [],
  },
  // Defenders
  {
    id: 'defStopper', position: 'DEF', name: 'Stopper', weight: 3,
    subtitles: ['Last-ditch wall', 'Never-say-die blocker', 'Throws himself at everything'],
    offsets: { tackling: 10, strength: 9, marking: 6, dribbling: -10, vision: -6, finishing: -12, acceleration: -4 },
    traitBias: ['brickWall', 'captainsVoice'], secondary: ['MID'],
  },
  {
    id: 'defReader', position: 'DEF', name: 'Reader', weight: 2,
    subtitles: ['Reads it early', 'Always a step ahead', 'Cool interceptor'],
    offsets: { marking: 10, composure: 8, vision: 4, passing: 3, strength: -3, finishing: -12 },
    traitBias: ['bigGame', 'brickWall'], secondary: ['MID'],
  },
  {
    id: 'defBallPlayer', position: 'DEF', name: 'Ball-Playing Defender', weight: 2,
    subtitles: ['Calm on the ball', '{foot}-foot quarterback', 'Plays out from the back'],
    offsets: { passing: 10, vision: 7, ballControl: 6, composure: 5, strength: -4, tackling: -2, finishing: -10 },
    traitBias: ['needlePass', 'twoFooted'], secondary: ['MID'],
  },
  {
    id: 'defFlyer', position: 'DEF', name: 'Overlapping Flyer', weight: 2,
    subtitles: ['Overlapping flyer', 'Up and down all day', 'Bombs on, tracks back'],
    offsets: { pace: 10, acceleration: 8, stamina: 8, dribbling: 3, strength: -6, marking: -2, finishing: -8 },
    traitBias: ['ironLungs', 'rocketStart'], secondary: ['MID'],
  },
  // Midfielders
  {
    id: 'midPlaymaker', position: 'MID', name: 'Playmaker', weight: 3,
    subtitles: ['{foot}-foot magician', 'Sees passes nobody else does', 'Pulls the strings'],
    offsets: { vision: 10, passing: 9, ballControl: 6, setPieces: 6, tackling: -8, strength: -6, stamina: -3 },
    traitBias: ['needlePass', 'setPieceArtist'], secondary: ['FWD'],
  },
  {
    id: 'midEngine', position: 'MID', name: 'Box-to-Box Engine', weight: 3,
    subtitles: ['Box-to-box engine', 'Covers every blade', 'Arrives late in the box'],
    offsets: { stamina: 12, tackling: 4, shooting: 4, strength: 4, vision: -4, setPieces: -4 },
    traitBias: ['ironLungs', 'longRanger'], secondary: ['DEF', 'FWD'],
  },
  {
    id: 'midDestroyer', position: 'MID', name: 'Destroyer', weight: 2,
    subtitles: ['Midfield destroyer', 'Breaks up play', 'Wins it, gives it simple'],
    offsets: { tackling: 12, marking: 8, strength: 7, dribbling: -8, finishing: -10, vision: -4 },
    traitBias: ['brickWall', 'ironLungs'], secondary: ['DEF'],
  },
  {
    id: 'midDribbler', position: 'MID', name: 'Carrier', weight: 2,
    subtitles: ['Glides past challenges', 'Ball glued to his boots', 'Drives through the middle'],
    offsets: { dribbling: 12, ballControl: 8, acceleration: 6, tackling: -8, marking: -8, strength: -4 },
    traitBias: ['rocketStart', 'twoFooted'], secondary: ['FWD'],
  },
  // Forwards
  {
    id: 'fwdPoacher', position: 'FWD', name: 'Poacher', weight: 3,
    subtitles: ['Six-yard poacher', 'Lives on the shoulder', 'Born in the box'],
    offsets: { finishing: 12, composure: 6, acceleration: 6, passing: -6, stamina: -6, tackling: -10, setPieces: -4 },
    traitBias: ['poacher', 'rocketStart'], secondary: [],
  },
  {
    id: 'fwdSpeedster', position: 'FWD', name: 'Speedster', weight: 3,
    subtitles: ['Fearless dribbler', 'Rocket-heeled winger', 'Runs in behind all day'],
    offsets: { pace: 12, acceleration: 10, dribbling: 8, strength: -8, composure: -4, tackling: -10 },
    traitBias: ['rocketStart', 'twoFooted'], secondary: ['MID'],
  },
  {
    id: 'fwdTarget', position: 'FWD', name: 'Target Forward', weight: 2,
    subtitles: ['Big unit up top', 'Holds it up, brings others in', 'Wins every header'],
    offsets: { strength: 14, finishing: 4, composure: 4, pace: -8, acceleration: -8, dribbling: -6 },
    traitBias: ['captainsVoice', 'poacher'], secondary: [],
  },
  {
    id: 'fwdSniper', position: 'FWD', name: 'Sniper', weight: 2,
    subtitles: ['Long-range sniper', 'Shoots on sight', '{foot}-foot thunderbolt'],
    offsets: { shooting: 13, setPieces: 8, composure: 3, finishing: -2, pace: -4, tackling: -10 },
    traitBias: ['longRanger', 'setPieceArtist'], secondary: ['MID'],
  },
];

export function archetypesFor(position: Position): Archetype[] {
  return ARCHETYPES.filter((a) => a.position === position);
}

export const ARCHETYPE_BY_ID: Readonly<Record<string, Archetype>> = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

export function footWord(foot: Foot): string {
  return foot === 'left' ? 'Left' : foot === 'right' ? 'Right' : 'Either';
}
