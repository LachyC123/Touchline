import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { Button } from '../../components/ui/Button';
import type { ShootoutResult } from '../../domain/cup/shootout';
import type { TeamSide } from '../../game/simulation/types';
import './shootout.css';

const STEP_MS = 1100;

/**
 * The recorded shootout, kick by kick: a running score and a row of spots per side. Revealed
 * one kick at a time on the first viewing (skippable); shown complete afterwards.
 */
export function ShootoutReveal({ shootout, us, names, animate }: { shootout: ShootoutResult; us: TeamSide; names: Record<TeamSide, string>; animate: boolean }) {
  const total = shootout.kicks.length;
  const [shown, setShown] = useState(animate ? 0 : total);
  useEffect(() => {
    if (shown >= total) return;
    const t = window.setTimeout(() => {
      const k = shootout.kicks[shown];
      if (k) playSfx(k.scored ? (k.side === us ? 'goal' : 'thud') : k.side === us ? 'ooh' : 'save');
      setShown((n) => n + 1);
    }, shown === 0 ? 500 : STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown, total, shootout, us]);

  const visible = shootout.kicks.slice(0, shown);
  const score = (side: TeamSide) => visible.filter((k) => k.side === side && k.scored).length;
  const done = shown >= total;
  const last = visible.at(-1);
  const rows = (['home', 'away'] as const).map((side) => ({ side, kicks: shootout.kicks.filter((k) => k.side === side) }));
  const won = shootout.winner === us;

  return (
    <section className={`shootout panel ${done ? (won ? 'is-won' : 'is-lost') : ''}`} aria-labelledby="shootout-title">
      <div className="shootout__head">
        <h2 id="shootout-title" className="eyebrow">
          Penalties
        </h2>
        <p className="shootout__score" aria-live="polite">
          {score('home')}–{score('away')}
        </p>
      </div>
      {rows.map((r) => {
        let n = 0;
        return (
          <div key={r.side} className={`shootout__row ${r.side === us ? 'is-ours' : ''}`}>
            <span className="shootout__team">{names[r.side]}</span>
            <ol className="shootout__spots">
              {r.kicks.map((k) => {
                const index = shootout.kicks.indexOf(k);
                const state = index < shown ? (k.scored ? 'scored' : 'missed') : 'pending';
                n++;
                return (
                  <li key={index} className={`shootout__spot is-${state}`} aria-label={state === 'pending' ? `Kick ${n} to come` : `Kick ${n}: ${k.takerName} ${k.scored ? 'scored' : 'missed'}`}>
                    {state === 'scored' ? '●' : state === 'missed' ? '✕' : ''}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
      <p className="shootout__caption" aria-live="polite">
        {done
          ? `${names[shootout.winner]} win ${Math.max(shootout.home, shootout.away)}–${Math.min(shootout.home, shootout.away)} on penalties.`
          : last
            ? last.scored
              ? `${last.takerName} scores.`
              : `${last.takerName} — saved by ${last.keeperName}!`
            : 'The players gather on the halfway line…'}
      </p>
      {!done && (
        <Button variant="ghost" size="sm" onClick={() => setShown(total)} sfx={null}>
          Show all kicks
        </Button>
      )}
    </section>
  );
}
