import type { CSSProperties } from 'react';
import { CARD_DEFS, type CardId } from '../../game/simulation/cards';
import { Icon, type IconName } from '../icons/Icon';
import { CARD_COLOUR } from './cardColours';
import './manager.css';

interface Props {
  id: CardId;
  /** 'face' = full card with text (deck screen, reveals); 'hand' = compact match tray card. */
  variant?: 'face' | 'hand';
  locked?: { level: number };
  isNew?: boolean;
  className?: string;
}

/**
 * A manager card: cost gem, icon, name, duration and (face variant) what it does and the
 * catch. Purely presentational — the parent decides what tapping it means.
 */
export function ManagerCard({ id, variant = 'face', locked, isNew, className = '' }: Props) {
  const def = CARD_DEFS[id];
  return (
    <div className={`mc mc--${variant} ${locked ? 'is-locked' : ''} ${className}`} style={{ '--mc': CARD_COLOUR[id] } as CSSProperties}>
      <span className="mc__cost" aria-hidden="true">
        {def.cost}
      </span>
      <span className="mc__art" aria-hidden="true">
        <Icon name={(locked ? 'shield' : def.icon) as IconName} size={variant === 'hand' ? 22 : 30} />
      </span>
      <span className="mc__name">{def.name}</span>
      <span className="mc__dur">{def.durationMin > 0 ? `${def.durationMin}'` : 'Instant'}</span>
      {variant === 'face' && (
        <>
          <span className="mc__effect">{def.effect}</span>
          <span className="mc__catch">{def.downside}</span>
        </>
      )}
      {locked && <span className="mc__lock">Manager LV {locked.level}</span>}
      {isNew && !locked && <span className="mc__new">NEW</span>}
    </div>
  );
}
