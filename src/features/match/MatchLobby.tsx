import { useState } from 'react';
import { useGame, useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { Icon } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { lineupProblems } from '../../domain/club/lineup';
import { squadPower } from '../../domain/club/newCareer';
import { opponentSquad, squadAverage } from '../../domain/club/opponents';
import { CLUB_BY_ID } from '../../data/clubs';
import { divisionOf, leagueTable, ordinal, strengthLap, userFixture, type UserFixture } from '../../domain/league/league';
import { PLAYER_CLUB_ID } from '../../domain/save/types';
import { FORMATION_DEFS } from '../../domain/formations';
import { overall } from '../../domain/players/rating';
import { CoachMark } from '../../components/ui/CoachMark';
import { ManagerCard } from '../../components/manager/ManagerCard';
import { AI_DECKS, CARD_DEFS, HAND_SIZE } from '../../game/simulation/cards';
import { UpgradeQueue } from './UpgradeQueue';
import { FormDots } from '../../components/league/FormDots';
import { Storylines } from '../../components/league/Storylines';
import { clubForm, fixtureStorylines } from '../../domain/league/stories';
import { CUP_NAME, CUP_ROUNDS, cupRoundName } from '../../domain/cup/cup';
import './match.css';

export function MatchLobby() {
  const save = useSave();
  const pm = save.pendingMatch;
  const fx = userFixture(save);
  const pendingClub = pm ? CLUB_BY_ID[pm.opponentId] : undefined;
  const fixture: UserFixture | null = pm && pendingClub ? { club: pendingClub, home: pm.userSide === 'home', round: pm.round ?? save.league.round, lap: strengthLap(save.season), competition: pm.competition ?? 'league', ...(pm.cupRound !== undefined ? { cupRound: pm.cupRound } : {}) } : fx;
  if (!fixture) return <SeasonComplete />;
  return <LobbyInner fixture={fixture} />;
}

/** All fixtures played: point to the final table and the next season. */
function SeasonComplete() {
  const save = useSave();
  const table = leagueTable(save.league, (id) => (id === PLAYER_CLUB_ID ? save.club.name : (CLUB_BY_ID[id]?.name ?? id)));
  const pos = table.findIndex((r) => r.clubId === PLAYER_CLUB_ID) + 1;
  return (
    <main className="screen lobby">
      <header className="screen-head">
        <h1>
          <small>Season {save.season}</small>
          Season over
        </h1>
      </header>
      <section className="paper lobby__season-over">
        <p className="lobby__kicker">{divisionOf(save.league.division).name}</p>
        <p className="display">You finished {ordinal(pos)}</p>
        <Button variant="primary" size="lg" block icon="star" onClick={() => navigate({ name: 'season' })}>
          See the final day
        </Button>
      </section>
    </main>
  );
}

function LobbyInner({ fixture }: { fixture: UserFixture }) {
  const save = useSave();
  const { kickOff } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = save.pendingMatch;
  const club = fixture.club;
  const division = divisionOf(save.league.division);
  const table = leagueTable(save.league, (id) => (id === PLAYER_CLUB_ID ? save.club.name : (CLUB_BY_ID[id]?.name ?? id)));
  const ourPos = table.findIndex((r) => r.clubId === PLAYER_CLUB_ID) + 1;
  const theirPos = table.findIndex((r) => r.clubId === club.id) + 1;
  const theirSquad = opponentSquad(save.careerSeed, club, fixture.lap);
  const theirPower = squadAverage(theirSquad);
  const ourPower = squadPower(save);
  const danger = [...theirSquad].sort((a, b) => overall(b) - overall(a))[0];
  const problems = lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds);
  const last = save.matchRecords[0];
  // Keep the pickers that were open when the screen loaded so each confirmation stays visible.
  const [upgrades] = useState(() => save.pendingUpgrades);
  const maxPower = Math.max(ourPower, theirPower, 1);
  const storylines = fixtureStorylines(save, fixture);
  const cup = fixture.competition === 'cup';
  const cupFinal = cup && fixture.cupRound === CUP_ROUNDS.length - 1;
  const ourForm = clubForm(save.league, PLAYER_CLUB_ID);
  const theirForm = clubForm(save.league, club.id);
  const inForm = Object.values(save.lineup)
    .map((id) => save.footballers[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => b.stats.goals + b.level - (a.stats.goals + a.level) || overall(b) - overall(a))[0];

  const play = async () => {
    setBusy(true);
    try {
      await kickOff();
      navigate({ name: 'live' });
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not start the match.', 'error');
      setBusy(false);
    }
  };

  return (
    <main className="screen lobby">
      <header className="screen-head">
        <h1>
          <small>{cup ? `${CUP_NAME} · ${cupRoundName(fixture.cupRound ?? 0)}` : `Round ${fixture.round + 1} of ${save.league.rounds.length} · ${division.name.replace('County League ', '')}`}</small>
          {cup ? (cupFinal ? 'Cup final' : 'Cup tie') : 'Matchday'}
        </h1>
        <Button variant="ghost" size="sm" icon="sort" onClick={() => navigate({ name: 'league' })}>
          Table
        </Button>
      </header>
      {!cup && save.league.results.length > 0 && (
        <p className="lobby__standing">
          You are <b>{ordinal(ourPos)}</b> · {club.shortName} are <b>{ordinal(theirPos)}</b>
        </p>
      )}

      {pending && (
        <section className="lobby__resume paper">
          <p className="lobby__kicker">Match in progress</p>
          <p>
            Your game against <b>{pending.userSide === 'home' ? pending.away.name : pending.home.name}</b> is waiting exactly where you left it.
          </p>
          <Button variant="primary" size="lg" block icon="whistle" onClick={() => navigate({ name: 'live' })}>
            Resume match
          </Button>
        </section>
      )}

      {!pending && (
        <section className={`fixture ${cup ? 'fixture--cup' : ''}`} aria-labelledby="fixture-title">
          <div className="fixture__ticket">
            {cup && <span className="fixture__cup">{cupFinal ? 'Final' : 'Knockout'}</span>}
            <span className="fixture__venue">{cupFinal ? 'Neutral · The County Ground' : fixture.home ? `Home · ${save.club.stadiumName}` : `Away · ${club.stadiumName}`}</span>
            {club.rival && (
              <span className="fixture__rival">
                <Icon name="bolt" size={14} /> Rivals
              </span>
            )}
          </div>
          <div className="fixture__teams">
            <div className="fixture__team">
              <Crest club={save.club} size={64} />
              <span>{save.club.shortName}</span>
              {save.league.results.length > 0 && <FormDots form={ourForm} label={save.club.name} />}
            </div>
            <span className="fixture__vs">vs</span>
            <div className="fixture__team">
              <Crest club={{ ...club, kit: club.kit }} size={64} />
              <span>{club.shortName}</span>
              {save.league.results.length > 0 && theirForm.length > 0 && <FormDots form={theirForm} label={club.name} />}
            </div>
          </div>
          <h2 id="fixture-title" className="fixture__name">
            {club.name}
          </h2>
          <p className="fixture__style">{club.styleLine}</p>

          <div className="fixture__bars" aria-label={`Team power: you ${ourPower}, ${club.name} ${theirPower}`}>
            <div className="fixture__bar">
              <span>{save.club.shortName}</span>
              <span className="fixture__track">
                <span style={{ width: `${(ourPower / maxPower) * 100}%` }} className="is-ours" />
              </span>
              <b>{ourPower.toFixed(1)}</b>
            </div>
            <div className="fixture__bar">
              <span>{club.shortName}</span>
              <span className="fixture__track">
                <span style={{ width: `${(theirPower / maxPower) * 100}%` }} />
              </span>
              <b>{theirPower.toFixed(1)}</b>
            </div>
          </div>
          <p className="fixture__note">
            They line up {club.formation} ({FORMATION_DEFS[club.formation].name})
            {danger ? (
              <>
                {' '}
                · watch <b>{danger.firstName} {danger.lastName}</b> ({overall(danger)})
              </>
            ) : null}
            .
          </p>
        </section>
      )}

      {!pending && storylines.length > 0 && (
        <section className="lobby__buildup paper" aria-labelledby="buildup-title">
          <h2 id="buildup-title" className="lobby__kicker">
            The build-up
          </h2>
          <Storylines lines={storylines} />
        </section>
      )}

      {upgrades.length > 0 && !pending && (
        <div className="lobby__upgrades">
          <UpgradeQueue heading="Ready to level up" />
        </div>
      )}

      {!pending && (
        <section className="lobby__cards panel" aria-labelledby="lobby-cards">
          <div className="lobby__team-head">
            <h2 id="lobby-cards" className="eyebrow">
              Manager cards
            </h2>
            <Button variant="ghost" size="sm" icon="flip" onClick={() => navigate({ name: 'cards' })}>
              Deck{save.newCards.length ? ` (${save.newCards.length} new)` : ''}
            </Button>
          </div>
          <div className="lobby__deck">
            {save.deck.map((id, i) => (
              <div key={id} className={i < HAND_SIZE ? 'is-hand' : ''}>
                <ManagerCard id={id} variant="hand" />
              </div>
            ))}
          </div>
          <p className="lobby__note">
            First {HAND_SIZE} are your opening hand. {club.name}’s bench brings: {AI_DECKS[club.aiStyle].map((c) => CARD_DEFS[c].name).join(', ')}.
          </p>
        </section>
      )}

      {!pending && (
        <section className="lobby__team panel">
          <div className="lobby__team-head">
            <div>
              <p className="eyebrow">Your seven · {save.formationId}</p>
              {inForm && (
                <p className="lobby__inform">
                  Key man: <b>{inForm.lastName}</b>
                </p>
              )}
            </div>
            <Button size="sm" variant="ghost" icon="shirt" onClick={() => navigate({ name: 'lineup' })}>
              Lineup
            </Button>
          </div>
          <div className="lobby__minis">
            {FORMATION_DEFS[save.formationId].slots.map((s) => {
              const p = save.footballers[save.lineup[s.id] ?? ''];
              return p ? (
                <div key={s.id} className="lobby__mini">
                  <FootballerCard player={p} kit={save.club.kit} variant="mini" onActivate={() => navigate({ name: 'player', id: p.id })} />
                </div>
              ) : null;
            })}
          </div>
        </section>
      )}

      {!pending && (
        <div className="lobby__cta">
          {problems.length > 0 && (
            <p className="lineup__problem" role="alert">
              <Icon name="info" size={16} /> {problems[0]}
            </p>
          )}
          {save.onboarding === 'match' && save.matchNumber === 0 && (
            <CoachMark className="lobby__coach">
              <b>Your first match.</b> Watch for the lime tactic chips under the pitch — I’ll tell you when to use one.
            </CoachMark>
          )}
          <Button
            variant="primary"
            size="lg"
            block
            icon="whistle"
            sfx="whistle"
            disabled={busy || problems.length > 0}
            onClick={play}
            className={save.onboarding === 'match' && save.matchNumber === 0 ? 'coach-target' : ''}
          >
            {busy ? 'Walking out…' : 'Play match'}
          </Button>
          <p className="lobby__note">About two minutes · spend Momentum on manager cards to change the game</p>
        </div>
      )}

      {last && !pending && (
        <button type="button" className="lobby__last" onClick={() => navigate({ name: 'result', id: last.matchId })}>
          <span className="eyebrow">Last result</span>
          <span className="lobby__last-score">
            {last.userSide === 'home' ? save.club.shortName : last.opponentName} {last.score.home}–{last.score.away}{' '}
            {last.userSide === 'home' ? last.opponentName : save.club.shortName}
          </span>
          <span className="lobby__last-head">{last.storyHeadline}</span>
        </button>
      )}
    </main>
  );
}
