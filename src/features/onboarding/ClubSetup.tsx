import { useId, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { Crest } from '../../components/club/Crest';
import { Portrait } from '../../components/portrait/Portrait';
import { Button, IconButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { CLUB_NAME_MAX, clubNameProblem, KIT_PRESETS, shortNameFor } from '../../domain/club/onboarding';
import { KIT_PATTERNS, type KitPattern } from '../../domain/club/types';
import './setup.css';

const PATTERN_LABEL: Record<KitPattern, string> = { plain: 'Plain', stripes: 'Stripes', hoops: 'Hoops', sash: 'Sash', halves: 'Halves' };

/**
 * "The club belongs to you": name, colours and pattern with a live crest and shirt preview.
 * Skipping keeps the current identity (a perfectly good default).
 */
export function ClubSetup() {
  const save = useSave();
  const { setClubIdentity, onboarding } = useGame();
  const toast = useToast();
  const inputId = useId();
  const firstRun = save.onboarding === 'club';
  const [name, setName] = useState(save.club.name);
  const [presetId, setPresetId] = useState(() => KIT_PRESETS.find((p) => p.primary.toLowerCase() === save.club.kit.primary.toLowerCase())?.id ?? 'brick');
  const [pattern, setPattern] = useState<KitPattern>(save.club.kit.pattern);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const preset = KIT_PRESETS.find((p) => p.id === presetId) ?? KIT_PRESETS[0]!;
  const problem = clubNameProblem(name);
  const kit = { ...save.club.kit, primary: preset.primary, secondary: preset.secondary, pattern };
  const preview = { ...save.club, name: name.trim() || save.club.name, shortName: problem ? save.club.shortName : shortNameFor(name), kit };
  const anchor = save.footballers[save.anchorPlayerId];

  const done = () => navigate({ name: 'club' });
  const confirm = async () => {
    setTouched(true);
    if (problem) {
      playSfx('thud');
      return;
    }
    setBusy(true);
    try {
      await setClubIdentity({ name, presetId, pattern });
      playSfx('cheer');
      toast.show(`Welcome to ${name.trim().replace(/\s+/g, ' ')}`);
      done();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not save the club.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen setup">
      <header className="screen-head">
        {!firstRun && <IconButton icon="back" label="Back" onClick={() => goBack({ name: 'more' })} sfx="thud" />}
        <h1>
          <small>{firstRun ? 'Last step' : 'Club identity'}</small>
          Make it yours
        </h1>
      </header>

      <section className="setup__preview" aria-label="Preview" style={{ '--kit-a': kit.primary, '--kit-b': kit.secondary } as CSSProperties}>
        <div className="setup__crest">
          <Crest club={preview} size={104} />
        </div>
        {anchor && (
          <div className="setup__shirt">
            <Portrait appearance={anchor.appearance} kit={kit} />
          </div>
        )}
        <p className="setup__name">{preview.name}</p>
        <p className="setup__code">{preview.shortName}</p>
      </section>

      <form
        className="setup__form paper"
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <label className="setup__label" htmlFor={inputId}>
          Club name
        </label>
        <input
          id={inputId}
          className="setup__input"
          value={name}
          maxLength={CLUB_NAME_MAX + 4}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && problem ? true : undefined}
          aria-describedby={`${inputId}-help`}
        />
        <p id={`${inputId}-help`} className={`setup__help ${touched && problem ? 'is-error' : ''}`} role={touched && problem ? 'alert' : undefined}>
          {touched && problem ? problem : `Up to ${CLUB_NAME_MAX} characters. Scoreboard code: ${preview.shortName}.`}
        </p>

        <fieldset className="setup__fieldset">
          <legend className="setup__label">Colours</legend>
          <div className="setup__swatches">
            {KIT_PRESETS.map((p) => (
              <label key={p.id} className={`setup__swatch ${p.id === presetId ? 'is-on' : ''}`} title={p.label}>
                <input
                  type="radio"
                  name="kit"
                  value={p.id}
                  checked={p.id === presetId}
                  onChange={() => {
                    playSfx('pop');
                    setPresetId(p.id);
                  }}
                />
                <span className="setup__swatch-chip" style={{ background: `linear-gradient(135deg, ${p.primary} 0 55%, ${p.secondary} 55%)` }} aria-hidden="true" />
                <span className="visually-hidden">{p.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="setup__fieldset">
          <legend className="setup__label">Shirt pattern</legend>
          <div className="segmented setup__patterns">
            {KIT_PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === pattern}
                onClick={() => {
                  playSfx('tap');
                  setPattern(p);
                }}
              >
                {PATTERN_LABEL[p]}
              </button>
            ))}
          </div>
        </fieldset>

        <Button type="submit" variant="primary" size="lg" block disabled={busy} sfx={null}>
          That’s us
        </Button>
        <Button
          variant="ghost"
          block
          disabled={busy}
          onClick={async () => {
            if (firstRun) await onboarding('clubNamed');
            done();
          }}
        >
          {firstRun ? `Keep ${save.club.name}` : 'Cancel'}
        </Button>
      </form>
    </main>
  );
}
