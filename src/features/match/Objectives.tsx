import { OBJECTIVE_REWARD, type Objective } from '../../domain/match/objectives';
import './objectives.css';

/**
 * The match's three objectives as stars: open before kick-off, ticked (or not) at full time.
 * `done` is null while a match hasn't been judged.
 */
export function ObjectivesCard({ objectives, done, animate = false, title = 'Objectives' }: { objectives: readonly Objective[]; done?: readonly (boolean | null)[]; animate?: boolean; title?: string }) {
  if (!objectives.length) return null;
  const stars = done?.filter(Boolean).length ?? 0;
  return (
    <section className={`objectives ${animate ? 'is-fresh' : ''}`} aria-label={title}>
      <div className="objectives__head">
        <span className="eyebrow">{title}</span>
        <span className="objectives__stars" aria-label={done ? `${stars} of ${objectives.length} stars` : `${objectives.length} stars to win`}>
          {objectives.map((_, i) => (
            <span key={i} className={done?.[i] ? 'is-on' : ''} style={{ animationDelay: `${300 + i * 260}ms` }} aria-hidden="true">
              ★
            </span>
          ))}
        </span>
      </div>
      <ul>
        {objectives.map((o, i) => (
          <li key={`${o.id}-${o.playerId ?? ''}`} className={done?.[i] === true ? 'is-done' : done?.[i] === false ? 'is-missed' : ''}>
            <span className="objectives__tick" aria-hidden="true">
              {done?.[i] === true ? '✓' : done?.[i] === false ? '✕' : '○'}
            </span>
            {o.text}
            {done && <span className="visually-hidden">{done[i] ? ' (done)' : ' (missed)'}</span>}
          </li>
        ))}
      </ul>
      {!done && (
        <p className="objectives__note">
          {OBJECTIVE_REWARD.perStar} coins a star, +{OBJECTIVE_REWARD.allThree} for all three.
        </p>
      )}
    </section>
  );
}
