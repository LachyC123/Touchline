import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { toCardModel } from '../../components/cards/cardModel';
import { Crest } from '../../components/club/Crest';
import { StadiumScene } from '../../components/club/StadiumScene';
import { Icon } from '../../components/icons/Icon';
import { Button } from '../../components/ui/Button';
import { squadPower } from '../../domain/club/newCareer';
import './club.css';

export function ClubScreen() {
  const save = useSave();
  const anchor = save.footballers[save.anchorPlayerId];
  const power = squadPower(save);
  const anchorModel = anchor ? toCardModel(anchor) : null;
  const starters = Object.keys(save.lineup).length;

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
