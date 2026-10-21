import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import { useGame, useSave } from '../../app/GameContext';
import { goBack, navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { Crest } from '../../components/club/Crest';
import { Button, IconButton } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import { useToast } from '../../components/ui/Toast';
import { isReducedMotion } from '../../accessibility/motion';
import type { Kit } from '../../domain/club/types';
import { overall } from '../../domain/players/rating';
import type { Footballer } from '../../domain/players/types';
import { buyBlocker, haggleChance, haggleOf, marketListings, matchesUntilNewList, playerValue, priceOf, type Listing } from '../../domain/transfers/market';
import { clubOf } from '../../domain/world/world';
import './market.css';

const FREE_AGENT_KIT: Kit = { primary: '#8D99AE', secondary: '#FFF7E9', pattern: 'plain', cut: 'crew' };

/**
 * The transfer market: a short list of real players (and free agents) that changes every few
 * matches, and the offers that come in for your own. Every price, odds and blocker on screen
 * comes from the same market functions the purchase uses.
 */
export function MarketScreen() {
  const save = useSave();
  const [tab, setTab] = useState<'sign' | 'sell'>(() => (save.transfers.offers.some((o) => o.status === 'open') ? 'sell' : 'sign'));
  const [signed, setSigned] = useState<Footballer | null>(null);
  const openOffers = save.transfers.offers.filter((o) => o.status === 'open').length;
  return (
    <main className="screen market">
      <header className="screen-head">
        <IconButton icon="back" label="Back to the scout room" onClick={() => goBack({ name: 'scout' })} sfx="thud" />
        <h1>
          <small>Recruitment</small>
          Transfer market
        </h1>
        <span className="market__coins" aria-label={`${save.coins} coins`}>
          <span className="club__coin" aria-hidden="true" /> {save.coins}
        </span>
      </header>
      <div className="market__tabs" role="tablist" aria-label="Market">
        <button type="button" role="tab" aria-selected={tab === 'sign'} onClick={() => setTab('sign')}>
          Sign
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sell'} onClick={() => setTab('sell')}>
          Sell{openOffers > 0 ? ` (${openOffers})` : ''}
        </button>
      </div>
      {tab === 'sign' ? <SignTab onSigned={setSigned} /> : <SellTab />}
      {signed && <SignedReveal player={signed} kit={save.club.kit} clubName={save.club.name} onClose={() => setSigned(null)} />}
    </main>
  );
}

function SignTab({ onSigned }: { onSigned: (p: Footballer) => void }) {
  const save = useSave();
  const listings = marketListings(save);
  const left = matchesUntilNewList(save);
  return (
    <section className="market__list" aria-label="Players available">
      <p className="market__window">
        New list in <b>{left}</b> match{left === 1 ? '' : 'es'}. Squad {save.squadIds.length}/18.
      </p>
      {listings.length === 0 && (
        <div className="paper market__empty">
          <p className="display">Everyone’s signed</p>
          <p>You took the whole list. The phones will ring again soon.</p>
        </div>
      )}
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} onSigned={onSigned} />
      ))}
    </section>
  );
}

