export const KIT_PATTERNS = ['plain', 'stripes', 'hoops', 'sash', 'halves'] as const;
export type KitPattern = (typeof KIT_PATTERNS)[number];

export const KIT_CUTS = ['crew', 'vneck', 'collar'] as const;
export type KitCut = (typeof KIT_CUTS)[number];

/** Kit style belongs to the club, never to an individual player. */
export interface Kit {
  primary: string;
  secondary: string;
  pattern: KitPattern;
  cut: KitCut;
}

export const CREST_SHAPES = ['shield', 'round', 'pennant'] as const;
export type CrestShape = (typeof CREST_SHAPES)[number];

export interface ClubIdentity {
  name: string;
  shortName: string;
  stadiumName: string;
  kit: Kit;
  crest: CrestShape;
}

export const DEFAULT_CLUB: ClubIdentity = {
  name: 'Millbrook Town',
  shortName: 'MIL',
  stadiumName: 'The Old Gasworks',
  kit: { primary: '#E2563B', secondary: '#FFF7E9', pattern: 'plain', cut: 'crew' },
  crest: 'shield',
};
