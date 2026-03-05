'use client'

import { type SVGProps } from 'react'

interface SportIconProps extends SVGProps<SVGSVGElement> {
  sport: string
  size?: number
}

function getSportKey(name: string): string {
  const n = name.toLowerCase().trim()
  if (n.includes('baseball')) return 'baseball'
  if (n.includes('softball')) return 'softball'
  if (n.includes('basketball')) return 'basketball'
  if (n.includes('soccer') || n.includes('futbol') || n.includes('fútbol')) return 'soccer'
  if (n.includes('volleyball')) return 'volleyball'
  if (n.includes('football')) return 'football'
  if (n.includes('track') || n.includes('cross country') || n.includes('xc')) return 'track'
  if (n.includes('tennis')) return 'tennis'
  if (n.includes('swim') || n.includes('water polo') || n.includes('diving')) return 'swimming'
  if (n.includes('golf')) return 'golf'
  if (n.includes('wrestl')) return 'wrestling'
  if (n.includes('lacrosse')) return 'lacrosse'
  if (n.includes('cheer')) return 'cheer'
  if (n.includes('hockey')) return 'hockey'
  if (n.includes('bowl')) return 'bowling'
  if (n.includes('gymnast')) return 'gymnastics'
  if (n.includes('rugby')) return 'rugby'
  if (n.includes('badminton') || n.includes('shuttlecock')) return 'badminton'
  return 'generic'
}

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export default function SportIcon({ sport, size, className, style, ...rest }: SportIconProps) {
  const key = getSportKey(sport)
  const Icon = ICONS[key] || ICONS.generic
  const sizeStyle = size ? { width: size, height: size } : {}
  return <Icon className={className} style={{ ...sizeStyle, ...style }} {...rest} />
}

/**
 * Glass tile container for sport icons — the Apple/Activeicons frosted look.
 * Wraps SportIcon in a glassmorphism container tinted with the sport's color.
 */
