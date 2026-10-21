import { playSfx } from '../../audio/sfx';
import { useGame } from '../../app/GameContext';
import { navigate, type Route } from '../../app/router';
import { unopenedPacks } from '../../domain/packs/packs';
import { Icon, type IconName } from '../icons/Icon';

const TABS: { route: Route; label: string; icon: IconName; match: Route['name'][] }[] = [
  { route: { name: 'club' }, label: 'Club', icon: 'club', match: ['club'] },
  { route: { name: 'squad' }, label: 'Squad', icon: 'squad', match: ['squad', 'player'] },
  { route: { name: 'match' }, label: 'Match', icon: 'whistle', match: ['match', 'lineup', 'result'] },
  { route: { name: 'scout' }, label: 'Scout', icon: 'scout', match: ['scout', 'pack'] },
  { route: { name: 'more' }, label: 'More', icon: 'more', match: ['more', 'lab'] },
];

/** Only tabs whose features genuinely work are shown — no "coming soon" placeholders. */
export function BottomNav({ current }: { current: Route }) {
  const { saveState } = useGame();
  const save = saveState.status === 'ready' ? saveState.save : null;
  const packs = save ? unopenedPacks(save).length : 0;
  const levelUps = save?.pendingUpgrades.length ?? 0;
  const badges: Partial<Record<string, number>> = { Scout: packs, Match: levelUps };
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => {
        const active = t.match.includes(current.name);
        const badge = badges[t.label] ?? 0;
        return (
          <button
            key={t.label}
            type="button"
            className="bottom-nav__tab"
            aria-current={active ? 'page' : undefined}
            aria-label={badge > 0 ? `${t.label} (${badge} new)` : undefined}
            onClick={() => {
              playSfx('tap');
              navigate(t.route);
            }}
          >
            <span className="bottom-nav__icon">
              <Icon name={t.icon} size={24} />
              {badge > 0 && (
                <span className="bottom-nav__badge" aria-hidden="true">
                  {badge}
                </span>
              )}
            </span>
            <span className="bottom-nav__label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
