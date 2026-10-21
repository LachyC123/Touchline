import { useEffect, useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack } from '../../app/router';
import { ManagerCard } from '../../components/manager/ManagerCard';
import { IconButton } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { managerProgress, nextCardUnlock } from '../../domain/club/manager';
import { CARD_DEFS, CARD_IDS, DECK_MAX, DECK_MIN, HAND_SIZE, MOMENTUM, type CardId } from '../../game/simulation/cards';
import { TICKS_PER_MINUTE } from '../../game/simulation/constants';
import './deck.css';

/**
 * Manager cards: pick the 3–5 cards you take into matches. Tap a card in the collection to add
 * it, tap a card in your deck to take it out. The first three are your opening hand.
 */
export function DeckScreen() {
  const save = useSave();
  const { setDeck, markCardsSeen } = useGame();
  const toast = useToast();
  // Remember which cards were new when the screen opened, then clear the badges in storage.
  const [fresh] = useState(() => save.newCards);
  useEffect(() => {
    if (fresh.length) void markCardsSeen();
  }, [fresh, markCardsSeen]);

  const mp = managerProgress(save.clubXp);
  const next = nextCardUnlock(mp.level);
  const deck = save.deck;

  const update = async (nextDeck: CardId[]) => {
    try {
      await setDeck(nextDeck);
      playSfx('pop');
    } catch (err) {
      playSfx('thud');
      toast.show(err instanceof Error ? err.message : 'That deck is not allowed.', 'error');
    }
  };

  const toggle = (id: CardId) => {
    if (!save.cardsUnlocked.includes(id)) {
      playSfx('thud');
      toast.show(`${CARD_DEFS[id].name} unlocks at manager level ${CARD_DEFS[id].unlockLevel}.`, 'error');
      return;
    }
    if (deck.includes(id)) {
      if (deck.length <= DECK_MIN) {
        playSfx('thud');
        toast.show(`Keep at least ${DECK_MIN} cards.`, 'error');
        return;
      }
      void update(deck.filter((c) => c !== id));
    } else {
      if (deck.length >= DECK_MAX) {
        playSfx('thud');
        toast.show(`Your deck is full (${DECK_MAX}). Tap a card in it to take it out first.`, 'error');
        return;
      }
      void update([...deck, id]);
    }
  };

  const regenMin = (MOMENTUM.regenTicks / TICKS_PER_MINUTE).toFixed(1).replace('.0', '');

  return (
    <main className="screen deck">
      <header className="screen-head">
        <IconButton icon="back" label="Back" onClick={() => goBack({ name: 'match' })} sfx="thud" />
        <h1>
          <small>Manager</small>
          Cards
        </h1>
      </header>

      <section className="deck__level paper" aria-label={`Manager level ${mp.level}`}>
        <div className="deck__level-row">
          <b>Manager LV {mp.level}</b>
          <span>{mp.span === null ? 'Top level' : `${mp.into} / ${mp.span} club XP`}</span>
        </div>
        <div className="deck__bar" aria-hidden="true">
          <span style={{ width: `${mp.span === null ? 100 : Math.min(100, (mp.into / mp.span) * 100)}%` }} />
        </div>
        <p>{next ? `Next card: ${CARD_DEFS[next.card].name} at LV ${next.level}. Club XP comes from every match (more for wins).` : 'Every manager card is unlocked.'}</p>
      </section>

      <section className="deck__how">
        <p>
          <b>Momentum</b> fills during the match: about one point every {regenMin} match minutes, up to {MOMENTUM.max}, and a little extra when you concede. Cards cost Momentum. Your first {HAND_SIZE} cards are your opening hand; a played card goes to the back of the deck and the next one comes in.
        </p>
      </section>

      <section aria-labelledby="deck-title">
        <h2 id="deck-title" className="eyebrow deck__h">
          Your deck · {deck.length}/{DECK_MAX}
        </h2>
        <ol className="deck__slots">
          {Array.from({ length: DECK_MAX }, (_, i) => {
            const id = deck[i];
            return (
              <li key={i} className={i < HAND_SIZE ? 'is-hand' : ''}>
                {id ? (
                  <button type="button" className="deck__card" onClick={() => toggle(id)} aria-label={`${CARD_DEFS[id].name}, costs ${CARD_DEFS[id].cost}. In your deck, position ${i + 1}. Tap to take it out.`}>
                    <ManagerCard id={id} variant="hand" />
                  </button>
                ) : (
                  <span className="deck__empty">Empty</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="deck__hint">Opening hand: the first {HAND_SIZE}. Tap a card here to take it out.</p>
      </section>

      <section aria-labelledby="coll-title">
        <h2 id="coll-title" className="eyebrow deck__h">
          Collection · {save.cardsUnlocked.length}/{CARD_IDS.length} unlocked
        </h2>
        <ul className="deck__grid">
          {CARD_IDS.map((id) => {
            const unlocked = save.cardsUnlocked.includes(id);
            const inDeck = deck.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`deck__card ${inDeck ? 'is-in' : ''}`}
                  onClick={() => toggle(id)}
                  aria-pressed={inDeck}
                  aria-label={`${CARD_DEFS[id].name}, costs ${CARD_DEFS[id].cost}. ${CARD_DEFS[id].effect} ${CARD_DEFS[id].downside} ${unlocked ? (inDeck ? 'In your deck.' : 'Tap to add.') : `Locked until manager level ${CARD_DEFS[id].unlockLevel}.`}`}
                >
                  <ManagerCard id={id} {...(unlocked ? {} : { locked: { level: CARD_DEFS[id].unlockLevel } })} isNew={fresh.includes(id)} />
                  {inDeck && <span className="deck__tick" aria-hidden="true">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