function ListingCard({ listing: l, onSigned }: { listing: Listing; onSigned: (p: Footballer) => void }) {
  const save = useSave();
  const { buyPlayer, hagglePlayer } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const from = l.fromClubId ? clubOf(save.world, l.fromClubId) : undefined;
  const price = priceOf(save, l);
  const haggled = haggleOf(save, l.id);
  const blocker = buyBlocker(save, l);
  const kit = from ? from.kit : FREE_AGENT_KIT;
  const ovr = overall(l.player);
  const scoredVsUs = save.matchRecords.filter((r) => r.scorers.some((s) => s.playerId === l.player.id)).length;

  const buy = async () => {
    setBusy(true);
    try {
      const r = await buyPlayer(l.id);
      if (r.applied) {
        playSfx('cheer');
        onSigned(l.player);
      }
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'The deal fell through.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const tryHaggle = async () => {
    setBusy(true);
    try {
      const won = await hagglePlayer(l.id);
      playSfx(won ? 'coin' : 'thud');
      toast.show(won ? `${l.player.lastName}’s people blink first: 20% off.` : `${l.player.lastName} is insulted. The price goes up 10%.`);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'No deal.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`listing ${blocker ? 'is-blocked' : ''}`} aria-label={`${l.player.firstName} ${l.player.lastName}, ${price} coins`}>
      <div className="listing__card">
        <FootballerCard player={l.player} kit={kit} variant="standard" showNewSticker={false} />
      </div>
      <div className="listing__body">
        <p className="listing__from">
          {from ? (
            <>
              <Crest club={from} size={22} /> {from.name}
            </>
          ) : (
            'Free agent'
          )}
        </p>
        <p className="listing__name">
          {l.player.firstName} <b>{l.player.lastName}</b>
        </p>
        <p className="listing__meta">
          {l.player.age} · {l.player.primaryPosition} · OVR {ovr} · potential {l.player.potential}
        </p>
        <p className="listing__reason">{l.reason}</p>
        {scoredVsUs > 0 && <p className="listing__hook">Scored against you {scoredVsUs === 1 ? 'once' : `${scoredVsUs} times`}.</p>}
        <p className="listing__price">
          <span className="club__coin" aria-hidden="true" /> <b>{price}</b>
          {haggled !== null && <small className={haggled ? 'is-down' : 'is-up'}>{haggled ? ' haggled down' : ' after the haggle'}</small>}
          {price !== playerValue(l.player) && haggled === null && <small> (worth {playerValue(l.player)})</small>}
        </p>
        <div className="listing__actions">
          <Button variant={blocker ? 'ghost' : 'primary'} icon="check" disabled={busy || Boolean(blocker)} onClick={() => void buy()}>
            Sign
          </Button>
          {haggled === null && (
            <Button variant="ghost" disabled={busy} onClick={() => void tryHaggle()}>
              Haggle {Math.round(haggleChance(save, l) * 100)}%
            </Button>
          )}
        </div>
        {blocker && <p className="listing__blocker">{blocker}</p>}
      </div>
    </article>
  );
}

function SellTab() {
  const save = useSave();
  const { answerOffer, setListed } = useGame();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const open = save.transfers.offers.filter((o) => o.status === 'open');
  const listed = save.transfers.listed.map((id) => save.footballers[id]).filter((p): p is Footballer => Boolean(p));
  const answer = async (id: string, accept: boolean) => {
    setBusy(true);
    try {
      const said = await answerOffer(id, accept);
      playSfx(accept ? 'coin' : 'thud');
      toast.show(said);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Could not do that.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="market__sell" aria-label="Selling">
      <h2 className="eyebrow">Offers on the table</h2>
      {open.length === 0 && <p className="market__note">No offers right now. Put a player on the list from his profile and clubs bid after matches. Big clubs may come in for your best players anyway.</p>}
      {open.map((o) => {
        const p = save.footballers[o.playerId];
        const club = clubOf(save.world, o.clubId);
        if (!p || !club) return null;
        return (
          <article key={o.id} className={`offer ${o.unsolicited ? 'is-unsolicited' : ''}`}>
            <button type="button" className="offer__card" onClick={() => navigate({ name: 'player', id: p.id })} aria-label={`Open ${p.lastName}'s profile`}>
              <FootballerCard player={p} kit={save.club.kit} variant="mini" />
            </button>
            <div className="offer__body">
              <p className="offer__club">
                <Crest club={club} size={22} /> {club.name}
                {o.unsolicited && <span className="offer__tag">Unasked</span>}
              </p>
              <p className="offer__line">
                Bid <b>{o.fee}</b> for {p.lastName} (worth about {playerValue(p)}). Open until after match {o.expiresAfter + 1}.
              </p>
              <div className="offer__actions">
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void answer(o.id, true)}>
                  Accept {o.fee}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void answer(o.id, false)}>
                  Turn down
                </Button>
              </div>
            </div>
          </article>
        );
      })}
      <h2 className="eyebrow">On the list</h2>
      {listed.length === 0 ? (
        <p className="market__note">Nobody is transfer-listed.</p>
      ) : (
        <ul className="market__listed">
          {listed.map((p) => (
            <li key={p.id}>
              <span>
                <b>{p.lastName}</b> · OVR {overall(p)} · worth {playerValue(p)}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void setListed(p.id, false)}>
                Take off
              </Button>
            </li>
          ))}
        </ul>
      )}
      {save.transfers.log.length > 0 && (
        <>
          <h2 className="eyebrow">Deals done</h2>
          <ul className="market__log">
            {save.transfers.log.slice(0, 12).map((x) => (
              <li key={`${x.kind}-${x.playerId}`} className={`is-${x.kind}`}>
                <span>{x.kind === 'in' ? '⬅ In' : 'Out ➡'}</span>
                <b>{x.name}</b>
                <span>
                  {x.clubId ? (x.kind === 'in' ? 'from ' : 'to ') + (clubOf(save.world, x.clubId)?.shortName ?? '') : 'free agent'} · {x.fee}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SignedReveal({ player, kit, clubName, onClose }: { player: Footballer; kit: Kit; clubName: string; onClose: () => void }) {
  const reduced = isReducedMotion();
  return (
    <div className="signed" role="dialog" aria-modal="true" aria-labelledby="signed-title">
      {!reduced && <Confetti count={40} colours={[kit.primary, kit.secondary, '#F4C653', '#CBF238']} />}
      <p className="signed__kicker">Deal done</p>
      <h2 id="signed-title" className="signed__title">
        Signed!
      </h2>
      <div className="signed__card">
        <FootballerCard player={player} kit={kit} variant="hero" showNewSticker={false} />
      </div>
      <p className="signed__line">
        {player.firstName} {player.lastName} pulls on the {clubName} shirt.
      </p>
      <Button variant="primary" size="lg" block icon="squad" onClick={() => navigate({ name: 'player', id: player.id })}>
        Meet him
      </Button>
      <Button variant="ghost" onClick={onClose}>
        Back to the market
      </Button>
    </div>
  );
}
