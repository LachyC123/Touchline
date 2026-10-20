import { useSyncExternalStore } from 'react';

/**
 * Reduced motion = explicit Settings choice, otherwise the OS preference.
 * Settings write `data-motion` on <html> ('reduced' | 'full' | absent = follow OS).
 */
function compute(): boolean {
  if (typeof document === 'undefined') return false;
  const pref = document.documentElement.dataset.motion;
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribe(onChange: () => void): () => void {
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  mq?.addEventListener('change', onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    mq?.removeEventListener('change', onChange);
    mo.disconnect();
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, compute, () => false);
}

export function isReducedMotion(): boolean {
  return compute();
}
