import { CUP_AFTER_LEAGUE_ROUNDS, CUP_NAME, CUP_ROUNDS, cupFinished, cupRoundName, cupWinner, eliminatedIn } from '../../domain/cup/cup';
import { clubName } from '../../domain/league/league';
import { PLAYER_CLUB_ID, type CupState, type CupTie } from '../../domain/save/types';
import type { World } from '../../domain/world/world';

function score(t: CupTie): string {
  if (t.hg === undefined || t.ag === undefined) return 'v';
  return `${t.hg}–${t.ag}`;
}

/** The County Cup, round by round: every tie, its score, penalties, and where we stand. */
export function CupBracket({ cup, ownName, world }: { cup: CupState; ownName: string; world: World }) {
  const nameOf = (id: string) => clubName(world, id, ownName);
  const out = eliminatedIn(cup);
  const winner = cupWinner(cup);
  const status =
    winner === PLAYER_CLUB_ID
      ? 'Winners! The cup is in the cabinet.'
      : out !== null
        ? `Knocked out in the ${cupRoundName(out).toLowerCase()}.${winner ? ` ${nameOf(winner)} won it.` : ''}`
        : cupFinished(cup)
          ? `${winner ? nameOf(winner) : 'Nobody'} won it.`
          : `Still in it: next up, the ${cupRoundName(cup.round).toLowerCase()}.`;
  return (
    <section className="league__cup" aria-label={CUP_NAME}>
      <p className="league__cup-status paper">
        <b>{CUP_NAME}</b> {status}
      </p>
      {CUP_ROUNDS.map((name, r) => {
        const ties = cup.rounds[r];
        return (
          <div key={name} className={`league__round panel ${r === cup.round ? 'is-next' : ''}`}>
            <h2 className="eyebrow">
              {name}
              {r === cup.round && !cupFinished(cup) ? ` · after league round ${CUP_AFTER_LEAGUE_ROUNDS[r]}` : ''}
            </h2>
            {ties ? (
              <ul>
                {ties.map((t) => {
                  const ours = t.home === PLAYER_CLUB_ID || t.away === PLAYER_CLUB_ID;
                  return (
                    <li key={`${t.home}-${t.away}`} className={ours ? 'is-us' : ''}>
                      <span className={`lf__home ${t.winner === t.home ? 'is-winner' : ''}`}>{nameOf(t.home)}</span>
                      <span className="lf__score">
                        {score(t)}
                        {t.pens ? <small className="lf__pens">{`${t.pens.home}–${t.pens.away} pens`}</small> : null}
                      </span>
                      <span className={`lf__away ${t.winner === t.away ? 'is-winner' : ''}`}>{nameOf(t.away)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="league__empty">Drawn when the {cupRoundName(r - 1).toLowerCase()} is over.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
