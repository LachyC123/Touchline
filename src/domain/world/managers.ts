import type { ClubDef } from '../../data/clubs';
import { NAME_POOLS } from '../../data/names';
import { stream } from '../rng';

/**
 * Every opposing club has a manager with a name and a habit, generated from the career seed
 * and the club (so they never change, and differ between careers).
 */

const HABITS = [
  'prowls the touchline in a sheepskin coat whatever the weather',
  'has never been seen smiling in public',
  'was a striker once and still thinks he is one',
  'keeps a notebook of every slight against his club',
  'brings three laptops and a drone to training',
  'speaks only in clichés, all of them true',
  'is the longest-serving manager in the county',
  'is a young coach with a big reputation and bigger hair',
  'kicks every water bottle within reach',
  'once got sent off for arguing with a linesman about the weather',
  'plays the same three players in every position',
  'swears by an old-fashioned flat back four',
  'eats a banana at exactly half-time, every game',
  'does his team talks in rhyme',
] as const;

const TITLES = ['the Boss', 'the Gaffer', 'the Professor', 'Big', 'Old'] as const;

export interface Manager {
  name: string;
  /** What the fans call him. */
  known: string;
  habit: string;
}

export function managerOf(careerSeed: string, club: Pick<ClubDef, 'id'>): Manager {
  const rng = stream(`${careerSeed}:manager:${club.id}`, 'world');
  const pool = rng.weighted(NAME_POOLS.map((p) => [p, p.weight] as const));
  const first = rng.pick(pool.given);
  const last = rng.pick(pool.family);
  const title = rng.pick(TITLES);
  return {
    name: `${first} ${last}`,
    known: title === 'Big' || title === 'Old' ? `${title} ${first}` : `${title}`,
    habit: rng.pick(HABITS),
  };
}
