import type { ClubIdentity } from '../../domain/club/types';

/** Original club badge built from the club's own colours and initials. */
export function Crest({ club, size = 40, className }: { club: Pick<ClubIdentity, 'kit' | 'shortName' | 'crest' | 'name'>; size?: number; className?: string }) {
  const { primary, secondary } = club.kit;
  const ink = '#1B2235';
  const outline =
    club.crest === 'round'
      ? 'M50 6a44 44 0 1 1 0 88a44 44 0 1 1 0-88Z'
      : club.crest === 'pennant'
        ? 'M12 10h76v46L50 94 12 56Z'
        : 'M50 5 88 16v30c0 24-16 40-38 49C28 86 12 70 12 46V16Z';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label={`${club.name} crest`}>
      <path d={outline} fill={secondary} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      <path d={outline} fill={primary} transform="translate(50 50) scale(0.78) translate(-50 -50)" />
      <path d="M50 20 L58 36 L50 33 L42 36 Z" fill={secondary} opacity={0.9} />
      <text
        x="50"
        y="66"
        textAnchor="middle"
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight={900}
        fontSize={club.shortName.length > 3 ? 22 : 26}
        fill={secondary}
        stroke={ink}
        strokeWidth={1.2}
        paintOrder="stroke"
        letterSpacing="1"
      >
        {club.shortName}
      </text>
    </svg>
  );
}
