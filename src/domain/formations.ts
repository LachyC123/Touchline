import type { Position } from './players/types';

/**
 * 7-a-side formations. `x` is across the pitch (0 = left touchline, 100 = right) and
 * `depth` runs from the team's own goal line (0) to the opponent's (1), in that team's
 * attacking frame. The simulation shifts these anchors with the ball and the tactic.
 */
export const FORMATION_IDS = ['2-2-2', '3-2-1'] as const;
export type FormationId = (typeof FORMATION_IDS)[number];

export interface FormationSlot {
  id: string;
  position: Position;
  x: number;
  depth: number;
}

export interface FormationDef {
  id: FormationId;
  name: string;
  blurb: string;
  slots: readonly FormationSlot[];
}

export const FORMATION_DEFS: Record<FormationId, FormationDef> = {
  '2-2-2': {
    id: '2-2-2',
    name: 'Balanced',
    blurb: 'Two up top, two in the engine room. Predictable and solid.',
    slots: [
      { id: 'GK', position: 'GK', x: 50, depth: 0.03 },
      { id: 'DEF_L', position: 'DEF', x: 30, depth: 0.2 },
      { id: 'DEF_R', position: 'DEF', x: 70, depth: 0.2 },
      { id: 'MID_L', position: 'MID', x: 30, depth: 0.44 },
      { id: 'MID_R', position: 'MID', x: 70, depth: 0.44 },
      { id: 'FWD_L', position: 'FWD', x: 38, depth: 0.66 },
      { id: 'FWD_R', position: 'FWD', x: 62, depth: 0.66 },
    ],
  },
  '3-2-1': {
    id: '3-2-1',
    name: 'Fortress',
    blurb: 'A back three and a lone striker. Hard to break down, built to counter.',
    slots: [
      { id: 'GK', position: 'GK', x: 50, depth: 0.03 },
      { id: 'DEF_L', position: 'DEF', x: 22, depth: 0.19 },
      { id: 'DEF_C', position: 'DEF', x: 50, depth: 0.16 },
      { id: 'DEF_R', position: 'DEF', x: 78, depth: 0.19 },
      { id: 'MID_L', position: 'MID', x: 34, depth: 0.42 },
      { id: 'MID_R', position: 'MID', x: 66, depth: 0.42 },
      { id: 'FWD_C', position: 'FWD', x: 50, depth: 0.64 },
    ],
  },
};

export function slotPosition(formation: FormationId, slotId: string): Position | undefined {
  return FORMATION_DEFS[formation].slots.find((s) => s.id === slotId)?.position;
}
