import { useEffect, useRef, useState } from 'react';
import { isReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { StadiumScene } from '../../components/club/StadiumScene';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import type { ClubIdentity } from '../../domain/club/types';
import { groundOf } from '../../domain/club/reputation';
import './groundreveal.css';

/**
 * "The builders are in": the old ground under scaffolding with a crane swinging, a progress bar
 * filling, then the new ground revealed with its capacity. The upgrade is already saved before
 * this plays; closing early skips nothing but the show.
 */
export function GroundReveal({ club, from, to, fill, onClose }: { club: Pick<ClubIdentity, 'kit' | 'name' | 'stadiumName'>; from: number; to: number; fill: number; onClose: () => void }) {
  const reduced = isReducedMotion();
  const [built, setBuilt] = useState(reduced);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (reduced) {
      playSfx('cheer');
      return;
    }
    playSfx('thud');
    const knocks = [500, 900, 1300].map((ms) => window.setTimeout(() => playSfx('tackle'), ms));
    const done = window.setTimeout(() => {
      setBuilt(true);
      playSfx('cheer');
    }, 1900);
    return () => {
      knocks.forEach(window.clearTimeout);
      window.clearTimeout(done);
    };
  }, [reduced]);
  useEffect(() => {
    if (built) closeRef.current?.focus();
  }, [built]);
  const ground = groundOf(to);
  return (
    <div className="groundreveal" role="dialog" aria-modal="true" aria-labelledby="groundreveal-title">
      {built && !reduced && <Confetti count={30} colours={[club.kit.primary, club.kit.secondary, '#F4C653', '#FFF7E9']} />}
      <p className="groundreveal__kicker">{built ? 'Open for business' : 'The builders are in'}</p>
      <div className={`groundreveal__scene ${built ? 'is-built' : 'is-building'}`}>
        <StadiumScene club={club} level={built ? to : from} fill={built ? fill : 0} />
        {!built && (
          <svg className="groundreveal__works" viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <g className="groundreveal__crane">
              <rect x="318" y="20" width="8" height="170" fill="#F4C653" stroke="#1B2235" strokeWidth="2" />
              <rect x="210" y="16" width="150" height="8" fill="#F4C653" stroke="#1B2235" strokeWidth="2" />
              <line x1="236" y1="24" x2="236" y2="70" stroke="#1B2235" strokeWidth="2" />
              <rect x="224" y="70" width="24" height="12" fill="#B5532A" stroke="#1B2235" strokeWidth="2" />
            </g>
            {[90, 140, 190, 240, 290].map((x) => (
              <g key={x} className="groundreveal__scaffold">
                <line x1={x} y1="96" x2={x} y2="190" stroke="#C9CED8" strokeWidth="3" />
                <line x1={x - 25} y1="120" x2={x + 25} y2="120" stroke="#C9CED8" strokeWidth="3" />
                <line x1={x - 25} y1="150" x2={x + 25} y2="150" stroke="#C9CED8" strokeWidth="3" />
                <line x1={x - 25} y1="190" x2={x + 25} y2="120" stroke="#C9CED8" strokeWidth="2" opacity="0.7" />
              </g>
            ))}
            <rect x="60" y="176" width="280" height="14" fill="#F2A33A" stroke="#1B2235" strokeWidth="2" />
            {[70, 110, 150, 190, 230, 270, 310].map((x) => (
              <rect key={x} x={x} y="176" width="20" height="14" fill="#1B2235" />
            ))}
          </svg>
        )}
      </div>
      {!built && (
        <div className="groundreveal__bar" aria-hidden="true">
          <span />
        </div>
      )}
      <h2 id="groundreveal-title" className="groundreveal__title">
        {built ? ground.name : 'Hard hats on…'}
      </h2>
      {built && (
        <>
          <p className="groundreveal__line">{ground.change}</p>
          <p className="groundreveal__cap">
            <b>{ground.capacity.toLocaleString('en-GB')}</b> capacity
          </p>
          <Button ref={closeRef} variant="primary" size="lg" block icon="club" onClick={onClose}>
            Back to the club
          </Button>
        </>
      )}
      {!built && (
        <Button variant="ghost" size="sm" onClick={() => setBuilt(true)}>
          Skip
        </Button>
      )}
    </div>
  );
}
