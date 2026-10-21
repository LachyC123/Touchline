import { useEffect } from 'react';
import { playSfx } from '../../audio/sfx';
import { Crest } from '../../components/club/Crest';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import type { CrestShape } from '../../domain/club/types';
import type { BigMatch } from '../../domain/match/bigMatch';
import type { TeamLineup } from '../../game/simulation/types';
import './walkout.css';

interface Side {
  team: TeamLineup;
  crest: CrestShape;
}

/**
 * The tunnel before a big match: both crests, why it matters (a real storyline), the seven
 * walking out, then one tap to kick off. The match is held at minute 0 until then.
 */
export function WalkOut({ big, us, them, reduced, crowd = 0, ground, onKickOff }: { big: BigMatch; us: Side; them: Side; reduced: boolean; crowd?: number; ground?: string; onKickOff: () => void }) {
  useEffect(() => {
    playSfx('cheer');
  }, []);
  const crestOf = (s: Side) => ({ name: s.team.name, shortName: s.team.shortName, crest: s.crest, kit: { ...s.team.kit, pattern: s.team.kit.pattern ?? 'plain', cut: 'crew' as const } });
  const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;
  const seven = [...us.team.players].sort((a, b) => order[a.role] - order[b.role]);
  return (
    <div className={`walkout walkout--${big.kind}`} role="dialog" aria-modal="true" aria-labelledby="walkout-title">
      {!reduced && big.kind === 'cupFinal' && <Confetti count={36} colours={[us.team.kit.primary, us.team.kit.secondary, '#F4C653', '#FFF7E9']} />}
      <div className="walkout__rays" aria-hidden="true" />
      <p className="walkout__kicker">The teams are in the tunnel</p>
      <h2 id="walkout-title" className="walkout__title">
        {big.title}
      </h2>
      <div className="walkout__crests">
        <span className="walkout__crest is-us">
          <Crest club={crestOf(us)} size={84} />
          <b>{us.team.shortName}</b>
        </span>
        <span className="walkout__vs">vs</span>
        <span className="walkout__crest is-them">
          <Crest club={crestOf(them)} size={84} />
          <b>{them.team.shortName}</b>
        </span>
      </div>
      <p className="walkout__line">{big.line}</p>
      {crowd > 0 && (
        <p className="walkout__crowd">
          <b>{crowd.toLocaleString('en-GB')}</b> packed into {ground ?? 'the ground'}
        </p>
      )}
      <ol className="walkout__seven" aria-label="Your starting seven">
        {seven.map((p, i) => (
          <li key={p.id} style={{ animationDelay: `${500 + i * 110}ms` }}>
            <small>{p.role}</small> {p.shortName}
            {p.id === us.team.captainId && <span className="walkout__armband" aria-label="captain">C</span>}
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" block icon="whistle" sfx="whistle" onClick={onKickOff} className="walkout__go">
        Kick off
      </Button>
    </div>
  );
}
