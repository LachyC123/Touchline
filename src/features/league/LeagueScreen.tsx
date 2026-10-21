import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useSave } from '../../app/GameContext';
import { goBack } from '../../app/router';
import { Crest } from '../../components/club/Crest';
import { IconButton } from '../../components/ui/Button';
import { clubName, divisionOf, leagueTable, ordinal, topScorers } from '../../domain/league/league';
import { PLAYER_CLUB_ID } from '../../domain/save/types';
import { crestOf } from './crestOf';
import { CupBracket } from './CupBracket';
import './league.css';

type Tab = 'table' | 'fixtures' | 'scorers' | 'cup';

/**
 * The division: standings computed from every stored result (ours and the AI fixtures the
 * engine simulated), the full fixture list with scores, and the scoring charts.
 */
export function LeagueScreen() {
  const save = useSave();
  const [tab, setTab] = useState<Tab>('table');
  const div = divisionOf(save.league.division);
  const nameOf = (id: string) => clubName(id, save.club.name);
  const table = leagueTable(save.league, nameOf);
  const scorers = topScorers(save.league);

  return (
    <main className="screen league">
      <header className="screen-head">
        <IconButton icon="back" label="Back" onClick={() => goBack({ name: 'match' })} sfx="thud" />
        <h1>
          <small>
            Season {save.season} · Round {Math.min(save.league.round + 1, save.league.rounds.length)} of {save.league.rounds.length}
          </small>
          {div.name.replace('County League ', '')}
        </h1>
      </header>

      <div className="segmented league__tabs" role="tablist" aria-label="League views">
        {(save.cup ? (['table', 'fixtures', 'scorers', 'cup'] as const) : (['table', 'fixtures', 'scorers'] as const)).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-pressed={tab === t}
            onClick={() => {
              playSfx('tap');
              setTab(t);
            }}
          >
            {t === 'table' ? 'Table' : t === 'fixtures' ? 'Fixtures' : t === 'scorers' ? 'Scorers' : 'Cup'}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <section className="league__table panel" aria-label="League table">
          <table>
            <thead>
              <tr>
                <th scope="col" className="lt__pos">
                  #
                </th>
                <th scope="col">Club</th>
                <th scope="col">P</th>
                <th scope="col">GD</th>
                <th scope="col">Pts</th>
                <th scope="col" className="lt__form">
                  Form
                </th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const zone = div.promote && i < div.promote ? 'up' : div.relegate && i >= table.length - div.relegate ? 'down' : '';
                return (
                  <tr key={r.clubId} className={`${r.clubId === PLAYER_CLUB_ID ? 'is-us' : ''} ${zone ? `is-${zone}` : ''}`}>
                    <td className="lt__pos">{i + 1}</td>
                    <td className="lt__club">
                      <Crest club={crestOf(save, r.clubId)} size={22} />
                      <span>{nameOf(r.clubId)}</span>
                    </td>
                    <td>{r.played}</td>
                    <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="lt__pts">{r.points}</td>
                    <td className="lt__form">
                      {r.form.map((f, k) => (
                        <span key={k} className={`lt__dot lt__dot--${f}`} aria-label={f === 'W' ? 'win' : f === 'D' ? 'draw' : 'loss'}>
                          {f}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="league__key">
            {div.promote > 0 && <span className="league__key-up">Top {div.promote} promoted</span>}
            {div.relegate > 0 && <span className="league__key-down">Bottom {div.relegate} relegated</span>}
            {div.promote === 0 && <span>Top division: win it for the trophy</span>}
          </p>
        </section>
      )}

      {tab === 'fixtures' && (
        <section className="league__fixtures" aria-label="Fixtures and results">
          {save.league.rounds.map((round, ri) => (
            <div key={ri} className={`league__round panel ${ri === save.league.round ? 'is-next' : ''}`}>
              <h2 className="eyebrow">
                Round {ri + 1}
                {ri === save.league.round ? ' · next' : ''}
              </h2>
              <ul>
                {round.map((f) => {
                  const res = save.league.results.find((x) => x.round === ri && x.home === f.home && x.away === f.away);
                  const ours = f.home === PLAYER_CLUB_ID || f.away === PLAYER_CLUB_ID;
                  return (
                    <li key={`${f.home}-${f.away}`} className={ours ? 'is-us' : ''}>
                      <span className="lf__home">{nameOf(f.home)}</span>
                      <span className="lf__score">{res ? `${res.hg}–${res.ag}` : 'v'}</span>
                      <span className="lf__away">{nameOf(f.away)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === 'scorers' && (
        <section className="league__scorers panel" aria-label="Top scorers">
          {scorers.length === 0 ? (
            <p className="league__empty">No goals yet this season.</p>
          ) : (
            <ol>
              {scorers.map((s, i) => (
                <li key={s.playerId} className={s.clubId === PLAYER_CLUB_ID ? 'is-us' : ''}>
                  <span className="ls__pos">{i + 1}</span>
                  <span className="ls__name">
                    {s.name}
                    <small>{nameOf(s.clubId)}</small>
                  </span>
                  <b>{s.goals}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tab === 'cup' && save.cup && <CupBracket cup={save.cup} ownName={save.club.name} />}

      {save.seasons.length > 0 && (
        <section className="league__history panel" aria-labelledby="history-title">
          <h2 id="history-title" className="eyebrow">
            Club history
          </h2>
          <ul>
            {[...save.seasons].reverse().map((h) => (
              <li key={h.season}>
                <span>Season {h.season}</span>
                <span>
                  {ordinal(h.position)} · {h.divisionName.replace('County League ', '')}
                </span>
                <b className={`league__outcome league__outcome--${h.outcome}`}>{h.outcome === 'stayed' ? `${h.points} pts` : h.outcome}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
