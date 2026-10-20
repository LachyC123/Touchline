import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';

/**
 * Registers the service worker in production builds and offers a calm "update ready" prompt
 * instead of reloading underneath the player.
 */
export function PwaPrompt() {
  const [update, setUpdate] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.VITE_ARTIFACT || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update) return null;
  return (
    <div className="toasts" style={{ pointerEvents: 'auto' }}>
      <div className="toast" role="status">
        <span style={{ flex: 1 }}>A new version of TOUCHLINE! is ready.</span>
        <Button size="sm" variant="primary" onClick={() => void update()}>
          Update
        </Button>
      </div>
    </div>
  );
}
