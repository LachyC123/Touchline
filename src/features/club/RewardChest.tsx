import { useEffect, useState } from 'react';
import { isReducedMotion } from '../../accessibility/motion';
import { playSfx } from '../../audio/sfx';
import { Button } from '../../components/ui/Button';
import { Confetti } from '../../components/ui/Confetti';
import './chest.css';

/**
 * A reward chest: it wobbles, bursts open with light, and shows what was inside. The reward is
 * already saved before this plays; it is only the unwrapping.
 */
export function RewardChest({ gold, title, detail, onOpenPack, onClose }: { gold: boolean; title: string; detail: string; onOpenPack?: () => void; onClose: () => void }) {
  const reduced = isReducedMotion();
  const [open, setOpen] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      playSfx('reveal');
      return;
    }
    playSfx('thud');
    const t1 = window.setTimeout(() => playSfx('thud'), 350);
    const t2 = window.setTimeout(() => {
      setOpen(true);
      playSfx('reveal');
    }, 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduced]);
  const lid = gold ? '#F4C653' : '#B5532A';
  const body = gold ? '#C8932A' : '#8A3324';
  return (
    <div className={`chest ${open ? 'is-open' : 'is-shut'}`} role="dialog" aria-modal="true" aria-labelledby="chest-title">
      {open && !reduced && <Confetti count={34} colours={['#F4C653', '#FFF7E9', '#CBF238']} />}
      <div className="chest__rays" aria-hidden="true" />
      <svg className="chest__svg" viewBox="0 0 200 170" aria-hidden="true">
        <ellipse cx="100" cy="158" rx="70" ry="8" fill="rgb(0 0 0 / 0.35)" />
        <g className="chest__body">
          <rect x="30" y="80" width="140" height="74" rx="10" fill={body} stroke="#1B2235" strokeWidth="5" />
          <rect x="30" y="100" width="140" height="12" fill="#1B2235" opacity="0.35" />
          <rect x="88" y="92" width="24" height="30" rx="5" fill="#FFF7E9" stroke="#1B2235" strokeWidth="4" />
          <circle cx="100" cy="104" r="4" fill="#1B2235" />
        </g>
        <g className="chest__lid">
          <path d="M30 84 Q30 40 100 40 Q170 40 170 84 Z" fill={lid} stroke="#1B2235" strokeWidth="5" />
          <path d="M60 46 Q62 66 62 84 M140 46 Q138 66 138 84" stroke="#1B2235" strokeWidth="4" fill="none" opacity="0.4" />
        </g>
      </svg>
      <h2 id="chest-title" className="chest__title">
        {open ? title : 'Opening…'}
      </h2>
      {open && <p className="chest__detail">{detail}</p>}
      {open && (
        <div className="chest__actions">
          {onOpenPack && (
            <Button variant="primary" size="lg" block icon="pack" onClick={onOpenPack}>
              Open the pack
            </Button>
          )}
          <Button variant={onOpenPack ? 'ghost' : 'primary'} size="lg" block onClick={onClose}>
            {onOpenPack ? 'Later' : 'Nice!'}
          </Button>
        </div>
      )}
    </div>
  );
}
