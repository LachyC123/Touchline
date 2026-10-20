import type { ReactNode } from 'react';
import type { TraitIcon } from '../../data/traits';
import type { Tier } from '../../domain/players/types';

/** One icon family: 24-unit grid, 2px round strokes, shared corner radius. */
export type IconName =
  | TraitIcon
  | 'club'
  | 'squad'
  | 'more'
  | 'scout'
  | 'whistle'
  | 'star'
  | 'starFilled'
  | 'back'
  | 'flip'
  | 'shirt'
  | 'download'
  | 'upload'
  | 'shield'
  | 'sound'
  | 'motion'
  | 'contrast'
  | 'text'
  | 'trash'
  | 'info'
  | 'check'
  | 'close'
  | 'sort'
  | 'bug'
  | 'pause'
  | 'play'
  | 'coin';

const PATHS: Record<IconName, ReactNode> = {
  bolt: <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />,
  boot: (
    <>
      <path d="M4 6h6v6l7 2.5a3 3 0 0 1 2 2.8V18H4V6Z" />
      <path d="M4 18v2M9 18v2M14 18v2M19 18v2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  needle: (
    <>
      <path d="M3 21 19 5" />
      <path d="m15 3 6 6" />
      <path d="M6 14l4 4" opacity="0.5" />
    </>
  ),
  wall: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 12h18M9 5v7M15 12v7" />
    </>
  ),
  lungs: (
    <>
      <path d="M12 4v8" />
      <path d="M12 10c-2 0-3-2-5-2-2.5 0-4 4-4 8 0 2.5 1.2 4 3 4 3 0 6-2 6-6" />
      <path d="M12 10c2 0 3-2 5-2 2.5 0 4 4 4 8 0 2.5-1.2 4-3 4-3 0-6-2-6-6" />
    </>
  ),
  glove: <path d="M7 21v-5L4 12.5a1.6 1.6 0 0 1 2.4-2.1L8 12V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6H7Z" />,
  cat: (
    <>
      <path d="M5 20V8l3-4 2 4h4l2-4 3 4v12" />
      <path d="M5 20h14" />
      <path d="M9.5 13v.5M14.5 13v.5M11 16.5h2" />
    </>
  ),
  pulse: <path d="M2 12h4l2-5 4 10 3-7 2 2h5" />,
  curve: (
    <>
      <path d="M4 20C6 10 12 5 20 5" />
      <circle cx="20" cy="5" r="2" />
      <path d="M4 20h3" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3 10v4h3l9 5V5L6 10H3Z" />
      <path d="M18 9a4 4 0 0 1 0 6" />
      <path d="M7 14v5h3" />
    </>
  ),
  feet: (
    <>
      <path d="M7 3c2 0 3 2.5 3 5.5S9 13 7 13s-3-1.5-3-4.5S5 3 7 3Z" />
      <path d="M17 9c2 0 3 2.5 3 5.5S19 19 17 19s-3-1.5-3-4.5S15 9 17 9Z" />
      <path d="M5 16h4M15 22h4" />
    </>
  ),
  club: (
    <>
      <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z" />
      <path d="M8 11h8M12 7v9" />
    </>
  ),
  squad: (
    <>
      <path d="M8 4 4 6l-2 5 3 1.5V20h14v-7.5l3-1.5-2-5-4-2c-.5 1.6-2 3-4 3S8.5 5.6 8 4Z" />
    </>
  ),
  shirt: <path d="M8 4 4 6l-2 5 3 1.5V20h14v-7.5l3-1.5-2-5-4-2c-.5 1.6-2 3-4 3S8.5 5.6 8 4Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  scout: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  whistle: (
    <>
      <path d="M3 13a5 5 0 1 0 10 0V9h8V6H8a5 5 0 0 0-5 5v2Z" />
      <circle cx="8" cy="13" r="1.4" fill="currentColor" />
    </>
  ),
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8L12 3Z" />,
  starFilled: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1-4.5-4.3 6.1-.8L12 3Z" fill="currentColor" />,
  back: <path d="M15 5 8 12l7 7" />,
  flip: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 17v3h16v-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V3M7 8l5-5 5 5" />
      <path d="M4 17v3h16v-3" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z" />,
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  motion: (
    <>
      <circle cx="15" cy="12" r="5" />
      <path d="M3 9h5M2 12h5M3 15h5" />
    </>
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16V4Z" fill="currentColor" />
    </>
  ),
  text: (
    <>
      <path d="M4 18 9 6l5 12M5.6 14h6.8" />
      <path d="M15 18l3-7 3 7M15.8 16h4.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  check: <path d="m5 12 5 5 9-10" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sort: <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </>
  ),
  play: <path d="M7 5v14l11-7L7 5Z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
    </>
  ),
  bug: (
    <>
      <rect x="7" y="7" width="10" height="13" rx="5" />
      <path d="M12 7V4M9 4l1.5 3M15 4l-1.5 3M3 12h4M17 12h4M4 18l3-2M20 18l-3-2" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 24, className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {PATHS[name]}
    </svg>
  );
}

/** Tier emblems differ by SHAPE, not just colour (accessibility rule). */
export function TierEmblem({ tier, size = 16, className }: { tier: Tier; size?: number; className?: string }) {
  const shapes: Record<Tier, ReactNode> = {
    street: <circle cx="12" cy="12" r="7" />,
    prospect: <path d="M12 4 20 18H4L12 4Z" />,
    breakout: <path d="M12 3 20 12 12 21 4 12 12 3Z" />,
    star: <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9L12 2.5Z" />,
    phenomenon: (
      <>
        <path d="M12 1.5 14 8l6.5-2.5L16.5 11 22.5 12l-6 1.5 4 5.5-6.5-2.5-2 6.5-2-6.5-6.5 2.5 4-5.5-6-1.5 6-1L3.5 5.5 10 8l2-6.5Z" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor" stroke="rgb(0 0 0 / 0.45)" strokeWidth={1.4} strokeLinejoin="round">
      {shapes[tier]}
    </svg>
  );
}
