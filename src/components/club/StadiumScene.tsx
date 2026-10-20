import type { ClubIdentity } from '../../domain/club/types';
import './stadium.css';

/**
 * Layered stadium illustration (top-left light, shared ink). Level 1 = the battered
 * starting ground: a single small terrace, chipped paint, two floodlights, sparse fans.
 * Loops are few and semantic: floodlight shimmer and a flag in the wind.
 */
export function StadiumScene({ club, variant = 'hub' }: { club: Pick<ClubIdentity, 'kit' | 'name' | 'stadiumName'>; variant?: 'hub' | 'title' }) {
  const { primary, secondary } = club.kit;
  const ink = '#1B2235';
  const fans = [
    [118, 118], [132, 121], [150, 117], [171, 120], [190, 118], [214, 121], [236, 117], [262, 120], [281, 118],
  ] as const;
  return (
    <svg className={`stadium stadium--${variant}`} viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B1526" />
          <stop offset="0.6" stopColor="#1B2F55" />
          <stop offset="1" stopColor="#3B4E7A" />
        </linearGradient>
        <linearGradient id="st-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF7E9" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFF7E9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="st-pitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E8D70" />
          <stop offset="1" stopColor="#136650" />
        </linearGradient>
      </defs>

      <rect width="400" height="220" fill="url(#st-sky)" />
      {[[30, 24], [80, 40], [140, 18], [210, 30], [300, 16], [350, 44], [372, 22], [250, 50]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="#FFF7E9" opacity={0.7} />
      ))}

      {/* Distant rooftops */}
      <path
        d="M0 150 L0 120 L22 120 L22 108 L40 98 L58 108 L58 122 L84 122 L84 112 L104 112 L104 126 L300 126 L300 110 L318 100 L336 110 L336 118 L356 118 L356 104 L376 104 L376 120 L400 120 L400 150 Z"
        fill="#16264A"
      />
      {[[30, 112], [46, 114], [92, 118], [326, 112], [364, 110]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={5} height={5} fill="#F4C653" opacity={0.55} />
      ))}

      {/* Floodlight beams */}
      <g className="stadium__beams">
        <path d="M70 36 L10 170 L150 170 Z" fill="url(#st-beam)" opacity={0.35} />
        <path d="M330 36 L250 170 L390 170 Z" fill="url(#st-beam)" opacity={0.35} />
      </g>

      {/* Floodlight towers */}
      {[70, 330].map((x) => (
        <g key={x}>
          <path d={`M${x - 3} 150 L${x - 1} 44 L${x + 1} 44 L${x + 3} 150 Z`} fill="#2A3A5E" stroke={ink} strokeWidth={2} />
          <rect x={x - 14} y={28} width={28} height={16} rx={3} fill="#2A3A5E" stroke={ink} strokeWidth={2.4} />
          {[-9, -3, 3, 9].map((dx) => (
            <circle key={dx} className="stadium__bulb" cx={x + dx} cy={36} r={2.4} fill="#FFF7E9" />
          ))}
        </g>
      ))}

      {/* Terrace stand (level 1: small, chipped paint) */}
      <path d="M96 150 L104 104 L296 104 L304 150 Z" fill="#2F4470" stroke={ink} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M104 104 L296 104 L292 96 L108 96 Z" fill={primary} stroke={ink} strokeWidth={2.6} strokeLinejoin="round" />
      {[112, 124, 136].map((y) => (
        <path key={y} d={`M${100 + (y - 104) * 0.17} ${y} L${300 - (y - 104) * 0.17} ${y}`} stroke="#1E3157" strokeWidth={2} />
      ))}
      {/* chipped paint */}
      <path d="M150 97 l6 0 l-2 5 Z M228 98 l8 0 l-3 4 Z M268 97 l5 1 l-3 4 Z" fill="#2F4470" />
      {/* sparse supporters */}
      {fans.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y - 7} r={3.4} fill="#F2C9A0" stroke={ink} strokeWidth={1.2} />
          <path d={`M${x - 5} ${y + 2} q5 -9 10 0 Z`} fill={i % 3 === 0 ? secondary : primary} stroke={ink} strokeWidth={1.2} />
        </g>
      ))}

      {/* Club sign on the roof */}
      <g>
        <rect x={146} y={78} width={108} height={20} rx={4} fill={secondary} stroke={ink} strokeWidth={2.6} />
        <text x={200} y={93} textAnchor="middle" fontFamily="Barlow Condensed, sans-serif" fontWeight={900} fontSize={13} fill={ink} letterSpacing="1.5">
          {club.name.toUpperCase()}
        </text>
        <path d="M160 78 L160 70 M240 78 L240 70" stroke={ink} strokeWidth={2.4} />
      </g>

      {/* Flag */}
      <g className="stadium__flag">
        <path d="M292 96 L292 58" stroke={ink} strokeWidth={2.2} />
        <path className="stadium__flag-cloth" d="M292 58 q10 -4 20 0 q-2 6 0 12 q-10 -4 -20 0 Z" fill={primary} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      </g>

      {/* Pitch + fence */}
      <path d="M0 150 L400 150 L400 220 L0 220 Z" fill="url(#st-pitch)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${i * 100 - 20} 150 L${i * 100 + 30} 150 L${i * 100 + 70} 220 L${i * 100 + 10} 220 Z`} fill="#FFF" opacity={0.04} />
      ))}
      <path d="M0 176 Q200 160 400 176" stroke="#FFF7E9" strokeOpacity={0.55} strokeWidth={2} fill="none" />
      <path d="M0 150 L400 150" stroke={ink} strokeWidth={3} />
      {Array.from({ length: 21 }, (_, i) => (
        <path key={i} d={`M${i * 20} 150 L${i * 20} 140`} stroke="#9FB0CF" strokeWidth={2} />
      ))}
      <path d="M0 142 L400 142" stroke="#9FB0CF" strokeWidth={2} />
    </svg>
  );
}
