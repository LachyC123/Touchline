import { PLAYER_CLUB_ID, type ClubSave } from '../../domain/save/types';
import { clubOf } from '../../domain/world/world';

/** Crest props for any club id in the league (our club uses its own identity). */
export function crestOf(save: ClubSave, id: string) {
  if (id === PLAYER_CLUB_ID) return save.club;
  const c = clubOf(save.world, id);
  return c ? { name: c.name, shortName: c.shortName, crest: c.crest, kit: c.kit } : save.club;
}

