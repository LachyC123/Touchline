import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { isMemoryOnly } from '../../storage/db';
import { acceptNewerCloud, dismissNewerCloud, useSyncStatus } from '../../storage/sync';
import './save.css';

/** A small "Saved" pulse after every save, so the player can see progress being kept. */
export function SaveIndicator() {
  const { pulse, cloud } = useSyncStatus();
  if (pulse === 0) return null;
  return <SavePulse key={pulse} text={cloud === 'on' ? '✓ Saved · backed up' : '✓ Saved'} />;
}

function SavePulse({ text }: { text: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(false), 1600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <p className={`save-pill ${on ? 'is-on' : ''}`} role="status" aria-live="polite">
      {on ? text : ''}
    </p>
  );
}

/** Only when the browser blocks its own storage: says what still keeps the club. */
export function MemoryBanner() {
  const { mirror, cloud } = useSyncStatus();
  if (!isMemoryOnly()) return null;
  const kept = cloud === 'on' ? 'your club is backed up to your Claude account' : mirror ? 'a backup copy is kept on this page' : 'progress lasts only until you close the page — export your save from More';
  return (
    <p className="memory-banner" role="status">
      This browser is blocking its main save storage, so {kept}.
    </p>
  );
}

/** A newer save from another device turned up after start-up: offer it, never swap silently. */
export function NewerSaveDialog() {
  const { newerInCloud } = useSyncStatus();
  const [busy, setBusy] = useState(false);
  if (!newerInCloud) return null;
  return (
    <div className="newer-save" role="dialog" aria-modal="true" aria-labelledby="newer-save-title">
      <div className="newer-save__panel paper">
        <p id="newer-save-title" className="display">
          A newer save
        </p>
        <p>
          <b>{newerInCloud.club.name}</b>, season {newerInCloud.season}, after match {newerInCloud.matchNumber}, was saved more recently on another device.
        </p>
        <Button
          variant="primary"
          block
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await acceptNewerCloud();
            setBusy(false);
          }}
        >
          Load the newer save
        </Button>
        <Button variant="ghost" block onClick={dismissNewerCloud}>
          Keep this one
        </Button>
      </div>
    </div>
  );
}
