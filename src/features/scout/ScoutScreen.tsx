import { useSave } from '../../app/GameContext';
import { navigate } from '../../app/router';
import { FootballerCard } from '../../components/cards/FootballerCard';
import { TierEmblem } from '../../components/icons/Icon';
import { TIER_DEFS, TIER_ORDER } from '../../data/tiers';
import { matchesUntilScoutPack, PACK_DEFS, PITY_AT, SCOUT_PACK_EVERY, unopenedPacks } from '../../domain/packs/packs';
import './scout.css';

/**
 * The recruitment room: earned packs waiting to be opened, exact odds, the visible pity
 * counter and the most recent signings. Packs are only ever earned by playing.
 */
export function ScoutScreen() {
  const save = useSave();
  const waiting = unopenedPacks(save);
  const toGo = matchesUntilScoutPack(save.matchNumber);
  const recent = save.packs
    .filter((p) => p.playerId)
    .slice(-4)
    .reverse()
    .map((p) => save.footballers[p.playerId ?? ''])
    .filter((p) => p !== undefined);
  const pityLeft = PITY_AT - save.guaranteedRecruitProgress;

  return (
    <main className="screen scout">
      <header className="screen-head">
        <h1>
          <small>Recruitment</small>
          Scout room
        </h1>
      </header>

      <section aria-labelledby="scout-waiting">
        <h2 id="scout-waiting" className="eyebrow">
          On the desk {waiting.length > 0 && <span className="scout__count">{waiting.length}</span>}
        </h2>
        {waiting.length > 0 ? (
          <div className="scout__packs">
            {waiting.map((p) => (
              <button key={p.id} type="button" className={`scout__pack scout__pack--${p.tier}`} onClick={() => navigate({ name: 'pack', id: p.id })}>
                <span className="scout__pack-edge" aria-hidden="true" />
                <span className="scout__pack-name">{PACK_DEFS[p.kind].name}</span>
                <span className="scout__pack-tier">
                  <TierEmblem tier={p.tier} size={14} /> {TIER_DEFS[p.tier].label} edge
                </span>
                <span className="scout__pack-open">Open</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="scout__empty paper">
            <p className="scout__empty-title">No packs waiting</p>
            <p>The scout sends a Local Scout pack after every {SCOUT_PACK_EVERY} matches you play.</p>
          </div>
        )}
      </section>

      <section className="scout__track paper" aria-label="Next scout pack">
        <div className="scout__track-head">
          <p>Next Local Scout pack</p>
          <b>
            {toGo} match{toGo === 1 ? '' : 'es'} to go
          </b>
        </div>
        <div className="scout__pips" role="progressbar" aria-valuemin={0} aria-valuemax={SCOUT_PACK_EVERY} aria-valuenow={SCOUT_PACK_EVERY - toGo}>
          {Array.from({ length: SCOUT_PACK_EVERY }, (_, i) => (
            <span key={i} className={i < SCOUT_PACK_EVERY - toGo ? 'is-on' : ''} />
          ))}
        </div>
        <p className="scout__pity">
          Breakout or better guaranteed within <b>{pityLeft}</b> scout recruit{pityLeft === 1 ? '' : 's'}.
        </p>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="scout-recent">
          <h2 id="scout-recent" className="eyebrow">
            Recent signings
          </h2>
          <div className="scout__recent">
            {recent.map((p) => (
              <FootballerCard key={p.id} player={p} kit={save.club.kit} variant="mini" onActivate={() => navigate({ name: 'player', id: p.id })} />
            ))}
          </div>
        </section>
      )}

      <section className="scout__odds paper" aria-labelledby="scout-odds">
        <h2 id="scout-odds">Local Scout odds</h2>
        <p>Every pack holds one real, unique footballer. Rarity is a sign of potential, not a guarantee of power.</p>
        <table>
          <tbody>
            {TIER_ORDER.map((t) => (
              <tr key={t}>
                <th scope="row">
                  <TierEmblem tier={t} size={14} /> {TIER_DEFS[t].label}
                </th>
                <td>{TIER_DEFS[t].odds}%</td>
                <td className="scout__odds-meaning">{TIER_DEFS[t].meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="scout__fine">No purchases, no duplicates. The first signing pack is a guaranteed Prospect at your weakest position.</p>
      </section>
    </main>
  );
}
