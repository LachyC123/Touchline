import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'title' }
  | { name: 'club' }
  | { name: 'squad' }
  | { name: 'player'; id: string }
  | { name: 'more' }
  | { name: 'lab' }
  | { name: 'match' }
  | { name: 'lineup' }
  | { name: 'live' }
  | { name: 'result'; id: string }
  | { name: 'replay'; id: string; goal: number };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'club':
      return { name: 'club' };
    case 'squad':
      return { name: 'squad' };
    case 'player':
      return parts[1] ? { name: 'player', id: decodeURIComponent(parts[1]) } : { name: 'squad' };
    case 'more':
      return { name: 'more' };
    case 'lab':
      return { name: 'lab' };
    case 'match':
      return { name: 'match' };
    case 'lineup':
      return { name: 'lineup' };
    case 'live':
      return { name: 'live' };
    case 'replay':
      return parts[1] ? { name: 'replay', id: decodeURIComponent(parts[1]), goal: Math.max(0, Number(parts[2] ?? 0) || 0) } : { name: 'match' };
    case 'result':
      return parts[1] ? { name: 'result', id: decodeURIComponent(parts[1]) } : { name: 'match' };
    default:
      return { name: 'title' };
  }
}

export function routeToHash(route: Route): string {
  if (route.name === 'player' || route.name === 'result') return `#/${route.name}/${encodeURIComponent(route.id)}`;
  if (route.name === 'replay') return `#/replay/${encodeURIComponent(route.id)}/${route.goal}`;
  return route.name === 'title' ? '#/' : `#/${route.name}`;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

/** Hash routing keeps deep links working offline and across refreshes with no server config. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeToHash(route);
  if (opts.replace) window.history.replaceState(null, '', hash);
  else window.location.hash = hash;
  if (opts.replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** In-app back: return to the screen's parent if we came from it, otherwise go there directly. */
let lastRoute: string | null = null;
let currentRoute: string | null = null;
if (typeof window !== 'undefined') {
  currentRoute = window.location.hash;
  window.addEventListener('hashchange', () => {
    lastRoute = currentRoute;
    currentRoute = window.location.hash;
  });
}

export function goBack(parent: Route): void {
  if (lastRoute === routeToHash(parent)) window.history.back();
  else navigate(parent);
}

export const DEV_TOOLS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEV_DEBUG === 'true';
