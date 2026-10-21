import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { eventHeadline, openEvent } from '../../domain/club/dressingRoom';
import './dressing.css';

/** On the hub: the request waiting at the door, and how the last few played out. */
export function DressingRoomPanel() {
  const save = useSave();
  const open = openEvent(save);
  const recent = save.dressingRoom.events.filter((e) => e.status !== 'open' && e.atMatch >= save.matchNumber - 1).slice(0, 2);
  if (!open && recent.length === 0) return null;
  const who = open?.playerId ? save.footballers[open.playerId] : undefined;
  return (
    <section className="room" aria-label="Dressing room">
      <h2 className="eyebrow">Dressing room</h2>
      {open && (
        <button type="button" className="room__request" onClick={() => navigate({ name: 'event', id: open.id })}>
          {who ? <FootballerCard player={who} kit={save.club.kit} variant="mini" /> : <Crest club={save.club} size={52} />}
          <span>
            <b>{eventHeadline(open, save)}</b>
            <small>{who ? 'He’s knocking on your door.' : 'The players are waiting for you.'}</small>
          </span>
          <span className="room__go">Hear {who ? 'him' : 'them'} out</span>
        </button>
      )}
      {recent.length > 0 && (
        <ul className="room__news">
          {recent.map((e) => (
            <li key={e.id}>
              <button type="button" className={e.kind === 'promiseKept' ? 'is-good' : e.kind === 'promiseBroken' ? 'is-bad' : ''} onClick={() => navigate({ name: 'event', id: e.id })}>
                {e.outcome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
