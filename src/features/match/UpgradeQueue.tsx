import { useState } from 'react';
import { useSave } from '../../app/GameContext';
import { playSfx } from '../../audio/sfx';
import { Button } from '../../components/ui/Button';
import type { Footballer } from '../../domain/players/types';
import type { PendingUpgrade } from '../../domain/save/types';
import { UpgradePicker } from './UpgradePicker';
import './upgrade.css';

const key = (u: PendingUpgrade) => `${u.playerId}-${u.level}`;

/**
 * A new signing's debut level-up first (that's his moment), then favourites, then the newest
 * signings, so the player you care about is never buried.
 */
function priority(p: Footballer | undefined, recruited: ReadonlySet<string>): number {
  if (!p) return -1;
  const signed = Math.max(0, ...p.history.filter((h) => h.kind === 'signed').map((h) => h.order));
  const debut = p.stats.matches <= 1 && recruited.has(p.id) ? 2_000_000 : 0;
  return debut + (p.favourite ? 1_000_000 : 0) + signed;
}

/**
 * Level-ups one at a time: the current choice in full, everyone else waiting as a row of names
 * you can jump to. The list is snapshotted on mount so a confirmed choice stays on screen.
 */
export function UpgradeQueue({ heading, children }: { heading?: string; children?: React.ReactNode }) {
  const save = useSave();
  const [queue] = useState(() => {
    const recruited = new Set(save.packs.flatMap((p) => (p.playerId ? [p.playerId] : [])));
    return [...save.pendingUpgrades].sort((a, b) => priority(save.footballers[b.playerId], recruited) - priority(save.footballers[a.playerId], recruited));
  });
  const stillPending = (u: PendingUpgrade) => save.pendingUpgrades.some((p) => key(p) === key(u));
  const [current, setCurrent] = useState(() => queue.find(stillPending) ?? null);
  const [chosen, setChosen] = useState(false);
  if (!current) return null;
  const waitingAll = queue.filter((u) => key(u) !== key(current) && stillPending(u));
  // One chip per player, at his lowest waiting level (levels are chosen in order).
  const waiting = waitingAll
    .filter((u) => u.playerId !== current.playerId || chosen)
    .filter((u, i, all) => all.findIndex((x) => x.playerId === u.playerId) === i)
    .map((u) => waitingAll.filter((x) => x.playerId === u.playerId).sort((a, b) => a.level - b.level)[0] as PendingUpgrade);
  const extra = (id: string) => waitingAll.filter((x) => x.playerId === id).length - 1;
  const player = save.footballers[current.playerId];
  if (!player) return null;

  const go = (u: PendingUpgrade) => {
    playSfx('flip');
    setChosen(false);
    setCurrent(u);
  };

  return (
    <section className="upgrade-queue" aria-label="Level-ups">
      {heading && <h2 className="eyebrow">{heading}</h2>}
      {children}
      <UpgradePicker key={key(current)} upgrade={current} player={player} kit={save.club.kit} onDone={() => setChosen(true)} />
      {waiting.length > 0 && (
        <div className="upgrade-queue__next">
          {chosen && (
            <Button variant="primary" size="sm" block icon="star" onClick={() => go(waiting[0] as PendingUpgrade)} sfx={null}>
              Next level-up: {save.footballers[(waiting[0] as PendingUpgrade).playerId]?.lastName ?? 'next player'}
            </Button>
          )}
          <p className="upgrade-queue__label">
            {waitingAll.length} more waiting{chosen ? '' : ' — tap a name to choose them first'}:
          </p>
          <ul className="upgrade-queue__names">
            {waiting.map((u) => {
              const p = save.footballers[u.playerId];
              return p ? (
                <li key={key(u)}>
                  <button type="button" className="upgrade-queue__chip" onClick={() => go(u)} aria-label={`Choose ${p.firstName} ${p.lastName}'s level ${u.level} training next`}>
                    {p.lastName} <small>LV {u.level}{extra(u.playerId) > 0 ? ` +${extra(u.playerId)}` : ''}</small>
                  </button>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
