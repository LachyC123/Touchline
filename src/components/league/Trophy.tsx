import { useId } from 'react';
import './league-bits.css';

/**
 * Original vector silverware: a two-handled league cup for champions, and a promotion pennant
 * on a pole for going up. Ribbons take the club's kit colours.
 */
export function Trophy({ kind, ribbon, trim, size = 132 }: { kind: 'cup' | 'pennant' | 'jug'; ribbon: string; trim: string; size?: number }) {
  const id = useId().replace(/:/g, '');
  if (kind === 'jug') {
    return (
      <svg className="trophy trophy--jug" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="County Cup">
        <defs>
          <linearGradient id={`${id}-silver`} x1="0" x2="1">
            <stop offset="0" stopColor="#8E9AAE" />
            <stop offset="0.35" stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#D5DCE8" />
            <stop offset="1" stopColor="#7C889C" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="113" rx="30" ry="5" fill="rgb(0 0 0 / 0.3)" />
        {/* big ear handles */}
        <path d="M40 34 C18 30 16 62 42 66" fill="none" stroke="#1B2235" strokeWidth="9" strokeLinecap="round" />
        <path d="M80 34 C102 30 104 62 78 66" fill="none" stroke="#1B2235" strokeWidth="9" strokeLinecap="round" />
        <path d="M40 34 C18 30 16 62 42 66" fill="none" stroke={`url(#${id}-silver)`} strokeWidth="5" strokeLinecap="round" />
        <path d="M80 34 C102 30 104 62 78 66" fill="none" stroke={`url(#${id}-silver)`} strokeWidth="5" strokeLinecap="round" />
        {/* lid and finial */}
        <circle cx="60" cy="9" r="5" fill={`url(#${id}-silver)`} stroke="#1B2235" strokeWidth="2.5" />
        <path d="M44 22 C46 13 74 13 76 22 Z" fill={`url(#${id}-silver)`} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
        {/* body */}
        <path d="M40 22 H80 C82 48 76 70 60 76 C44 70 38 48 40 22 Z" fill={`url(#${id}-silver)`} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
        <path d="M54 76 H66 L65 88 H55 Z" fill={`url(#${id}-silver)`} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
        <path d="M42 88 H78 L82 106 H38 Z" fill="#23395D" stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
        {/* ribbons in club colours */}
        <path d="M42 30 L30 64 L38 60 L40 70 L48 32 Z" fill={ribbon} stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
        <path d="M78 30 L90 64 L82 60 L80 70 L72 32 Z" fill={trim} stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
        <path d="M60 36 l3 6 6.6.9-4.8 4.6 1.2 6.6L60 51l-6 3.1 1.2-6.6-4.8-4.6 6.6-.9Z" fill="#F4C653" stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
        <path className="trophy__glint" d="M46 26 Q47 50 56 68" fill="none" stroke="rgb(255 255 255 / 0.85)" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'pennant') {
    return (
      <svg className="trophy trophy--pennant" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Promotion pennant">
        <defs>
          <linearGradient id={`${id}-pole`} x1="0" x2="1">
            <stop offset="0" stopColor="#C8932A" />
            <stop offset="0.5" stopColor="#FFE9A3" />
            <stop offset="1" stopColor="#C8932A" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="112" rx="26" ry="5" fill="rgb(0 0 0 / 0.3)" />
        <rect x="27" y="10" width="6" height="100" rx="3" fill={`url(#${id}-pole)`} />
        <circle cx="30" cy="10" r="6" fill="#F4C653" stroke="#1B2235" strokeWidth="2" />
        <g className="trophy__flag">
          <path d="M33 18 C60 14 80 26 106 22 L94 44 L106 66 C80 70 60 58 33 62 Z" fill={ribbon} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
          <path d="M33 54 C60 50 80 62 102 58" fill="none" stroke={trim} strokeWidth="4" strokeLinecap="round" />
          <path d="M58 46 L68 30 L78 46 L71 46 L71 54 L65 54 L65 46 Z" fill={trim} stroke="#1B2235" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  return (
    <svg className="trophy trophy--cup" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="League trophy">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" x2="1">
          <stop offset="0" stopColor="#B57F1F" />
          <stop offset="0.35" stopColor="#FFE9A3" />
          <stop offset="0.55" stopColor="#F4C653" />
          <stop offset="1" stopColor="#B57F1F" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="113" rx="32" ry="5" fill="rgb(0 0 0 / 0.3)" />
      {/* handles */}
      <path d="M30 26 C10 26 10 56 36 60" fill="none" stroke="#1B2235" strokeWidth="9" strokeLinecap="round" />
      <path d="M90 26 C110 26 110 56 84 60" fill="none" stroke="#1B2235" strokeWidth="9" strokeLinecap="round" />
      <path d="M30 26 C10 26 10 56 36 60" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M90 26 C110 26 110 56 84 60" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinecap="round" />
      {/* bowl, stem, base */}
      <path d="M26 16 H94 C94 50 80 68 60 70 C40 68 26 50 26 16 Z" fill={`url(#${id}-gold)`} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
      <path d="M52 70 H68 L66 86 H54 Z" fill={`url(#${id}-gold)`} stroke="#1B2235" strokeWidth="3" strokeLinejoin="round" />
      <rect x="38" y="86" width="44" height="20" rx="4" fill="#23395D" stroke="#1B2235" strokeWidth="3" />
      <rect x="46" y="91" width="28" height="10" rx="2" fill={`url(#${id}-gold)`} />
      {/* ribbons in club colours */}
      <path d="M36 22 L28 48 L36 44 L40 52 L44 24 Z" fill={ribbon} stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
      <path d="M84 22 L92 48 L84 44 L80 52 L76 24 Z" fill={trim} stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 28 l4.2 8.6 9.4 1.3-6.8 6.6 1.6 9.4L60 49.5l-8.4 4.4 1.6-9.4-6.8-6.6 9.4-1.3Z" fill="#FFF7E9" stroke="#1B2235" strokeWidth="2" strokeLinejoin="round" />
      <path className="trophy__glint" d="M36 20 Q38 44 50 60" fill="none" stroke="rgb(255 255 255 / 0.75)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
