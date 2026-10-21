import { useState } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { useCountUp } from '../../components/ui/useCountUp';
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
export function UpgradePicker({ upgrade, player, kit, onDone }: { upgrade: PendingUpgrade; player: Footballer; kit: Kit; onDone?: () => void }) {
  const { chooseUpgrade } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; before: number; after: number; rows: { key: AttributeKey; label: string; before: number; after: number }[] } | null>(null);
  const reduced = useReducedMotion();

  const pick = async (focusId: string) => {
    setBusy(true);
    const before = overall(player);
    const preview = structuredClone(player);
    for (const [k, v] of Object.entries(focusDeltas(player, focusId)) as [AttributeKey, number][]) preview.attributes[k] += v;
    try {
      await chooseUpgrade(player.id, upgrade.level, focusId);
      playSfx('chime');
      const rows = (Object.entries(focusDeltas(player, focusId)) as [AttributeKey, number][]).map(([k, v]) => ({ key: k, label: ATTRIBUTE_INFO[k].label, before: player.attributes[k], after: player.attributes[k] + v }));
      setDone({ name: FOCUSES[focusId]?.name ?? focusId, before, after: overall(preview), rows });
      onDone?.();
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
        <div className="upgrade__result" role="status">
          <ul className="upgrade__deltas">
            {done.rows.map((r, i) => (
              <li key={r.key}>
                <span>{r.label}</span>
                <span>
                  {r.before} → <Rising from={r.before} to={r.after} delay={i * 160} animate={!reduced} />
                </span>
              </li>
            ))}
          </ul>
          <p className="upgrade__done">
            OVR <b>{done.before}</b> → <Rising from={done.before} to={done.after} delay={done.rows.length * 160 + 120} animate={!reduced} big />
          </p>
        </div>
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

/** A number that counts up from `from` to `to` with one sparkle when it lands. */
function Rising({ from, to, delay, animate, big = false }: { from: number; to: number; delay: number; animate: boolean; big?: boolean }) {
  const gain = useCountUp(to - from, 450, animate, { delayMs: delay, tickEvery: 1, sfx: 'coin' });
  const up = to > from;
  return (
    <b className={`upgrade__rise ${up ? 'is-up' : ''} ${big ? 'is-big' : ''}`} style={animate ? { animationDelay: `${delay + 450}ms` } : undefined}>
      {from + gain}
    </b>
  );
}
