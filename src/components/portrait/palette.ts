import type { EyeColourId, FaceId, HairColourId, SkinId } from '../../domain/players/types';

/** Shared ink colour for every outline in the portrait kit (2.6px at 200-unit scale). */
export const INK = '#1B2235';

export const SKIN: Record<SkinId, { base: string; shade: string; lip: string }> = {
  s1: { base: '#F7DCC8', shade: '#E2B59A', lip: '#C9877A' },
  s2: { base: '#EECAA6', shade: '#D4A17A', lip: '#BC7B63' },
  s3: { base: '#E1B386', shade: '#C38D5E', lip: '#A86A4D' },
  s4: { base: '#C99565', shade: '#A77244', lip: '#8D553A' },
  s5: { base: '#A9754A', shade: '#875833', lip: '#6F4129' },
  s6: { base: '#8B5B37', shade: '#6C4226', lip: '#57311F' },
  s7: { base: '#6C442A', shade: '#53311D', lip: '#43271A' },
  s8: { base: '#4B2F1F', shade: '#372014', lip: '#2E1A11' },
};

export const HAIR: Record<HairColourId, { base: string; light: string; brow: string }> = {
  black: { base: '#1F1B1D', light: '#4A4146', brow: '#1F1B1D' },
  darkBrown: { base: '#3C281B', light: '#654532', brow: '#2E1F15' },
  brown: { base: '#6B452A', light: '#93673F', brow: '#4D311E' },
  auburn: { base: '#8E3D22', light: '#B9603A', brow: '#6A2D19' },
  ginger: { base: '#C9672D', light: '#EC9454', brow: '#A4531F' },
  blonde: { base: '#E0BA62', light: '#F6DB95', brow: '#A7843D' },
  platinum: { base: '#EEE7D7', light: '#FFFFFF', brow: '#8F877A' },
  grey: { base: '#A5A3A0', light: '#D2D0CC', brow: '#77746F' },
};

export const IRIS: Record<EyeColourId, string> = {
  dark: '#2A1D17',
  brown: '#5C3A22',
  hazel: '#7B6830',
  blue: '#3E78C5',
  green: '#4E8A4A',
  grey: '#7B8A96',
};

/** Face silhouettes. All share the same anchors (crown y=38, ears at y≈100) so parts line up. */
export const FACE_SHAPES: Record<FaceId, { temple: number; cheek: number; jaw: number; chinY: number; chinW: number }> = {
  oval: { temple: 39, cheek: 41, jaw: 32, chinY: 147, chinW: 10 },
  round: { temple: 42, cheek: 45, jaw: 38, chinY: 143, chinW: 15 },
  square: { temple: 40, cheek: 42, jaw: 40, chinY: 145, chinW: 21 },
  long: { temple: 37, cheek: 38, jaw: 31, chinY: 151, chinW: 11 },
  heart: { temple: 43, cheek: 41, jaw: 28, chinY: 146, chinW: 7 },
  broad: { temple: 44, cheek: 47, jaw: 41, chinY: 144, chinW: 19 },
};

export const CROWN_Y = 38;
