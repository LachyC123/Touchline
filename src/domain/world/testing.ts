import type { ClubDef } from '../../data/clubs';

/** Shape checks shared by tests (kept out of the save schema so domain code stays zod-free). */
export function clubOfSchemaCheck(c: ClubDef): boolean {
  const hex = /^#[0-9A-Fa-f]{6}$/;
  return c.name.length <= 40 && c.shortName.length >= 2 && c.shortName.length <= 4 && hex.test(c.kit.primary) && hex.test(c.kit.secondary) && c.styleLine.length <= 240 && (c.quirk?.length ?? 0) <= 160;
}
