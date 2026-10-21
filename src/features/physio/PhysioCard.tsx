import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { useToast } from '../../components/ui/Toast';
import { injuryKind, matchesOut, treatmentOptions } from '../../domain/players/injuries';
import type { Injury } from '../../domain/save/types';
import './physio.css';

/**
 * The physio's report for one injury: what happened (the minute, who caught him), how long he
 * is out, and — before the next match only — the call: rest, a specialist, or strap it up.
 */
export function PhysioCard({ injury }: { injury: Injury }) {
  const save = useSave();
  const { treatInjury } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const p = save.footballers[injury.playerId];
  if (!p) return null;
  const kind = injuryKind(injury.kind);
  const options = treatmentOptions(save, injury);
  const open = injury.treatment === null && save.matchNumber === injury.atMatch;
  const left = matchesOut(save, injury);

  const choose = async (id: (typeof options)[number]['id']) => {
    setBusy(true);
    try {
      const said = await treatInjury(injury.id, id);
      playSfx(id === 'rush' ? 'thud' : 'chime');
      toast.show(said);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'The physio could not do that.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`physio ${open ? 'is-open' : ''}`} aria-label={`${p.firstName} ${p.lastName}: ${kind.label}`}>
      <button type="button" className="physio__card" onClick={() => navigate({ name: 'player', id: p.id })} aria-label={`Open ${p.lastName}'s profile`}>
        <FootballerCard player={p} kit={save.club.kit} variant="mini" />
        <span className="physio__cross" aria-hidden="true">
          ✚
        </span>
      </button>
      <div className="physio__body">
        <p className="physio__title">
          <b>{p.lastName}</b> · {kind.label}
        </p>
        <p className="physio__how">
          {injury.minute}' after a challenge from {injury.byName}.{' '}
          {left > 0 ? `Out for ${left === 1 ? 'the next match' : `the next ${left} matches`}.` : 'Available for the next match.'}
          {injury.treatment === 'rush' && ' Strapped up: fragile for a few games.'}
          {injury.treatment === 'specialist' && ' Seen by the specialist.'}
        </p>
        {open && (
          <div className="physio__choices" role="group" aria-label="Physio's call">
            {options.map((o) => (
              <button key={o.id} type="button" className={`physio__choice is-${o.id}`} disabled={busy || Boolean(o.disabled)} onClick={() => void choose(o.id)}>
                <b>
                  {o.label}
                  {o.cost > 0 ? ` · ${o.cost}` : ''}
                </b>
                <small>{o.disabled ?? o.hint}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
