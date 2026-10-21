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
import { fixtureFor, opponentSquad, squadAverage } from '../../domain/club/opponents';
import { FORMATION_DEFS } from '../../domain/formations';
import { overall } from '../../domain/players/rating';
import { CoachMark } from '../../components/ui/CoachMark';
import { UpgradePicker } from './UpgradePicker';
import './match.css';

export function MatchLobby() {
  const save = useSave();
  const { kickOff } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = save.pendingMatch;
  const fixture = fixtureFor(save.matchNumber);
  const club = fixture.club;
  const theirSquad = opponentSquad(save.careerSeed, club, fixture.lap);
  const theirPower = squadAverage(theirSquad);
  const ourPower = squadPower(save);
  const danger = [...theirSquad].sort((a, b) => overall(b) - overall(a))[0];
  const problems = lineupProblems(save.lineup, save.formationId, save.footballers, save.squadIds);
  const last = save.matchRecords[0];
  // Keep the pickers that were open when the screen loaded so each confirmation stays visible.
  const [upgrades] = useState(() => save.pendingUpgrades);
  const maxPower = Math.max(ourPower, theirPower, 1);
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
          <small>Match {save.matchNumber + 1}</small>
          Matchday
        </h1>
      </header>

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

      {upgrades.length > 0 && !pending && (
        <section className="lobby__upgrades" aria-label="Level-ups waiting">
          <h2 className="eyebrow">Ready to level up</h2>
          {upgrades.slice(0, 2).map((u) => {
            const p = save.footballers[u.playerId];
            return p ? <UpgradePicker key={`${u.playerId}-${u.level}`} upgrade={u} player={p} kit={save.club.kit} /> : null;
          })}
          {upgrades.length > 2 && <p className="lobby__more">+{upgrades.length - 2} more after these.</p>}
        </section>
      )}

      {!pending && (
        <section className="fixture" aria-labelledby="fixture-title">
          <div className="fixture__ticket">
            <span className="fixture__venue">{fixture.home ? `Home · ${save.club.stadiumName}` : `Away · ${club.stadiumName}`}</span>
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
            </div>
            <span className="fixture__vs">vs</span>
            <div className="fixture__team">
              <Crest club={{ ...club, kit: club.kit }} size={64} />
              <span>{club.shortName}</span>
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
          <p className="lobby__note">About two minutes · use PRESS and QUICK PASS to change the game</p>
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
