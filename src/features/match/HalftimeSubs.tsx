import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { Button } from '../../components/ui/Button';
import type { MatchController } from '../../game/renderer/controller';
import type { LineupPlayer, MatchCommand, MatchSnapshot } from '../../game/simulation/types';
import './subs.css';

/** Legs below this at half-time get the Tired tag (about the side's least fresh third). */
const TIRED = 0.78;

/**
 * Half-time changes, without dragging: tap who comes off, tap who comes on, confirm. Legs are
 * shown from the engine's own stamina, so "tired" means the same thing the simulation uses.
 */
export function HalftimeSubs({ controller, snap, starters, onMade }: { controller: MatchController; snap: MatchSnapshot; starters: readonly LineupPlayer[]; onMade: (c: MatchCommand) => void }) {
  const side = controller.userSide;
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const [, bump] = useState(0);
  const { available, changesLeft } = controller.engine.benchFor(side);
  const queued = controller.engine.queuedSubs(side);
  const leaving = new Set(queued.map((c) => c.outId));
  const onPitch = snap.players.filter((p) => p.side === side);
  const roleOf = (id: string) => starters.find((p) => p.id === id)?.role;
  if (available.length === 0 && queued.length === 0) return null;
  const outRole = outId ? roleOf(outId) : undefined;
  const incoming = available.find((p) => p.id === inId);

  const confirm = () => {
    if (!outId || !inId) return;
    const r = controller.dispatchSub(outId, inId);
    if (!r.ok) {
      playSfx('thud');
      return;
    }
    playSfx('pop');
    onMade(r.command);
    setOutId(null);
    setInId(null);
    bump((n) => n + 1);
  };

  return (
    <section className="subs" aria-labelledby="subs-title">
      <div className="subs__head">
        <h3 id="subs-title" className="subs__title">
          Make a change
        </h3>
        <span className="subs__left">{changesLeft} left</span>
      </div>
      {queued.length > 0 && (
        <ul className="subs__queued" aria-label="Changes for the second half">
          {queued.map((c) => (
            <li key={`${c.outId}-${c.inId}`}>
              <b>{controller.nameOf(c.inId ?? '')}</b> on for {controller.nameOf(c.outId ?? '')}
            </li>
          ))}
        </ul>
      )}
      {changesLeft > 0 && (
        <>
          <p className="subs__step">1. Who comes off?</p>
          <ul className="subs__list" role="listbox" aria-label="Players on the pitch">
            {onPitch
              .filter((p) => !leaving.has(p.id))
              .map((p) => {
                const tired = p.stamina < TIRED;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={outId === p.id}
                      className={`subs__row ${outId === p.id ? 'is-picked' : ''} ${tired ? 'is-tired' : ''}`}
                      onClick={() => {
                        playSfx('tap');
                        setOutId(p.id);
                      }}
                    >
                      <small>{roleOf(p.id)}</small>
                      <span className="subs__name">{controller.nameOf(p.id)}</span>
                      <span className="subs__legs" aria-label={`Legs ${Math.round(p.stamina * 100)}%`}>
                        <span style={{ width: `${Math.round(p.stamina * 100)}%` }} />
                      </span>
                      {tired && <em>Tired</em>}
                    </button>
                  </li>
                );
              })}
          </ul>
          <p className="subs__step">2. Who comes on?</p>
          <ul className="subs__list" role="listbox" aria-label="Substitutes">
            {available.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={inId === p.id}
                  className={`subs__row ${inId === p.id ? 'is-picked' : ''}`}
                  onClick={() => {
                    playSfx('tap');
                    setInId(p.id);
                  }}
                >
                  <small>{p.naturalPosition}</small>
                  <span className="subs__name">{p.shortName}</span>
                  <span className="subs__ovr">{p.rating}</span>
                  <em className="is-fresh">Fresh</em>
                </button>
              </li>
            ))}
          </ul>
          {outRole && incoming && incoming.naturalPosition !== outRole && (
            <p className="subs__warn">
              {incoming.shortName} is a {incoming.naturalPosition} and would play {outRole}, out of position.
            </p>
          )}
          <Button variant="blue" block disabled={!outId || !inId} onClick={confirm} sfx={null}>
            {outId && inId ? `Bring on ${controller.nameOf(inId)} for ${controller.nameOf(outId)}` : 'Pick one of each'}
          </Button>
        </>
      )}
    </section>
  );
}
