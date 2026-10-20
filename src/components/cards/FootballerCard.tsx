import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { playSfx } from '../../audio/sfx';
import { useReducedMotion } from '../../accessibility/motion';
import type { Kit } from '../../domain/club/types';
import type { Footballer } from '../../domain/players/types';
import { Icon, TierEmblem } from '../icons/Icon';
import { Portrait } from '../portrait/Portrait';
import { nameSizeClass, toCardModel } from './cardModel';
import './card.css';

export type CardVariant = 'mini' | 'standard' | 'hero';

interface FootballerCardProps {
  player: Footballer;
  kit: Kit;
  variant: CardVariant;
  /** Standard/mini: primary action (e.g. open profile). */
  onActivate?: () => void;
  /** Hero: controlled flip state. */
  flipped?: boolean;
  onFlip?: () => void;
  showNewSticker?: boolean;
  className?: string;
}

/**
 * The quality-bar component. Tier changes the frame silhouette, rim material and emblem
 * shape (never colour alone); the portrait and every number come from the same stored player.
 */
export function FootballerCard({ player, kit, variant, onActivate, flipped = false, onFlip, showNewSticker = true, className = '' }: FootballerCardProps) {
  const m = toCardModel(player);
  const reduced = useReducedMotion();
  const tiltRef = useRef<HTMLDivElement>(null);

  const interactive = variant === 'hero' ? Boolean(onFlip) : Boolean(onActivate);
  const activate = () => {
    if (variant === 'hero') {
      playSfx('flip');
      onFlip?.();
    } else if (onActivate) {
      playSfx('tap');
      onActivate();
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || variant === 'mini' || e.pointerType === 'touch') return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
    el.style.setProperty('--gx', `${px * 100}%`);
    el.style.setProperty('--gy', `${py * 100}%`);
    el.dataset.tilting = 'true';
  };
  const resetTilt = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    delete el.dataset.tilting;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  const kitStyle = { '--kit-a': kit.primary, '--kit-b': kit.secondary } as CSSProperties;
  const classes = ['fc', `fc--${variant}`, `fc--${player.tier}`, flipped ? 'is-flipped' : '', className].filter(Boolean).join(' ');
  const nameClass = nameSizeClass(m.lastName);

  if (variant === 'mini') {
    return (
      <div
        className={classes}
        style={kitStyle}
        role={interactive ? 'button' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={m.ariaLabel}
        onClick={interactive ? activate : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        data-player-id={player.id}
      >
        <div className="fc__rim">
          <div className="fc__stock">
            <div className="fc__window">
              <Portrait appearance={player.appearance} kit={kit} compact className="fc__portrait" />
            </div>
            <div className="fc__mini-ovr">{m.ovr}</div>
            <div className="fc__mini-pos">{m.position}</div>
            <TierEmblem tier={player.tier} size={12} className="fc__mini-tier" />
          </div>
        </div>
      </div>
    );
  }

  const front = (
    <div className="fc__face fc__front" aria-hidden={flipped || undefined}>
      <div className="fc__rim">
        <div className="fc__stock">
          <div className="fc__window">
            <div className="fc__floodlight" />
            <Portrait appearance={player.appearance} kit={kit} className="fc__portrait" />
            {player.tier === 'prospect' && <div className="fc__sticker" aria-hidden="true">★</div>}
          </div>
          <div className="fc__ovr">
            <span className="fc__ovr-num">{m.ovr}</span>
          </div>
          <div className="fc__pos">{m.position}</div>
          <div className={`fc__nameplate ${nameClass}`}>
            {variant === 'hero' && <span className="fc__first">{m.nickname ? `${m.firstName} “${m.nickname}”` : m.firstName}</span>}
            <span className="fc__last">{m.lastName}</span>
          </div>
          <div className="fc__subtitle">{m.subtitle}</div>
          <dl className="fc__stats">
            {m.stats.map((s) => (
              <div key={s.key} className="fc__stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          {m.trait && (
            <div className="fc__trait">
              <Icon name={m.trait.icon} size={variant === 'hero' ? 18 : 14} />
              <span>{m.trait.name}</span>
              {m.extraTraits.length > 0 && <span className="fc__trait-more">+{m.extraTraits.length}</span>}
            </div>
          )}
          <div className="fc__foot">
            <TierEmblem tier={player.tier} size={variant === 'hero' ? 16 : 12} className="fc__tier-emblem" />
            <span className="fc__tier-label">{m.tierLabel}</span>
            {variant === 'hero' && <span className="fc__story">{m.storyChip}</span>}
          </div>
          <div className="fc__glare" aria-hidden="true" />
        </div>
      </div>
    </div>
  );

  const back =
    variant === 'hero' ? (
      <div className="fc__face fc__back" aria-hidden={!flipped || undefined}>
        <div className="fc__rim">
          <div className="fc__stock fc__stock--back">
            <div className="fc__back-head">
              <Portrait appearance={player.appearance} kit={kit} className="fc__back-portrait" />
              <div>
                <p className="fc__back-name">
                  {m.firstName} {m.lastName}
                </p>
                <p className="fc__back-meta">
                  {player.age} · {player.nationality} · {player.hometown}
                </p>
              </div>
            </div>
            <p className="fc__back-origin">“{m.originLine}”</p>
            <dl className="fc__back-facts">
              <div>
                <dt>Character</dt>
                <dd>{m.personalityLabel}</dd>
              </div>
              <div>
                <dt>Dream</dt>
                <dd>{m.dream}</dd>
              </div>
              <div>
                <dt>Celebration</dt>
                <dd>{m.celebration}</dd>
              </div>
            </dl>
            <div className="fc__back-diary">
              <p className="fc__back-diary-title">Scrapbook</p>
              <ol>
                {[...player.history]
                  .sort((a, b) => b.order - a.order)
                  .slice(0, 3)
                  .map((h) => (
                    <li key={h.id}>
                      <span className="fc__diary-season">S{h.season}</span>
                      {h.headline}
                    </li>
                  ))}
              </ol>
            </div>
            <div className="fc__back-record">
              <span>
                <b>{player.stats.matches}</b> apps
              </span>
              <span>
                <b>{player.stats.goals}</b> goals
              </span>
              <span>
                <b>{player.stats.assists}</b> assists
              </span>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={classes}
      style={kitStyle}
      role={interactive ? 'button' : 'group'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={variant === 'hero' && interactive ? `${m.ariaLabel}. ${flipped ? 'Showing story side' : 'Tap to flip for story'}` : m.ariaLabel}
      aria-pressed={variant === 'hero' && interactive ? flipped : undefined}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      data-player-id={player.id}
    >
      <div className="fc__tilt" ref={tiltRef}>
        <div className="fc__flipper">
          {front}
          {back}
        </div>
      </div>
      {showNewSticker && player.isNew && (
        <span className="fc__new" aria-label="New signing">
          NEW
        </span>
      )}
      {player.favourite && (
        <span className="fc__fav" aria-label="Favourite">
          <Icon name="starFilled" size={14} />
        </span>
      )}
    </div>
  );
}
