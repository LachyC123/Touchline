import { playSfx } from '../../audio/sfx';
import { navigate, type Route } from '../../app/router';
import { Icon, type IconName } from '../icons/Icon';

const TABS: { route: Route; label: string; icon: IconName; match: Route['name'][] }[] = [
  { route: { name: 'club' }, label: 'Club', icon: 'club', match: ['club'] },
  { route: { name: 'squad' }, label: 'Squad', icon: 'squad', match: ['squad', 'player'] },
  { route: { name: 'match' }, label: 'Match', icon: 'whistle', match: ['match', 'lineup', 'result'] },
  { route: { name: 'more' }, label: 'More', icon: 'more', match: ['more', 'lab'] },
];

/**
 * Only tabs whose features genuinely work are shown. SCOUT arrives with M2 — no
 * "coming soon" placeholders.
 */
export function BottomNav({ current }: { current: Route }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => {
        const active = t.match.includes(current.name);
        return (
          <button
            key={t.label}
            type="button"
            className="bottom-nav__tab"
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              playSfx('tap');
              navigate(t.route);
            }}
          >
            <span className="bottom-nav__icon">
              <Icon name={t.icon} size={24} />
            </span>
            <span className="bottom-nav__label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
