import type { Storyline, StoryKind } from '../../domain/league/stories';
import { Icon, type IconName } from '../icons/Icon';
import './league-bits.css';

const ICON: Record<StoryKind, IconName> = {
  finalDay: 'whistle',
  opener: 'whistle',
  clinch: 'starFilled',
  survive: 'shield',
  summit: 'star',
  leapfrog: 'sort',
  chase: 'target',
  scrap: 'wall',
  derby: 'bolt',
  revenge: 'bolt',
  meeting: 'info',
  ourRun: 'pulse',
  theirRun: 'pulse',
  ourScorer: 'boot',
  theirScorer: 'boot',
  milestone: 'starFilled',
  hotStreak: 'bolt',
};

/** "The build-up": short lines that say why the next match matters. */
export function Storylines({ lines }: { lines: readonly Storyline[] }) {
  return (
    <ul className="storylines">
      {lines.map((l, i) => (
        <li key={l.kind} className={`storyline storyline--${l.tone}`} style={{ animationDelay: `${120 + i * 90}ms` }}>
          <span className="storyline__icon" aria-hidden="true">
            <Icon name={ICON[l.kind]} size={16} />
          </span>
          <span>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
