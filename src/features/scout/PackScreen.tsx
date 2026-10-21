import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useReducedMotion } from '../../accessibility/motion';
import { playReveal, playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { toCardModel } from '../../components/cards/cardModel';
import { Crest } from '../../components/club/Crest';
import { Icon, TierEmblem } from '../../components/icons/Icon';
import { Button, IconButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { Confetti } from '../../components/ui/Confetti';
import { useCountUp } from '../../components/ui/useCountUp';
import { TIER_DEFS } from '../../data/tiers';
import { bestSlotFor, PACK_DEFS } from '../../domain/packs/packs';
import { FORMATION_DEFS } from '../../domain/formations';
import type { Footballer, Tier } from '../../domain/players/types';
import type { OwnedPack } from '../../domain/save/types';
import './pack.css';

type Phase = 'sealed' | 'tearing' | 'emerging' | 'revealed';

/** Card-back hold before it turns: longer (and louder) for rarer tiers, always skippable. */
const REVEAL_HOLD_MS: Readonly<Record<Tier, number>> = { street: 450, prospect: 650, breakout: 900, star: 1150, phenomenon: 1400 };
const TEAR_COMMIT = 0.55;

export function PackScreen({ id }: { id: string }) {
  const save = useSave();
  const pack = save.packs.find((p) => p.id === id);
  if (!pack) {
    return (
      <main className="screen">
        <div className="paper pack__missing">
          <p className="display">That pack isn’t here</p>
          <Button variant="primary" onClick={() => navigate({ name: 'scout' })}>
            Scout room
          </Button>
        </div>
      </main>
    );
  }
  return <PackOpening key={pack.id} pack={pack} />;
}

function PackOpening({ pack }: { pack: OwnedPack }) {
  const save = useSave();
  const { openPack } = useGame();
  const toast = useToast();
  const reduced = useReducedMotion();
  // A pack that was already opened (reload, revisit) shows its signing straight away.
  const [phase, setPhase] = useState<Phase>(() => (pack.playerId ? 'revealed' : 'sealed'));
  const [fresh] = useState(() => pack.playerId === null);
  const [playerId, setPlayerId] = useState<string | null>(pack.playerId);
  const [tear, setTear] = useState(0);
  const dragRef = useRef<{ startX: number; width: number } | null>(null);
  const timers = useRef<number[]>([]);
  const def = PACK_DEFS[pack.kind];
  const tierDef = TIER_DEFS[pack.tier];

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, reduced ? Math.min(ms, 60) : ms));

  const commit = async () => {
    if (phase !== 'sealed') return;
    setPhase('tearing');
    setTear(1);
    playSfx('tear');
    try {
      // Persist first: the player is in the squad before the card is shown.
      const r = await openPack(pack.id);
      setPlayerId(r.playerId);
      later(420, () => {
        setPhase('emerging');
        playSfx('whoosh');
        later(REVEAL_HOLD_MS[pack.tier] + 450, () => reveal());
      });
    } catch (err) {
      setPhase('sealed');
      setTear(0);
      playSfx('thud');
      toast.show(err instanceof Error ? err.message : 'The pack would not open.', 'error');
    }
  };

  const reveal = () => {
    setPhase((p) => {
      if (p === 'revealed') return p;
      playReveal(pack.tier);
      return 'revealed';
    });
  };

  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (playerId) reveal();
  };

  // ---- tear gesture (one-tap button does the same) ---------------------------------
  const onStripDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== 'sealed') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, width: e.currentTarget.getBoundingClientRect().width };
  };
  const onStripMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || phase !== 'sealed') return;
    setTear(Math.max(0, Math.min(1, (e.clientX - d.startX) / (d.width * 0.8))));
  };
  const onStripUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (tear >= TEAR_COMMIT) void commit();
    else setTear(0);
  };

  const player = playerId ? save.footballers[playerId] : undefined;
  const animating = phase === 'tearing' || phase === 'emerging';

  return (
    <main className={`pack pack--${pack.tier} pack--${phase}`} style={{ '--tear': tear } as CSSProperties}>
      <header className="screen-head pack__head">
        {phase === 'sealed' && save.onboarding !== 'pack' ? (
          <IconButton icon="back" label="Back" onClick={() => goBack({ name: 'scout' })} sfx="thud" />
        ) : (
          <span className="pack__head-spacer" />
        )}
        <h1>
          <small>Scout’s desk</small>
          {def.name}
        </h1>
        {animating ? (
          <Button variant="ghost" size="sm" onClick={skip} disabled={!playerId}>
            Skip
          </Button>
        ) : save.onboarding === 'pack' && phase === 'sealed' ? (
          <SkipTutorial />
        ) : (
          <span className="pack__head-spacer" />
        )}
      </header>

      <section className="pack__desk" aria-live="polite">
        {phase !== 'revealed' && (
          <div className="pack__envelope" aria-label={`${def.name} pack, ${tierDef.label} edge. ${phase === 'sealed' ? 'Sealed.' : 'Opening.'}`}>
            <div className="pack__edge" aria-hidden="true">
              <TierEmblem tier={pack.tier} size={16} />
              <span>{tierDef.label}</span>
            </div>
            <div className="pack__paper">
              <div className="pack__tape">
                <Crest club={save.club} size={58} />
              </div>
              <p className="pack__stamp">{def.name}</p>
              <p className="pack__club">{save.club.name} · Scouting dept.</p>
            </div>
            <div
              className="pack__strip"
              role="presentation"
              onPointerDown={onStripDown}
              onPointerMove={onStripMove}
              onPointerUp={onStripUp}
              onPointerCancel={onStripUp}
            >
              <span className="pack__strip-torn" aria-hidden="true" />
              <span className="pack__strip-tab" aria-hidden="true">
                TEAR <Icon name="chevron" size={14} />
                <Icon name="chevron" size={14} />
              </span>
            </div>
            {phase === 'emerging' && player && (
              <div className="pack__card-back" aria-hidden="true">
                <div className="pack__card-back-face">
                  <TierEmblem tier={pack.tier} size={44} />
                  <span>{tierDef.label}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'revealed' && player && <Reveal player={player} fresh={fresh && !reduced} />}
      </section>

      <footer className="pack__actions">
        {phase === 'sealed' && (
          <>
            <Button variant="primary" size="lg" block onClick={() => void commit()} sfx={null}>
              Open pack
            </Button>
            <p className="pack__hint">Swipe the strip, or tap Open. Your signing is already decided and saved.</p>
          </>
        )}
        {phase === 'revealed' && player && <RevealActions player={player} pack={pack} />}
      </footer>
    </main>
  );
}

function SkipTutorial() {
  const { onboarding } = useGame();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await onboarding('skip');
        navigate({ name: 'club' });
      }}
      sfx="thud"
    >
      Skip tutorial
    </Button>
  );
}

