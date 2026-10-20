import type { Position } from '../domain/players/types';

/**
 * The 12 launch traits. Effects are bounded multipliers consumed by the match engine (M1+);
 * no trait may ever force a goal or a save. `cap` is the maximum relative effect.
 */
export interface TraitDef {
  id: string;
  name: string;
  short: string;
  description: string;
  icon: TraitIcon;
  positions: readonly Position[];
  cap: number;
}

export type TraitIcon = 'bolt' | 'boot' | 'target' | 'needle' | 'wall' | 'lungs' | 'glove' | 'cat' | 'pulse' | 'curve' | 'megaphone' | 'feet';

export const TRAITS: readonly TraitDef[] = [
  { id: 'rocketStart', name: 'Rocket Start', short: 'Explodes into open lanes', description: 'Early acceleration bonus when sprinting into open space.', icon: 'bolt', positions: ['DEF', 'MID', 'FWD'], cap: 0.08 },
  { id: 'poacher', name: 'Poacher', short: 'Always first to rebounds', description: 'Better positioning for loose balls inside the box.', icon: 'boot', positions: ['FWD', 'MID'], cap: 0.08 },
  { id: 'longRanger', name: 'Long Ranger', short: 'Shoots from distance', description: 'Higher quality on plausible long-range shots.', icon: 'target', positions: ['MID', 'FWD', 'DEF'], cap: 0.07 },
  { id: 'needlePass', name: 'Needle Pass', short: 'Threads tight gaps', description: 'Small precision bonus on tight through balls.', icon: 'needle', positions: ['MID', 'FWD', 'DEF'], cap: 0.06 },
  { id: 'brickWall', name: 'Brick Wall', short: 'Stands up direct runners', description: 'Better standing tackles against players running straight at goal.', icon: 'wall', positions: ['DEF', 'MID'], cap: 0.08 },
  { id: 'ironLungs', name: 'Iron Lungs', short: 'Presses all day', description: 'Lower fatigue cost when pressing.', icon: 'lungs', positions: ['DEF', 'MID', 'FWD'], cap: 0.2 },
  { id: 'sweeperKeeper', name: 'Sweeper Keeper', short: 'Rushes out to sweep', description: 'More aggressive starting position off the line.', icon: 'glove', positions: ['GK'], cap: 0.1 },
  { id: 'reflexCat', name: 'Reflex Cat', short: 'Lightning close saves', description: 'Small improvement on close-range shot saves.', icon: 'cat', positions: ['GK'], cap: 0.06 },
  { id: 'bigGame', name: 'Big-Game Temperament', short: 'Calm on big nights', description: 'Pressure penalty reduced in derbies and cup ties.', icon: 'pulse', positions: ['GK', 'DEF', 'MID', 'FWD'], cap: 0.1 },
  { id: 'setPieceArtist', name: 'Set-Piece Artist', short: 'Whips in dangerous balls', description: 'Better free-kick and corner delivery.', icon: 'curve', positions: ['MID', 'FWD', 'DEF'], cap: 0.08 },
  { id: 'captainsVoice', name: "Captain's Voice", short: 'Lifts those around him', description: 'Small confidence boost to nearby teammates.', icon: 'megaphone', positions: ['GK', 'DEF', 'MID', 'FWD'], cap: 0.04 },
  { id: 'twoFooted', name: 'Two-Footed', short: 'No weaker side', description: 'Smaller weak-foot penalty on passes and shots.', icon: 'feet', positions: ['DEF', 'MID', 'FWD'], cap: 0.1 },
];

export const TRAIT_BY_ID: Readonly<Record<string, TraitDef>> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
