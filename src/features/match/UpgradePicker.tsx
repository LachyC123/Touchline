import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame } from '../../app/GameContext';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import type { Kit } from '../../domain/club/types';
import { ATTRIBUTE_INFO, overall } from '../../domain/players/rating';
import type { AttributeKey, Footballer } from '../../domain/players/types';
import { FOCUSES, focusDeltas } from '../../domain/players/upgrades';
import type { PendingUpgrade } from '../../domain/save/types';
import './upgrade.css';

/**
 * One meaningful choice per level: two training focuses with an exact preview of what
 * changes. Applied atomically once (idempotency key = player + level).
 */
export function UpgradePicker({ upgrade, player, kit }: { upgrade: PendingUpgrade; player: Footballer; kit: Kit }) {
  const { chooseUpgrade } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; before: number; after: number } | null>(null);

  const pick = async (focusId: string) => {
    setBusy(true);
    const before = overall(player);
    const preview = structuredClone(player);
    for (const [k, v] of Object.entries(focusDeltas(player, focusId)) as [AttributeKey, number][]) preview.attributes[k] += v;
    try {
      await chooseUpgrade(player.id, upgrade.level, focusId);
      playSfx('chime');
      setDone({ name: FOCUSES[focusId]?.name ?? focusId, before, after: overall(preview) });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not apply that upgrade.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="upgrade paper" aria-label={`${player.lastName} reached level ${upgrade.level}`}>
      <div className="upgrade__head">
        <div className="upgrade__card">
          <FootballerCard player={player} kit={kit} variant="mini" />
        </div>
        <div>
          <p className="upgrade__kicker">Level up · LV {upgrade.level}</p>
          <h3>
            {player.firstName} {player.lastName}
          </h3>
          <p className="upgrade__sub">{done ? `${done.name} training locked in.` : 'Choose his training focus:'}</p>
        </div>
      </div>
      {done ? (
        <p className="upgrade__done" role="status">
          OVR <b>{done.before}</b> → <b className={done.after > done.before ? 'is-up' : ''}>{done.after}</b>
        </p>
      ) : (
        <div className="upgrade__options">
          {upgrade.options.map((id) => {
            const f = FOCUSES[id];
            if (!f) return null;
            const deltas = focusDeltas(player, id);
            return (
              <div key={id} className="upgrade__option">
                <p className="upgrade__name">{f.name}</p>
                <p className="upgrade__blurb">{f.blurb}</p>
                <ul>
                  {(Object.entries(deltas) as [AttributeKey, number][]).map(([k, v]) => (
                    <li key={k}>
                      <span>{ATTRIBUTE_INFO[k].label}</span>
                      <span>
                        {player.attributes[k]} → <b>{player.attributes[k] + v}</b>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button variant="blue" size="sm" block disabled={busy} onClick={() => pick(id)} sfx={null}>
                  Train {f.name}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
