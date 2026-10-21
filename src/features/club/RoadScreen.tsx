import { useState } from 'react';
import { isReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { TierEmblem } from '../../components/icons/Icon';
import { Button, IconButton } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import { useToast } from '../../components/ui/Toast';
import { REP_TIERS, repTier } from '../../domain/club/reputation';
import { ROAD, roadState, type RoadStep } from '../../domain/club/road';
import { PACK_DEFS } from '../../domain/packs/packs';
import './road.css';

/**
 * The Reputation Road: every reward on the way from Local to Famous, in one climb. Reached
 * steps glow and open with one tap; the next one shows exactly how far away it is.
 */
export function RoadScreen() {
  const save = useSave();
  const { claimRoad } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState<{ at: number; text: string; packId: string | null } | null>(null);
  const rep = save.club.reputation;

  const claim = async (step: RoadStep) => {
    setBusy(true);
    try {
      const r = await claimRoad(step.at);
      if (r.applied) {
        playSfx(r.packId ? 'reveal' : 'coin');
        setBurst({ at: step.at, text: r.packId ? `${PACK_DEFS[step.reward.kind === 'pack' ? step.reward.pack : 'local-scout'].name} pack!` : `+${r.coins} coins`, packId: r.packId });
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not claim that.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen road">
      <header className="screen-head">
        <IconButton icon="back" label="Back to the club" onClick={() => goBack({ name: 'club' })} sfx="thud" />
        <h1>
          <small>{repTier(rep).label} club · reputation {rep}</small>
          Reputation Road
        </h1>
      </header>
      <ol className="road__path" aria-label="Rewards along the road">
        {[...ROAD].reverse().map((step) => {
          const state = roadState(save, step);
          const tier = REP_TIERS.find((t) => t.from === step.at);
          return (
            <li key={step.at} className={`road__step is-${state}`}>
              <span className="road__at">{step.at}</span>
              <span className="road__node" aria-hidden="true">
                {step.reward.kind === 'pack' ? <TierEmblem tier={step.reward.pack === 'gold-scout' ? 'star' : 'prospect'} size={22} /> : <span className="club__coin" />}
              </span>
              <span className="road__what">
                {tier && <small className="road__tier">{tier.label}</small>}
                <b>{step.reward.kind === 'coins' ? `${step.reward.coins} coins` : `${PACK_DEFS[step.reward.pack].name} pack`}</b>
                <small>{state === 'claimed' ? 'Claimed' : state === 'ready' ? 'Reached!' : `${step.at - rep} reputation to go`}</small>
              </span>
              {state === 'ready' && (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void claim(step)}>
                  Open
                </Button>
              )}
              {burst?.at === step.at && (
                <span className="road__burst" role="status">
                  {!isReducedMotion() && <Confetti count={18} colours={['#F4C653', '#CBF238', '#FFF7E9']} />}
                  {burst.text}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {burst?.packId && (
        <Button variant="primary" size="lg" block icon="pack" onClick={() => navigate({ name: 'pack', id: burst.packId! })}>
          Open the pack
        </Button>
      )}
      <p className="road__note">Reputation comes from wins, cup runs, promotion and titles, and from how you treat people in the dressing room.</p>
    </main>
  );
}
