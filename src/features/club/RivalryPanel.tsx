import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { foeFootballer, nemesisOf, NEMESIS_AT } from '../../domain/club/rivalry';
import { clubOf } from '../../domain/world/world';
import './rivalry.css';

/** Your nemesis (with his face) and the players you sold, wherever they are now. */
export function RivalryPanel() {
  const save = useSave();
  const nemesis = nemesisOf(save);
  const card = nemesis ? foeFootballer(save, nemesis) : null;
  const nemesisClub = nemesis ? clubOf(save.world, nemesis.clubId) : undefined;
  const sold = [...save.world.arrivals].reverse().slice(0, 4);
  const chasing = !nemesis ? save.foes.filter((f) => !save.squadIds.includes(f.playerId))[0] : undefined;
  return (
    <section className="rivalry panel" aria-label="Rivalries">
      <h2 className="eyebrow">Rivalries</h2>
      {nemesis ? (
        <div className="rivalry__nemesis">
          {card && (
            <span className="rivalry__card">
              <FootballerCard player={card} kit={nemesisClub?.kit ?? save.club.kit} variant="mini" showNewSticker={false} />
            </span>
          )}
          <div>
            <p className="rivalry__tag">Your nemesis</p>
            <p className="rivalry__name">{nemesis.name}</p>
            <p className="rivalry__line">
              {nemesis.goals} goals against you{nemesisClub ? ` · ${nemesisClub.name}` : ''}
            </p>
          </div>
          {nemesisClub && <Crest club={nemesisClub} size={34} />}
        </div>
      ) : (
        <p className="rivalry__empty">
          No nemesis yet. Whoever scores {NEMESIS_AT} against you earns the title{chasing ? ` — ${chasing.name} has ${chasing.goals}` : ''}.
        </p>
      )}
      {sold.length > 0 && (
        <ul className="rivalry__sold" aria-label="Players you sold">
          {sold.map((a) => {
            const club = clubOf(save.world, a.clubId);
            const goals = save.foes.find((f) => f.playerId === a.player.id)?.goals ?? 0;
            return (
              <li key={a.player.id}>
                <button type="button" onClick={() => navigate({ name: 'player', id: a.player.id })}>
                  <b>{a.player.lastName}</b> now at {club?.shortName ?? '?'}
                  {goals > 0 && <span className="rivalry__haunt"> · {goals} against you</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
