import { useState } from 'react';
import { useGame } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { StadiumScene } from '../../components/club/StadiumScene';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import { DEFAULT_CLUB } from '../../domain/club/types';
import './title.css';

export function TitleScreen() {
  const { saveState, startCareer } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const save = saveState.status === 'ready' ? saveState.save : null;

  const begin = async () => {
    setConfirmNew(false);
    setBusy(true);
    try {
      await startCareer();
      navigate({ name: 'intro', replay: false });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not start a career.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="title">
      <div className="title__scene">
        <StadiumScene club={save?.club ?? DEFAULT_CLUB} variant="title" />
      </div>
      <div className="title__logo" aria-label="TOUCHLINE! — The club is yours">
        <p className="title__eyebrow">Arcade football management</p>
        <h1 className="title__word" aria-hidden="true">
          TOUCH<span>LINE</span>
          <em>!</em>
        </h1>
        <p className="title__tagline" aria-hidden="true">
          The club is yours.
        </p>
      </div>
      <div className="title__actions">
        {save ? (
          <>
            <Button variant="primary" size="lg" block onClick={() => navigate({ name: 'club' })} sfx="chime">
              Continue · {save.club.name}
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmNew(true)} disabled={busy}>
              Start a new club
            </Button>
          </>
        ) : (
          <Button variant="primary" size="lg" block onClick={begin} disabled={busy || saveState.status === 'loading'} sfx="chime">
            {busy ? 'Opening the gates…' : 'Start your club'}
          </Button>
        )}
        <p className="title__note">Saved on this device · plays offline · no account needed</p>
      </div>

      <Dialog
        open={confirmNew}
        title="Start a new club?"
        onClose={() => setConfirmNew(false)}
        actions={
          <>
            <Button variant="danger" block onClick={begin}>
              Yes, start fresh
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmNew(false)}>
              Keep {save?.club.name ?? 'my club'}
            </Button>
          </>
        }
      >
        <p>
          Your current career will be replaced. A backup is kept on this device, and you can export your save from <b>More</b> first if you want a copy.
        </p>
      </Dialog>
    </main>
  );
}
