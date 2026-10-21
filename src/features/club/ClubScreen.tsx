import { useGame, useSave } from '../../app/GameContext';
import { CoachMark } from '../../components/ui/CoachMark';
import { tipPending } from '../../domain/club/onboarding';
import { PACK_DEFS, unopenedPacks } from '../../domain/packs/packs';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { toCardModel } from '../../components/cards/cardModel';
import { Crest } from '../../components/club/Crest';
import { StadiumScene } from '../../components/club/StadiumScene';
import { Icon } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { squadPower } from '../../domain/club/newCareer';
import { fixtureFor } from '../../domain/club/opponents';
import './club.css';

export function ClubScreen() {
  const save = useSave();
  const { seeTip } = useGame();
  const waiting = unopenedPacks(save);
  const step = save.onboarding;
  const showNextTip = step === 'match' || (step === 'done' && tipPending(save, 'next-match') && save.matchNumber > 0 && !save.pendingMatch);
  const anchor = save.footballers[save.anchorPlayerId];
  const power = squadPower(save);
  const anchorModel = anchor ? toCardModel(anchor) : null;
  const starters = Object.keys(save.lineup).length;
  const fixture = fixtureFor(save.matchNumber);
  const last = save.matchRecords[0];

  return (
    <main className="screen club">
      <header className="club__hud">
        <Crest club={save.club} size={48} />
        <div className="club__id">
          <h1>{save.club.name}</h1>
          <p className="eyebrow">{save.club.stadiumName} · Season {save.season}</p>
        </div>
        <div className="club__coins" aria-label={`${save.coins} coins`}>
          <span className="club__coin" aria-hidden="true" />
          {save.coins}
        </div>
      </header>

      <section className="club__ground" aria-label={`${save.club.stadiumName}, ground level ${save.club.stadiumLevel}`}>
        <StadiumScene club={save.club} />
        <span className="club__ground-tag">
          Ground level {save.club.stadiumLevel} · {save.club.stadiumLevel === 1 ? 'Seen better days' : 'On the up'}
        </span>
      </section>

      {step === 'lineup' && (
        <CoachMark className="club__coach" arrow="none">
          <span>Your new signing is waiting for a shirt.</span>
          <Button size="sm" className="coach__action" icon="squad" onClick={() => navigate({ name: 'lineup' })}>
            Put him in the team
          </Button>
        </CoachMark>
      )}
      {step === 'club' && (
        <CoachMark className="club__coach" arrow="none">
          <span>One last thing: name your club and pick its colours.</span>
          <Button size="sm" className="coach__action" icon="shield" onClick={() => navigate({ name: 'setup' })}>
            Make it yours
          </Button>
        </CoachMark>
      )}
      {showNextTip && (
        <CoachMark className="club__coach" onDismiss={step === 'done' ? () => void seeTip('next-match') : undefined}>
          {step === 'match' ? (
            <span>
              <b>Kick-off time.</b> Your first match is one tap away.
            </span>
          ) : (
            <span>
              <b>{save.club.name} is yours.</b> Win matches, earn scout packs, train your players. Next up:
            </span>
          )}
        </CoachMark>
      )}
      <button
        type="button"
        className={`club__next ${showNextTip ? 'coach-target' : ''}`}
        onClick={() => {
          if (showNextTip && step === 'done') void seeTip('next-match');
          navigate({ name: save.pendingMatch ? 'live' : 'match' });
        }}
      >
        <span className="club__next-kicker">{save.pendingMatch ? 'Match in progress' : 'Next match'}</span>
        <span className="club__next-vs">
          vs {save.pendingMatch ? (save.pendingMatch.userSide === 'home' ? save.pendingMatch.away.name : save.pendingMatch.home.name) : fixture.club.name}
        </span>
        <span className="club__next-meta">
          {save.pendingMatch ? 'Tap to resume where you left off' : `${fixture.home ? 'Home' : 'Away'} · ${fixture.club.rival ? 'Local rivals · ' : ''}${fixture.club.styleLine}`}
        </span>
        <span className="club__next-go" aria-hidden="true">
          <Icon name="whistle" size={26} />
        </span>
      </button>
      {last && <p className="club__latest">Latest: {last.storyHeadline}</p>}
      {waiting.length > 0 && step !== 'pack' && (
        <button type="button" className="club__levelup club__packs" onClick={() => navigate(waiting.length === 1 ? { name: 'pack', id: (waiting[0] as (typeof waiting)[number]).id } : { name: 'scout' })}>
          <Icon name="pack" size={18} /> {waiting.length === 1 ? `${PACK_DEFS[(waiting[0] as (typeof waiting)[number]).kind].name} pack waiting — open it` : `${waiting.length} scout packs waiting`}
        </button>
      )}
      {save.pendingUpgrades.length > 0 && (
        <button type="button" className="club__levelup" onClick={() => navigate({ name: 'match' })}>
          <Icon name="star" size={18} /> {save.pendingUpgrades.length} level-up{save.pendingUpgrades.length > 1 ? 's' : ''} ready — choose training focus
        </button>
      )}

      {anchor && anchorModel && (
        <section className="club__spotlight paper" aria-labelledby="spotlight-title">
          <div className="club__spotlight-card">
            <FootballerCard player={anchor} kit={save.club.kit} variant="standard" onActivate={() => navigate({ name: 'player', id: anchor.id })} />
          </div>
          <div className="club__spotlight-copy">
            <p className="club__kicker">One to watch</p>
            <h2 id="spotlight-title">
              {anchor.firstName} {anchor.lastName}
            </h2>
            <p className="club__spotlight-meta">
              {anchor.age} · {anchorModel.subtitle}
            </p>
            <p className="club__spotlight-line">“{anchorModel.originLine}”</p>
            <Button variant="blue" size="sm" icon="info" onClick={() => navigate({ name: 'player', id: anchor.id })}>
              Profile
            </Button>
          </div>
        </section>
      )}

      <section className="club__tiles">
        <button type="button" className="club__tile" onClick={() => navigate({ name: 'squad' })}>
          <span className="club__tile-icon">
            <Icon name="squad" size={26} />
          </span>
          <span className="club__tile-text">
            <span className="club__tile-title">Squad</span>
            <span className="club__tile-sub">
              {save.squadIds.length} players · {starters} starters
            </span>
          </span>
          <span className="club__tile-stat" aria-label={`Team power ${power}`}>
            <b>{power.toFixed(1)}</b>
            <small>Power</small>
          </span>
        </button>
      </section>

      <p className="club__saved">
        <Icon name="check" size={16} /> Progress saved on this device
      </p>
    </main>
  );
}
