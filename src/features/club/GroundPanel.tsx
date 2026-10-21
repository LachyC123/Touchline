import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { attendance, gateMoney, groundBlocker, groundOf, nextGround, nextRepTier, repTier } from '../../domain/club/reputation';

/** Reputation and the ground: how big the club's name is, how full the ground gets, what's next. */
export function GroundPanel() {
  const save = useSave();
  const { upgradeGround } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const rep = save.club.reputation;
  const tier = repTier(rep);
  const next = nextRepTier(rep);
  const ground = groundOf(save.club.stadiumLevel);
  const upgrade = nextGround(save.club.stadiumLevel);
  const blocker = groundBlocker(save);
  const fans = attendance(save, false);
  const span = next ? next.from - tier.from : 1;
  const into = next ? rep - tier.from : 1;

  const buy = async () => {
    setBusy(true);
    try {
      await upgradeGround();
      playSfx('cheer');
      toast.show(`${upgrade?.name ?? 'Ground upgraded'}! Capacity ${upgrade?.capacity.toLocaleString('en-GB')}.`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not upgrade the ground.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ground panel" aria-label="Reputation and ground">
      <div className="ground__rep">
        <div className="ground__row">
          <span className="eyebrow">Reputation</span>
          <b className="ground__tier">{tier.label}</b>
        </div>
        <div className="ground__bar" role="meter" aria-valuemin={tier.from} aria-valuemax={next?.from ?? rep} aria-valuenow={rep} aria-label="Reputation">
          <span style={{ width: `${Math.min(100, (into / span) * 100)}%` }} />
        </div>
        <p className="ground__note">
          {tier.blurb} {next ? `${next.from - rep} more for ${next.label}.` : 'As big as it gets.'} Better reputation, better scouting odds.
        </p>
      </div>
      <div className="ground__ground">
        <div className="ground__row">
          <span className="eyebrow">Ground · level {ground.level}</span>
          <b>{ground.capacity.toLocaleString('en-GB')} capacity</b>
        </div>
        <p className="ground__note">
          About {fans.toLocaleString('en-GB')} fans for a home game (+{gateMoney(fans)} coins at the gate). Big games draw more.
        </p>
        {upgrade && (
          <Button variant={blocker ? 'ghost' : 'primary'} block icon="star" disabled={busy || Boolean(blocker)} onClick={() => void buy()}>
            {`${upgrade.name}: ${upgrade.cost} coins`}
          </Button>
        )}
        {upgrade && <p className="ground__note">{blocker ?? `${upgrade.change} Capacity ${upgrade.capacity.toLocaleString('en-GB')}.`}</p>}
      </div>
    </section>
  );
}
