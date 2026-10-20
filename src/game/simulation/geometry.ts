import type { SimPos } from './types';

export const dist = (a: SimPos, b: SimPos): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Shortest distance from p to segment ab, plus the segment parameter t in [0,1]. */
export function segmentDistance(p: SimPos, a: SimPos, b: SimPos): { d: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { d: Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)), t };
}

export function clampPos(p: SimPos, margin = 0.5): SimPos {
  return { x: Math.min(100 - margin, Math.max(margin, p.x)), y: Math.min(150 - margin, Math.max(margin, p.y)) };
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
