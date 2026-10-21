import { lazy, Suspense, useEffect, useState } from 'react';
import { unlockAudio } from '../audio/sfx';
import { BottomNav } from '../components/layout/BottomNav';
import '../components/layout/layout.css';
import { Button } from '../components/ui/Button';
import { ToastProvider } from '../components/ui/Toast';
import { ClubScreen } from '../features/club/ClubScreen';
import { LineupScreen } from '../features/lineup/LineupScreen';
import { LiveMatch } from '../features/match/LiveMatch';
import { MatchLobby } from '../features/match/MatchLobby';
import { ReplayScreen } from '../features/match/ReplayScreen';
import { ResultScreen } from '../features/match/ResultScreen';
import { DeckScreen } from '../features/cards/DeckScreen';
import { LeagueScreen } from '../features/league/LeagueScreen';
import { SeasonScreen } from '../features/league/SeasonScreen';
import { EventScreen } from '../features/dressing/EventScreen';
import { ClubSetup } from '../features/onboarding/ClubSetup';
import { IntroScreen } from '../features/onboarding/IntroScreen';
import { PackScreen } from '../features/scout/PackScreen';
import { ScoutScreen } from '../features/scout/ScoutScreen';
import { MoreScreen } from '../features/settings/MoreScreen';
import { PlayerScreen } from '../features/squad/PlayerScreen';
import { SquadScreen } from '../features/squad/SquadScreen';
import { TitleScreen } from '../features/title/TitleScreen';
import { switchToMemoryDb } from '../storage/db';
import { openStorage } from '../storage/saveRepo';
import { GameProvider, useGame } from './GameContext';
import { PwaPrompt } from './PwaPrompt';
import { DEV_TOOLS_ENABLED, navigate, useRoute } from './router';
import { MarketScreen } from '../features/market/MarketScreen';
import { restoreNewestCopy } from '../storage/sync';
import { MemoryBanner, NewerSaveDialog, SaveIndicator } from '../features/save/SaveStatus';
import { RoadScreen } from '../features/club/RoadScreen';

// Developer tooling is code-split so it never ships in the main bundle.
const CardLab = lazy(() => import('../features/dev/CardLab').then((m) => ({ default: m.CardLab })));

type Boot = { status: 'opening' } | { status: 'ok' } | { status: 'failed'; message: string };

export function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'opening' });

  useEffect(() => {
    // Open storage (or the in-memory stand-in), then bring back the newest saved copy of the
    // club: IndexedDB, the local mirror, or the claude.ai cloud copy.
    openStorage()
      .catch(async (err: unknown) => {
        try {
          await switchToMemoryDb();
        } catch {
          throw err;
        }
      })
      .then(() => restoreNewestCopy().catch(() => 'none'))
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
  if (boot.status === 'opening')
    return (
      <div className="app-bg">
        <p className="boot__loading" role="status">
          Loading your club…
        </p>
      </div>
    );

  return (
    <ToastProvider>
      <GameProvider>
        <div className="app-bg">
          <div className="shell">
            <MemoryBanner />
            <Screens />
            <SaveIndicator />
            <NewerSaveDialog />
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

  // The guided first run: the opening story and the first pack can't be wandered past by a
  // deep link or a reload (Skip is always on screen). Settings stay reachable.
  const save = saveState.status === 'ready' ? saveState.save : null;
  if (save && route.name !== 'more' && route.name !== 'lab') {
    if (save.onboarding === 'intro' && route.name !== 'intro') return <IntroScreen replay={false} />;
    if (save.onboarding === 'pack') {
      const first = save.packs.find((p) => p.kind === 'first-signing');
      if (first && !(route.name === 'pack' && route.id === first.id)) return <PackScreen key={first.id} id={first.id} />;
    }
  }
  const bare = route.name === 'live' || route.name === 'replay' || route.name === 'intro' || route.name === 'pack' || save?.onboarding === 'intro' || save?.onboarding === 'pack';

  return (
    <>
      {route.name === 'club' && <ClubScreen />}
      {route.name === 'squad' && <SquadScreen />}
      {route.name === 'player' && <PlayerScreen key={route.id} id={route.id} />}
      {route.name === 'more' && <MoreScreen />}
      {route.name === 'match' && <MatchLobby />}
      {route.name === 'lineup' && <LineupScreen />}
      {route.name === 'live' && <LiveMatch />}
      {route.name === 'result' && <ResultScreen key={route.id} id={route.id} />}
      {route.name === 'replay' && <ReplayScreen key={`${route.id}-${route.goal}`} id={route.id} goal={route.goal} />}
      {route.name === 'intro' && <IntroScreen replay={route.replay} />}
      {route.name === 'scout' && <ScoutScreen />}
      {route.name === 'pack' && <PackScreen key={route.id} id={route.id} />}
      {route.name === 'setup' && <ClubSetup />}
      {route.name === 'cards' && <DeckScreen />}
      {route.name === 'league' && <LeagueScreen />}
      {route.name === 'season' && <SeasonScreen />}
      {route.name === 'event' && <EventScreen id={route.id} />}
      {route.name === 'market' && <MarketScreen />}
      {route.name === 'road' && <RoadScreen />}
      {route.name === 'lab' && (
        <Suspense fallback={null}>
          <CardLab />
        </Suspense>
      )}
      {(hasSave || route.name === 'more') && !bare && <BottomNav current={route} />}
    </>
  );
}
