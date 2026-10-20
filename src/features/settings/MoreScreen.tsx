import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useGame } from '../../app/GameContext';
import { DEV_TOOLS_ENABLED, navigate } from '../../app/router';
import { Icon, type IconName } from '../../components/icons/Icon';
import { Button, Switch } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import type { ClubSave } from '../../domain/save/types';
import { playSfx } from '../../audio/sfx';
import './more.css';

function Row({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="more__row">
      <span className="more__row-icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="more__row-text">
        <span className="more__row-title">{title}</span>
        {hint && <span className="more__row-hint">{hint}</span>}
      </div>
      <div className="more__row-control">{children}</div>
    </div>
  );
}

export function MoreScreen() {
  const { settings, updateSettings, exportSave, readImportFile, confirmImport, resetCareer, saveState } = useGame();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ClubSave | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const save = saveState.status === 'ready' ? saveState.save : null;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPendingImport(await readImportFile(file));
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'That file could not be imported.', 'error');
    }
  };

  const lastExport = settings.lastExportAt ? new Date(settings.lastExportAt).toLocaleDateString() : null;

  return (
    <main className="screen more">
      <header className="screen-head">
        <h1>
          <small>Settings &amp; save</small>
          More
        </h1>
      </header>

      <section className="more__section panel" aria-labelledby="sec-sound">
        <h2 id="sec-sound" className="eyebrow">
          Sound
        </h2>
        <Row icon="sound" title="Sound effects" hint="Taps, flips and rewards. Plays only after you touch the screen.">
          <Switch checked={settings.sfx} label="Sound effects" onChange={(v) => void updateSettings({ sfx: v })} />
        </Row>
        <label className="more__slider">
          <span>Effects volume</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.sfxVolume * 100)}
            disabled={!settings.sfx}
            onChange={(e) => void updateSettings({ sfxVolume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSfx('pop')}
          />
          <output>{Math.round(settings.sfxVolume * 100)}</output>
        </label>
      </section>

      <section className="more__section panel" aria-labelledby="sec-display">
        <h2 id="sec-display" className="eyebrow">
          Display &amp; comfort
        </h2>
        <div className="more__stacked">
          <span className="more__row-title">
            <Icon name="motion" size={18} /> Motion
          </span>
          <div className="segmented" role="group" aria-label="Motion">
            {(['system', 'reduced', 'full'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={settings.motion === m}
                onClick={() => {
                  playSfx('tap');
                  void updateSettings({ motion: m });
                }}
              >
                {m === 'system' ? 'Device' : m}
              </button>
            ))}
          </div>
          <span className="more__row-hint">Reduced turns off card tilt, shine and big screen movement.</span>
        </div>
        <Row icon="contrast" title="High contrast" hint="Stronger text and outlines.">
          <Switch checked={settings.contrast === 'high'} label="High contrast" onChange={(v) => void updateSettings({ contrast: v ? 'high' : 'normal' })} />
        </Row>
        <Row icon="text" title="Larger text">
          <Switch checked={settings.fontSize === 'large'} label="Larger text" onChange={(v) => void updateSettings({ fontSize: v ? 'large' : 'normal' })} />
        </Row>
      </section>

      <section className="more__section panel" aria-labelledby="sec-save">
        <h2 id="sec-save" className="eyebrow">
          Your save
        </h2>
        <p className="more__note">
          <Icon name="info" size={18} />
          <span>
            Your career lives in this browser only. Clearing site data or private browsing can erase it — export a copy now and then.
            {lastExport ? ` Last export: ${lastExport}.` : ' You haven’t exported yet.'}
          </span>
        </p>
        <div className="more__buttons">
          <Button
            variant="blue"
            icon="download"
            disabled={!save}
            onClick={async () => {
              try {
                await exportSave();
                toast.show('Save exported — keep the file somewhere safe');
              } catch (err) {
                toast.show(err instanceof Error ? err.message : 'Export failed', 'error');
              }
            }}
          >
            Export
          </Button>
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="import-input" />
        </div>
        <Button variant="ghost" icon="trash" block disabled={!save} onClick={() => setResetStep(1)} className="more__reset">
          Reset career
        </Button>
      </section>

      <section className="more__section panel more__about" aria-labelledby="sec-about">
        <h2 id="sec-about" className="eyebrow">
          About
        </h2>
        <p>
          <b>TOUCHLINE!</b> — the club is yours. Version {import.meta.env.VITE_APP_VERSION ?? '0.1.0'} (M0 foundation).
        </p>
        <p>All clubs, players and badges are fictional and generated on your device. Nothing you do leaves this device.</p>
        <p>Typefaces: Barlow &amp; Barlow Condensed by Jeremy Tribby (SIL Open Font License 1.1). Sounds are synthesised in-game.</p>
        {DEV_TOOLS_ENABLED && (
          <Button variant="ghost" icon="bug" size="sm" onClick={() => navigate({ name: 'lab' })}>
            Developer card lab
          </Button>
        )}
      </section>

      <Dialog
        open={pendingImport !== null}
        title="Load this save?"
        onClose={() => setPendingImport(null)}
        actions={
          <>
            <Button
              variant="primary"
              block
              sfx="chime"
              onClick={async () => {
                if (!pendingImport) return;
                await confirmImport(pendingImport);
                setPendingImport(null);
                toast.show(`Welcome back to ${pendingImport.club.name}`);
                navigate({ name: 'club' });
              }}
            >
              Load {pendingImport?.club.name}
            </Button>
            <Button variant="ghost" block onClick={() => setPendingImport(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p>
          <b>{pendingImport?.club.name}</b> · {pendingImport?.squadIds.length} players · season {pendingImport?.season}.
        </p>
        {save && <p>This replaces {save.club.name} on this device. A backup of the current career is kept automatically.</p>}
      </Dialog>

      <Dialog
        open={resetStep === 1}
        title="Reset your career?"
        onClose={() => setResetStep(0)}
        actions={
          <>
            <Button variant="danger" block onClick={() => setResetStep(2)}>
              Continue
            </Button>
            <Button variant="ghost" block onClick={() => setResetStep(0)}>
              Keep playing
            </Button>
          </>
        }
      >
        <p>Every player, result and story at {save?.club.name} will be removed from this device.</p>
      </Dialog>

      <Dialog
        open={resetStep === 2}
        title="Are you completely sure?"
        onClose={() => setResetStep(0)}
        actions={
          <>
            <Button
              variant="danger"
              block
              onClick={async () => {
                await resetCareer();
                setResetStep(0);
                navigate({ name: 'title' });
              }}
            >
              Yes, reset {save?.club.name}
            </Button>
            <Button variant="ghost" block onClick={() => setResetStep(0)}>
              No, keep my club
            </Button>
          </>
        }
      >
        <p>One local backup is kept, but it can be lost if browser data is cleared. Export first if you might want this club back.</p>
      </Dialog>
    </main>
  );
}
