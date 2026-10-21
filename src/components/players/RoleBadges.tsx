import './morale.css';

/** The armband ("C") and penalty duty ("P"), as small tags on a card or name. */
export function RoleBadges({ captain, penalties }: { captain?: boolean; penalties?: boolean }) {
  if (!captain && !penalties) return null;
  return (
    <span className="role-badges">
      {captain && (
        <span className="role-badge is-captain" role="img" aria-label="Captain">
          C
        </span>
      )}
      {penalties && (
        <span className="role-badge is-pens" role="img" aria-label="Penalty taker">
          P
        </span>
      )}
    </span>
  );
}
