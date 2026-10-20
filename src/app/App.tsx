import { lazy, Suspense, useEffect, useState } from 'react';
import { unlockAudio } from '../audio/sfx';
import { BottomNav } from '../components/layout/BottomNav';
import '../components/layout/layout.css';
import { Button } from '../components/ui/Button';
import { ToastProvider } from '../components/ui/Toast';
import { ClubScreen } from '../features/club/ClubScreen';
import { MoreScreen } from '../features/settings/MoreScreen';
import { PlayerScreen } from '../features/squad/PlayerScreen';
import { SquadScreen } from '../features/squad/SquadScreen';
import { TitleScreen } from '../features/title/TitleScreen';
import { openStorage } from '../storage/saveRepo';
import { GameProvider, useGame } from './GameContext';
import { PwaPrompt } from './PwaPrompt';
import { DEV_TOOLS_ENABLED, navigate, useRoute } from './router';

// Developer tooling is code-split so it never ships in the main bundle.
const CardLab = lazy(() => import('../features/dev/CardLab').then((m) => ({ default: m.CardLab })));

type Boot = { status: 'opening' } | { status: 'ok' } | { status: 'failed'; message: string };

export function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'opening' });

  useEffect(() => {
    openStorage()
      .then(() => setBoot({ status: 'ok' }))
      .catch((err: unknown) => setBoot({ status: 'failed', message: err instanceof Error ? err.message : String(err) }));
    // Browsers only allow audio after a gesture; unlock on the first touch/click.
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  if (boot.status === 'failed') {
    return (
      <div className="app-bg">
        <div className="boot">
          <div className="boot__panel">
            <h1>We can’t save on this browser</h1>
            <p>{boot.message} Try a normal (non-private) window, or allow site data for this page, then reload.</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (boot.status === 'opening') return <div className="app-bg" />;

  return (
    <ToastProvider>
      <GameProvider>
        <div className="app-bg">
          <div className="shell">
            <Screens />
          </div>
        </div>
        <PwaPrompt />
      </GameProvider>
    </ToastProvider>
  );
}

function Screens() {
  const route = useRoute();
  const { saveState } = useGame();

  const hasSave = saveState.status === 'ready' && saveState.save !== null;
  const needsSave = route.name !== 'title' && route.name !== 'lab' && route.name !== 'more';

  if (saveState.status === 'loading') return null;
  if (saveState.status === 'corrupt') {
    return (
      <div className="boot">
        <div className="boot__panel">
          <h1>Your save needs attention</h1>
          <p>{saveState.message} Your data has not been deleted. Open More to import an exported save or restore a backup.</p>
          <Button variant="primary" onClick={() => navigate({ name: 'more' })}>
            Open More
          </Button>
        </div>
        <MoreScreen />
      </div>
    );
  }

  // Deep links without a career show the title screen in place (no redirect, so a career
  // that is being created this instant is never bounced back to the title).
  if (route.name === 'title' || (!hasSave && needsSave)) return <TitleScreen />;
  if (route.name === 'lab' && !DEV_TOOLS_ENABLED) return <TitleScreen />;

  return (
    <>
      {route.name === 'club' && <ClubScreen />}
      {route.name === 'squad' && <SquadScreen />}
      {route.name === 'player' && <PlayerScreen key={route.id} id={route.id} />}
      {route.name === 'more' && <MoreScreen />}
      {route.name === 'lab' && (
        <Suspense fallback={null}>
          <CardLab />
        </Suspense>
      )}
      {(hasSave || route.name === 'more') && <BottomNav current={route} />}
    </>
  );
}
