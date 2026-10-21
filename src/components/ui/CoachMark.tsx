import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import './coach.css';

/**
 * A tutorial callout: short, pointing at the one thing to touch, never blocking the screen.
 * The arrow points from the bubble towards its target (placed by the parent layout).
 */
export function CoachMark({ children, arrow = 'down', onDismiss, className = '' }: { children: ReactNode; arrow?: 'up' | 'down' | 'none'; onDismiss?: () => void; className?: string }) {
  return (
    <div className={`coach coach--${arrow} ${className}`} role="note">
      <span className="coach__whistle" aria-hidden="true">
        <Icon name="whistle" size={18} />
      </span>
      <div className="coach__text">{children}</div>
      {onDismiss && (
        <button type="button" className="coach__close" onClick={onDismiss} aria-label="Got it">
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
