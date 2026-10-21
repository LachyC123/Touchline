/**
 * Manager cards: played during a match by spending Momentum. Every card changes what the
 * simulated players actually do (see the engine and ai.ts); none touches the score directly.
 * Pure data — shared by the engine, the AI managers, the save and the UI.
 */
export const CARD_IDS = ['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS', 'HAIRDRYER', 'TARGET_MAN', 'ALL_OUT', 'MAN_MARK'] as const;
export type CardId = (typeof CARD_IDS)[number];

export interface CardDef {
  id: CardId;
  name: string;
  /** Momentum cost (0–10 bar). */
  cost: number;
  /** Match minutes the effect lasts; 0 = an instant effect. */
  durationMin: number;
  /** What it does on the pitch (one line, for the card face). */
  effect: string;
  /** The honest catch. */
  downside: string;
  /** Manager level that unlocks it. */
  unlockLevel: number;
  /** Shape cards replace each other: playing one ends the other. */
  shape?: true;
  /** Icon name from the UI icon set (presentation only). */
  icon: string;
}

export const CARD_DEFS: Readonly<Record<CardId, CardDef>> = {
  QUICK_PASS: { id: 'QUICK_PASS', name: 'Quick Pass', cost: 2, durationMin: 12, effect: 'One-touch tempo: short, sharp passing that beats a press.', downside: 'Fewer dribbles and long balls.', unlockLevel: 1, icon: 'needle' },
  PRESS: { id: 'PRESS', name: 'Press!', cost: 4, durationMin: 12, effect: 'Hunt the ball high: more tackles and turnovers.', downside: 'Tires legs, gives away fouls, leaves space behind.', unlockLevel: 1, icon: 'bolt' },
  GO_WIDE: { id: 'GO_WIDE', name: 'Go Wide', cost: 2, durationMin: 12, effect: 'Stretch the pitch: wingers hug the line and cross.', downside: 'Fewer shots through the middle.', unlockLevel: 1, icon: 'curve' },
  PARK_BUS: { id: 'PARK_BUS', name: 'Park the Bus', cost: 4, durationMin: 10, effect: 'Deep, narrow block: far fewer chances conceded.', downside: 'You barely get forward.', unlockLevel: 1, shape: true, icon: 'wall' },
  HAIRDRYER: { id: 'HAIRDRYER', name: 'Hairdryer', cost: 4, durationMin: 10, effect: 'Team talk: legs refreshed, nerves steadied under pressure.', downside: 'No change of shape — just belief.', unlockLevel: 2, icon: 'megaphone' },
  TARGET_MAN: { id: 'TARGET_MAN', name: 'Target Man', cost: 3, durationMin: 15, effect: 'Crosses and long balls look for your best header of the ball.', downside: 'Predictable if he is outmuscled.', unlockLevel: 3, icon: 'pulse' },
  ALL_OUT: { id: 'ALL_OUT', name: 'All-Out Attack', cost: 5, durationMin: 10, effect: 'Everyone pushes up; more runners, more shots.', downside: 'A high line and big gaps behind. Exhausting.', unlockLevel: 4, shape: true, icon: 'boot' },
  MAN_MARK: { id: 'MAN_MARK', name: 'Man-Mark', cost: 5, durationMin: 15, effect: 'Your best defender shadows their most dangerous player.', downside: 'He leaves his zone to do it.', unlockLevel: 5, icon: 'target' },
};

export const MOMENTUM = {
  max: 10,
  start: 4,
  /** Play ticks per Momentum point (~5.5 match minutes). */
  regenTicks: 66,
  /** Conceding a goal gives the other bench a lift. */
  concedeBonus: 1,
};

export const HAND_SIZE = 3;
export const DECK_MIN = 3;
export const DECK_MAX = 5;

/** The deck a new career starts with (all level-1 cards). */
export const DEFAULT_DECK: readonly CardId[] = ['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS'];

export function isCardId(v: unknown): v is CardId {
  return typeof v === 'string' && (CARD_IDS as readonly string[]).includes(v);
}

/** Opposition benches bring a deck that suits how they play. */
export const AI_DECKS: Readonly<Record<'balanced' | 'press' | 'passing' | 'counter' | 'direct', readonly CardId[]>> = {
  balanced: ['QUICK_PASS', 'PRESS', 'GO_WIDE', 'PARK_BUS', 'HAIRDRYER'],
  press: ['PRESS', 'HAIRDRYER', 'QUICK_PASS', 'ALL_OUT'],
  passing: ['QUICK_PASS', 'GO_WIDE', 'MAN_MARK', 'PARK_BUS'],
  counter: ['PARK_BUS', 'MAN_MARK', 'PRESS', 'QUICK_PASS'],
  direct: ['GO_WIDE', 'TARGET_MAN', 'ALL_OUT', 'PRESS'],
};
