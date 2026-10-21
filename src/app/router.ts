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
  | { name: 'replay'; id: string; goal: number }
  | { name: 'intro'; replay: boolean }
  | { name: 'scout' }
  | { name: 'pack'; id: string }
  | { name: 'setup' }
  | { name: 'cards' }
  | { name: 'league' }
  | { name: 'season' }
  | { name: 'event'; id: string };

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
    case 'intro':
      return { name: 'intro', replay: parts[1] === 'replay' };
    case 'scout':
      return { name: 'scout' };
    case 'pack':
      return parts[1] ? { name: 'pack', id: decodeURIComponent(parts[1]) } : { name: 'scout' };
    case 'setup':
      return { name: 'setup' };
    case 'cards':
      return { name: 'cards' };
    case 'league':
      return { name: 'league' };
    case 'season':
      return { name: 'season' };
    case 'event':
      return parts[1] ? { name: 'event', id: decodeURIComponent(parts[1]) } : { name: 'club' };
    default:
      return { name: 'title' };
  }
}

export function routeToHash(route: Route): string {
  if (route.name === 'player' || route.name === 'result' || route.name === 'pack' || route.name === 'event') return `#/${route.name}/${encodeURIComponent(route.id)}`;
  if (route.name === 'intro') return route.replay ? '#/intro/replay' : '#/intro';
  if (route.name === 'replay') return `#/replay/${encodeURIComponent(route.id)}/${route.goal}`;
  return route.name === 'title' ? '#/' : `#/${route.name}`;
}

/*
 * Route state lives in memory and is mirrored to location.hash when the host allows it.
 * Some embedding frames (e.g. the claude.ai Artifact viewer) don't keep hash changes, so the
 * app must never depend on reading the hash back.
 */
let current: string = typeof window !== 'undefined' ? window.location.hash : '';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  const sync = () => {
    // Browser back/forward or a typed URL.
    if (window.location.hash !== current) {
      current = window.location.hash;
      emit();
    }
  };
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => current, () => '');
  return parseHash(hash);
}

export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeToHash(route);
  current = hash;
  try {
    if (opts.replace) window.history.replaceState(null, '', hash);
    else if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  } catch {
    /* the host frame may refuse URL changes; in-memory routing still works */
  }
  emit();
}

/**
 * In-app back goes to the screen's parent. It never calls history.back(): inside an embedding
 * frame that could navigate the host page instead of the game.
 */
export function goBack(parent: Route): void {
  navigate(parent);
}

export const DEV_TOOLS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEV_DEBUG === 'true';