function Reveal({ player, fresh }: { player: Footballer; fresh: boolean }) {
  const save = useSave();
  const m = toCardModel(player);
  const big = player.tier === 'breakout' || player.tier === 'star' || player.tier === 'phenomenon';
  useEffect(() => {
    if (!fresh) return;
    const t = window.setTimeout(() => playSfx(big ? 'cheer' : 'stamp'), 520);
    return () => window.clearTimeout(t);
  }, [fresh, big]);

  return (
    <div className={`reveal ${fresh ? 'is-fresh' : ''} ${big ? 'is-big' : ''}`}>
      {fresh && big && (
        <div className="reveal__beams" aria-hidden="true">
          <span />
          <span />
        </div>
      )}
      {fresh && <Confetti count={big ? 28 : 12} colours={[save.club.kit.primary, save.club.kit.secondary, '#CBF238', '#F4C653']} />}
      <div className="reveal__card">
        <FootballerCard player={player} kit={save.club.kit} variant="standard" showNewSticker={false} />
      </div>
      <div className="reveal__copy">
        <p className="reveal__stamp">Welcome to the club</p>
        <h2 className="reveal__name">
          {player.firstName} {player.lastName}
        </h2>
        <p className="reveal__meta">
          {player.age} · {player.primaryPosition} · {m.subtitle}
        </p>
        <dl className="reveal__stats">
          {m.stats.map((s, i) => (
            <StatCounter key={s.key} label={s.label} value={s.value} delay={700 + i * 140} enabled={fresh} />
          ))}
        </dl>
        {m.trait && (
          <p className="reveal__trait">
            <Icon name={m.trait.icon} size={16} /> <b>{m.trait.name}</b> — {m.trait.short}
          </p>
        )}
        <p className="reveal__line">“{m.originLine}”</p>
      </div>
    </div>
  );
}

function StatCounter({ label, value, delay, enabled }: { label: string; value: number; delay: number; enabled: boolean }) {
  const v = useCountUp(value, 520, enabled, { delayMs: delay, tickEvery: 20, sfx: 'coin' });
  return (
    <div className="reveal__stat">
      <dt>{label}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function RevealActions({ player, pack }: { player: Footballer; pack: OwnedPack }) {
  const save = useSave();
  const starting = Object.values(save.lineup).includes(player.id);
  const slot = starting ? null : bestSlotFor(save, player);
  const slotLabel = slot ? FORMATION_DEFS[save.formationId].slots.find((s) => s.id === slot.slotId)?.position : undefined;
  if (pack.kind === 'first-signing' && save.onboarding === 'lineup') {
    return (
      <>
        <Button variant="primary" size="lg" block icon="squad" onClick={() => navigate({ name: 'lineup' })}>
          Put him in the team
        </Button>
        {slot && slotLabel && (
          <p className="pack__hint">
            A straight upgrade at {slotLabel}: <b>+{slot.gain}</b> on the player he replaces.
          </p>
        )}
      </>
    );
  }
  return (
    <div className="pack__pair">
      <Button variant="ghost" onClick={() => navigate({ name: 'scout' })}>
        Scout room
      </Button>
      <Button variant="primary" icon="info" onClick={() => navigate({ name: 'player', id: player.id })}>
        View player
      </Button>
    </div>
  );
}
