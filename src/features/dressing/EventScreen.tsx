import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { MoraleMeter } from '../../components/players/MoraleMeter';
import { Button, IconButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { PERSONALITY_BY_ID } from '../../data/personality';
import { CLUB_BY_ID } from '../../data/clubs';
import { choicesFor, eventHeadline, eventQuote } from '../../domain/club/dressingRoom';
import { describeEffect } from '../../domain/players/morale';
import './dressing.css';

/**
 * A knock on the manager's door: who, what he says (in his own voice), the choices with their
 * trade-offs spelled out, then what happened — with his mood moving in front of you.
 */
export function EventScreen({ id }: { id: string }) {
  const save = useSave();
  const { resolveEvent } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [before] = useState(() => {
    const e = save.dressingRoom.events.find((x) => x.id === id);
    return e?.playerId ? (save.footballers[e.playerId]?.morale ?? null) : null;
  });
  const e = save.dressingRoom.events.find((x) => x.id === id);

  if (!e) {
    return (
      <main className="screen">
        <div className="paper dressing__missing">
          <p className="display">Nothing to see here</p>
          <p>That conversation has been and gone.</p>
          <Button variant="primary" onClick={() => navigate({ name: 'club' })}>
            Back to the club
          </Button>
        </div>
      </main>
    );
  }

  const p = e.playerId ? save.footballers[e.playerId] : undefined;
  const other = e.otherId ? save.footballers[e.otherId] : undefined;
  const watcher = e.clubId ? CLUB_BY_ID[e.clubId] : undefined;
  const choices = choicesFor(e, save);
  const quote = eventQuote(e, save);
  const done = e.status !== 'open';

  const choose = async (choiceId: string) => {
    setBusy(true);
    try {
      await resolveEvent(e.id, choiceId);
      const after = e.playerId ? (save.footballers[e.playerId]?.morale ?? 0) : 0;
      playSfx(before !== null && after < before ? 'thud' : 'chime');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not do that.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`screen dressing dressing--${e.kind}`}>
      <header className="screen-head">
        <IconButton icon="back" label="Back to the club" onClick={() => goBack({ name: 'club' })} sfx="thud" />
        <h1>
          <small>Dressing room</small>
          {eventHeadline(e, save)}
        </h1>
      </header>

      <section className="dressing__who">
        {p ? (
          <div className="dressing__card">
            <FootballerCard player={p} kit={save.club.kit} variant="standard" onActivate={() => navigate({ name: 'player', id: p.id })} showNewSticker={false} />
          </div>
        ) : (
          <div className="dressing__crest">
            <Crest club={save.club} size={96} />
          </div>
        )}
        <div className="dressing__about">
          {other && (
            <button type="button" className="dressing__other" onClick={() => navigate({ name: 'player', id: other.id })}>
              <span className="dressing__other-card">
                <FootballerCard player={other} kit={save.club.kit} variant="mini" />
              </span>
              <span>
                with <b>{other.lastName}</b>
              </span>
            </button>
          )}
          {watcher && (
            <span className="dressing__watcher">
              <Crest club={watcher} size={34} /> <b>{watcher.name}</b> are watching
            </span>
          )}
          {p && (
            <>
              <p className="dressing__trait">{PERSONALITY_BY_ID[p.personality.type].label}</p>
              <MoraleMeter morale={p.morale} />
              <p className="dressing__effect">On the pitch: {describeEffect(p.morale)}</p>
            </>
          )}
        </div>
      </section>

      {quote && (
        <blockquote className="dressing__quote paper">
          <p>“{quote}”</p>
        </blockquote>
      )}

      {done ? (
        <section className="dressing__outcome" role="status">
          <p className="dressing__outcome-kicker">{e.status === 'news' ? 'How it played out' : 'What happened'}</p>
          <p className="dressing__outcome-text">{e.outcome}</p>
          {p && before !== null && p.morale !== before && (
            <p className={`dressing__delta ${p.morale > before ? 'is-up' : 'is-down'}`}>
              Morale {before} → <b>{p.morale}</b>
            </p>
          )}
          <Button variant="primary" size="lg" block icon="club" onClick={() => navigate({ name: 'club' })}>
            Back to the club
          </Button>
        </section>
      ) : (
        <section className="dressing__choices" aria-label="Your answer">
          {choices.map((c) => (
            <button key={c.id} type="button" className="dressing__choice" disabled={busy || Boolean(c.disabled)} onClick={() => void choose(c.id)}>
              <b>{c.label}</b>
              <small>{c.disabled ?? c.hint}</small>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
