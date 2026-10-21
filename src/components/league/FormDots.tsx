import type { FormEntry } from '../../domain/league/stories';
import './league-bits.css';

const WORD = { W: 'win', D: 'draw', L: 'loss' } as const;

/** Last few results as W/D/L chips, oldest on the left. */
export function FormDots({ form, label, size = 'sm' }: { form: readonly FormEntry[]; label: string; size?: 'sm' | 'md' }) {
  if (form.length === 0) return <span className={`form-dots form-dots--${size} is-empty`}>No games yet</span>;
  return (
    <span className={`form-dots form-dots--${size}`} role="img" aria-label={`${label} form: ${form.map((f) => WORD[f.res]).join(', ')}`}>
      {form.map((f, i) => (
        <span key={i} className={`form-dot form-dot--${f.res}`} aria-hidden="true">
          {f.res}
        </span>
      ))}
    </span>
  );
}
