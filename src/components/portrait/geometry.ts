export type Pt = readonly [number, number];

const f = (n: number) => Math.round(n * 10) / 10;

/** Smooth closed path through points (Catmull–Rom converted to cubic Béziers). */
export function smoothClosed(points: readonly Pt[], tension = 1): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n] as Pt;
  let d = `M${f(at(0)[0])},${f(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return `${d} Z`;
}

/** Smooth open path through points. */
export function smoothOpen(points: readonly Pt[], tension = 1): string {
  const n = points.length;
  const at = (i: number) => points[Math.max(0, Math.min(n - 1, i))] as Pt;
  let d = `M${f(at(0)[0])},${f(at(0)[1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

export function mirrorX(points: readonly Pt[], cx = 100): Pt[] {
  return points.map(([x, y]) => [2 * cx - x, y] as const);
}
