import { useEffect, useState } from 'react';
import { playSfx, type SfxName } from '../../audio/sfx';

/**
 * Counts from 0 to `target` with an ease-out curve (requestAnimationFrame). Disabled = the final
 * value straight away (reduced motion, or a screen revisited after the moment has passed).
 */
export function useCountUp(target: number, ms: number, enabled: boolean, opts: { delayMs?: number; tickEvery?: number; sfx?: SfxName | null } = {}): number {
  const { delayMs = 0, tickEvery = 12, sfx = 'coin' } = opts;
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let lastTick = 0;
    const start = performance.now() + delayMs;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / ms));
      const next = Math.round(target * (1 - Math.pow(1 - t, 3)));
      setV(next);
      if (sfx && next - lastTick >= tickEvery) {
        lastTick = next;
        playSfx(sfx);
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, enabled, delayMs, tickEvery, sfx]);
  return enabled ? v : target;
}
