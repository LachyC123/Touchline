import { CLUB_BY_ID } from '../../data/clubs';
import { PLAYER_CLUB_ID, type ClubSave } from '../../domain/save/types';

/** Crest props for any club id in the league (our club uses its own identity). */
export function crestOf(save: ClubSave, id: string) {
  if (id === PLAYER_CLUB_ID) return save.club;
  const c = CLUB_BY_ID[id];
  return c ? { name: c.name, shortName: c.shortName, crest: c.crest, kit: c.kit } : save.club;
}

