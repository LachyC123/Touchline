import { moraleBand } from '../../domain/players/morale';
import './morale.css';

/** Mouth curve per band: frown → flat → smile → grin. */
const MOUTH: Record<string, string> = {
  low: 'M7 16 Q12 11.5 17 16',
  unsettled: 'M7.5 15 Q12 13.5 16.5 15',
  content: 'M7.5 14 L16.5 14',
  happy: 'M7 13.5 Q12 17.5 17 13.5',
  buzzing: 'M6.5 12.5 Q12 20 17.5 12.5 Z',
};

/** A small drawn face that reads at a glance (no platform emoji). */
export function MoodFace({ morale, size = 18 }: { morale: number; size?: number }) {
  const b = moraleBand(morale).band;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="mood-face">
      <circle cx="12" cy="12" r="10.5" fill="var(--mood)" stroke="#1B2235" strokeWidth="2" />
      <circle cx="8.5" cy="9.5" r="1.4" fill="#1B2235" />
      <circle cx="15.5" cy="9.5" r="1.4" fill="#1B2235" />
      <path d={MOUTH[b]} fill={b === 'buzzing' ? '#1B2235' : 'none'} stroke="#1B2235" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** His mood: a labelled bar (full size) or a compact chip (lists and lineups). */
export function MoraleMeter({ morale, compact = false }: { morale: number; compact?: boolean }) {
  const b = moraleBand(morale);
  if (compact) {
    return (
      <span className={`mood-chip mood--${b.band}`} role="img" aria-label={`Morale ${b.label}, ${morale}`}>
        <MoodFace morale={morale} size={20} />
      </span>
    );
  }
  return (
    <div className={`mood mood--${b.band}`}>
      <div className="mood__row">
        <span className="mood__label">
          <MoodFace morale={morale} /> {b.label}
        </span>
        <span className="mood__num">{morale}</span>
      </div>
      <div className="mood__bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={morale} aria-label="Morale">
        <span style={{ width: `${morale}%` }} />
      </div>
    </div>
  );
}