export function GlassSportTile({ sport, color, size = 'md' }: {
  sport: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const s = TILE_SIZES[size]
  return (
    <div
      className={`${s.container} border flex items-center justify-center flex-shrink-0 transition-transform duration-200`}
      style={{
        background: `linear-gradient(145deg, ${color}18, ${color}08)`,
        borderColor: `${color}25`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px ${color}10`,
      }}
    >
      <SportIcon sport={sport} size={s.icon} style={{ color }} />
    </div>
  )
}

const TILE_SIZES = {
  sm: { container: 'w-7 h-7 rounded-lg', icon: 14 },
  md: { container: 'w-9 h-9 rounded-xl', icon: 18 },
  lg: { container: 'w-11 h-11 rounded-xl', icon: 22 },
} as const

// ── SVG Sport Icons ─────────────────────────────────────────────────────

const ICONS: Record<string, (props: SVGProps<SVGSVGElement>) => React.JSX.Element> = {

  // Baseball — ball with curved stitching
  baseball: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 3.5C10 8 10 16 8.5 20.5" />
      <path d="M15.5 3.5C14 8 14 16 15.5 20.5" />
      <path d="M9 6l-.5.3M9.3 9l-.7.2M9.3 12l-.7-.1M9.1 15l-.6-.3M8.7 18l-.4-.4" />
      <path d="M15 6l.5.3M14.7 9l.7.2M14.7 12l.7-.1M14.9 15l.6-.3M15.3 18l.4-.4" />
    </svg>
  ),

  // Softball — same shape, slightly different stitching
  softball: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 3.5C10 8 10 16 8.5 20.5" />
      <path d="M15.5 3.5C14 8 14 16 15.5 20.5" />
    </svg>
  ),

  // Basketball — ball with seam lines
  basketball: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
      <path d="M5.2 5.2C8 8 8 16 5.2 18.8" />
      <path d="M18.8 5.2C16 8 16 16 18.8 18.8" />
    </svg>
  ),

  // Soccer — ball with pentagon pattern
  soccer: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8l3.5 2.5-1.3 4.2h-4.4L8.5 10.5Z" />
      <path d="M12 8V3.2" />
      <path d="M15.5 10.5l4.3-1.3" />
      <path d="M14.2 14.7l2.5 4.3" />
      <path d="M9.8 14.7l-2.5 4.3" />
      <path d="M8.5 10.5l-4.3-1.3" />
    </svg>
  ),

  // Volleyball — three curved panel seams
  volleyball: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3C11 8 7 11 3 12" />
      <path d="M21 12c-4 1-7 5-8 9" />
      <path d="M8.5 20.5C9 16 12.5 13 17 12.5" />
    </svg>
  ),

  // Football (American) — pointed oval with lacing
  football: (props) => (
    <svg {...BASE} {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-45 12 12)" />
      <path d="M8.5 8.5l7 7" />
      <path d="M10.3 9.2l-.7.7" />
      <path d="M11.8 10.7l-.7.7" />
      <path d="M13.3 12.2l-.7.7" />
      <path d="M14.8 13.7l-.7.7" />
    </svg>
  ),

  // Track & Field — running figure
  track: (props) => (
    <svg {...BASE} strokeWidth={1.75} {...props}>
      <circle cx="16" cy="4.5" r="2.5" />
      <path d="M13 7l-2 6" />
      <path d="M11 13l-4.5 6.5" />
      <path d="M11 13l5 5.5" />
      <path d="M12.5 9l4.5-2" />
      <path d="M12 11l-4.5 1" />
    </svg>
  ),

  // Tennis — racket with ball
  tennis: (props) => (
    <svg {...BASE} {...props}>
      <ellipse cx="10" cy="8.5" rx="5.5" ry="6.5" />
      <path d="M14.5 13.5L19 20" />
      <path d="M10 2v13" />
      <path d="M4.5 8.5h11" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  ),

  // Swimming — horizontal figure with waves
  swimming: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="19" cy="6.5" r="2" />
      <path d="M17 8l-10 2.5" />
      <path d="M9 10.5L5.5 7.5" />
      <path d="M15 9l2 2.5" />
      <path d="M2 16q2-2 4 0t4 0 4 0 4 0 4 0" />
      <path d="M2 20q2-2 4 0t4 0 4 0 4 0 4 0" />
    </svg>
  ),

  // Golf — flag and ball
  golf: (props) => (
    <svg {...BASE} {...props}>
      <path d="M12 3v17" />
      <path d="M12 3l8 4-8 4" fill="currentColor" fillOpacity="0.12" />
      <path d="M12 3l8 4-8 4" />
      <circle cx="7" cy="19" r="2.5" />
    </svg>
  ),

  // Wrestling — two grappling figures
  wrestling: (props) => (
    <svg {...BASE} strokeWidth={1.75} {...props}>
      <circle cx="8" cy="4.5" r="2" />
      <circle cx="16" cy="4.5" r="2" />
      <path d="M8 6.5v4l-2.5 5.5" />
      <path d="M8 10.5l2.5 5.5" />
      <path d="M16 6.5v4l2.5 5.5" />
      <path d="M16 10.5l-2.5 5.5" />
      <path d="M9 8.5h6" />
    </svg>
  ),

  // Lacrosse — stick with pocket
  lacrosse: (props) => (
    <svg {...BASE} {...props}>
      <path d="M7 21l7-14" />
      <path d="M14 7c1.5-3 4-3.5 5-2s0 4.5-2.5 5.5c-1.5.5-2.5 0-3.5-.5" />
      <path d="M14.5 8l1 2.5" />
      <circle cx="16" cy="7" r="1.2" fill="currentColor" fillOpacity="0.2" />
    </svg>
  ),

  // Cheerleading — megaphone
  cheer: (props) => (
    <svg {...BASE} {...props}>
      <path d="M3 10h2.5l11-4v12l-11-4H3z" />
      <path d="M3 10v4" />
      <path d="M19 9.5c1.2 1.2 1.2 3.8 0 5" />
      <path d="M21 7.5c2 2 2 7 0 9" />
    </svg>
  ),

  // Field Hockey — stick and ball
  hockey: (props) => (
    <svg {...BASE} {...props}>
      <path d="M6 3l2 13" />
      <path d="M8 16c0 2.5 4 3.5 6 2" />
      <circle cx="16" cy="18" r="2.5" />
    </svg>
  ),

  // Bowling — ball and pin
  bowling: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="8" cy="16.5" r="4.5" />
      <circle cx="6.5" cy="14.5" r="0.6" fill="currentColor" />
      <circle cx="9" cy="14" r="0.6" fill="currentColor" />
      <circle cx="7.5" cy="16.5" r="0.6" fill="currentColor" />
      <path d="M16.5 5.5a2.5 2.5 0 11-2 0c-.2-1.5.3-2.8 1-4 .7 1.2 1.2 2.5 1 4z" />
      <rect x="14" y="5.5" width="3" height="4" rx="0.5" />
    </svg>
  ),

  // Gymnastics — figure on beam
  gymnastics: (props) => (
    <svg {...BASE} strokeWidth={1.75} {...props}>
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v5" />
      <path d="M12 11l-4 6" />
      <path d="M12 11l4 6" />
      <path d="M8 8l8 0" />
      <path d="M4 20h16" />
    </svg>
  ),

  // Rugby — rugby ball
  rugby: (props) => (
    <svg {...BASE} {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" transform="rotate(-30 12 12)" />
      <path d="M6.5 6.5l11 11" />
      <path d="M9 8l-.6.6" />
      <path d="M11 10l-.6.6" />
      <path d="M13 12l-.6.6" />
      <path d="M15 14l-.6.6" />
    </svg>
  ),

  // Badminton — shuttlecock
  badminton: (props) => (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="16" r="3" />
      <path d="M10 13.5L6 4" />
      <path d="M14 13.5L18 4" />
      <path d="M12 13V4" />
      <path d="M6 4h12" />
    </svg>
  ),

  // Generic — trophy fallback
  generic: (props) => (
    <svg {...BASE} {...props}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M17 3H7v4c0 3.5 2.5 5.5 5 6 2.5-.5 5-2.5 5-6V3z" />
      <path d="M7 5H4c0 2.5 1.5 4 3 4" />
      <path d="M17 5h3c0 2.5-1.5 4-3 4" />
    </svg>
  ),
}
