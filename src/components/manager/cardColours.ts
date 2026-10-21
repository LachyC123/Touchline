import type { CardId } from '../../game/simulation/cards';

/** Each card has its own colour so a hand reads at a glance (never colour alone: icon + name too). */
export const CARD_COLOUR: Record<CardId, string> = {
  QUICK_PASS: '#4178EF',
  PRESS: '#FF7956',
  GO_WIDE: '#2FB08C',
  PARK_BUS: '#6B7A99',
  HAIRDRYER: '#DC63B4',
  TARGET_MAN: '#F4C653',
  ALL_OUT: '#E2563B',
  MAN_MARK: '#8C7CFF',
};
