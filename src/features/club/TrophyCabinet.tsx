import { Trophy } from '../../components/league/Trophy';
import type { Kit } from '../../domain/club/types';
import { clubHonours } from '../../domain/league/honours';
import { divisionOf } from '../../domain/league/league';
import type { CupState, SeasonSummary } from '../../domain/save/types';
import type { World } from '../../domain/world/world';

/** Silverware won so far, on a shelf; an empty shelf says exactly how to fill it. */
export function TrophyCabinet({ seasons, division, kit, cup, world }: { seasons: readonly SeasonSummary[]; division: number; kit: Kit; cup: CupState | null; world: World }) {
  const honours = clubHonours(seasons, cup);
  const div = divisionOf(world, division);
  return (
    <section className="cabinet" aria-labelledby="cabinet-title">
      <h2 id="cabinet-title" className="eyebrow">
        Trophy cabinet
      </h2>
      {honours.length === 0 ? (
        <div className="cabinet__shelf is-empty">
          <span className="cabinet__ghost" aria-hidden="true">
            <Trophy kind="cup" ribbon="transparent" trim="transparent" size={56} />
          </span>
          <p>{div.promote > 0 ? `Empty for now. Finish in the top ${div.promote} of ${div.name} or win the County Cup to put the first piece here.` : `Win ${div.name} or the County Cup to put a trophy here.`}</p>
        </div>
      ) : (
        <ul className="cabinet__shelf">
          {[...honours].reverse().map((h) => (
            <li key={`${h.season}-${h.kind}`} className="cabinet__item">
              <Trophy kind={h.kind === 'title' ? 'cup' : h.kind === 'cup' ? 'jug' : 'pennant'} ribbon={kit.primary} trim={kit.secondary} size={64} />
              <span className="cabinet__label">
                <b>{h.kind === 'title' ? 'Champions' : h.kind === 'cup' ? 'Cup winners' : 'Promoted'}</b>
                <small>
                  S{h.season} · {h.divisionName.replace('County League ', '')}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
