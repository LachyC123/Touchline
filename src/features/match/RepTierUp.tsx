import { Confetti } from '../../components/ui/Confetti';
import { GROUND_LEVELS, REP_TIERS, repTier, scoutOdds } from '../../domain/club/reputation';
import './reptier.css';

/**
 * The club's name just carried further: a full-width moment on the result screen with what the
 * new tier actually changes (scout odds, the next ground it unlocks). Every number comes from
 * the same reputation tables the rest of the game uses.
 */
export function RepTierUp({ tierId, rep, stadiumLevel, animate, colours }: { tierId: string; rep: number; stadiumLevel: number; animate: boolean; colours: string[] }) {
  const tier = REP_TIERS.find((t) => t.id === tierId) ?? repTier(rep);
  const prev = REP_TIERS[Math.max(0, REP_TIERS.indexOf(tier) - 1)] ?? tier;
  const before = scoutOdds(prev.from);
  const after = scoutOdds(tier.from);
  const rarer = Math.round((100 - after.street - (100 - before.street)) * 10) / 10;
  const opens = GROUND_LEVELS.find((g) => g.needs === tier.from && g.level > stadiumLevel);
  const index = REP_TIERS.indexOf(tier);
  return (
    <section className={`reptier ${animate ? 'is-fresh' : ''}`} aria-labelledby="reptier-title" role="status">
      {animate && <Confetti count={34} colours={['#F4C653', '#FFF7E9', ...colours]} />}
      <p className="reptier__kicker">Reputation up</p>
      <ol className="reptier__ladder" aria-hidden="true">
        {REP_TIERS.map((t, i) => (
          <li key={t.id} className={i < index ? 'is-past' : i === index ? 'is-now' : ''} />
        ))}
      </ol>
      <h2 id="reptier-title" className="reptier__title">
        {tier.label}
      </h2>
      <p className="reptier__blurb">{tier.blurb}</p>
      <ul className="reptier__perks">
        {rarer > 0 && <li>Scouts find rarer talent: +{rarer}% chance of better than Street</li>}
        {opens && (
          <li>
            Ground upgrade open: <b>{opens.name}</b> ({opens.capacity.toLocaleString('en-GB')} capacity)
          </li>
        )}
        <li>Bigger crowds at home</li>
      </ul>
    </section>
  );
}
