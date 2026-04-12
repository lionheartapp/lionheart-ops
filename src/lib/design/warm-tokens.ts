/**
 * Warm editorial design tokens (Cal.com / Notion / Superhuman inspired)
 *
 * Single source of truth for the warm monochrome aesthetic used across the
 * events area. Import these wherever you need the cream surface, warm chips,
 * muted text hierarchy, or the near-black primary pill.
 *
 * Reference implementation: src/components/dashboard/UpcomingEventsPanel.tsx
 */

// ─── Surface + structure ─────────────────────────────────────────────────────

export const SURFACE = '#fdfcfb'
export const BORDER = 'rgba(17, 15, 10, 0.06)'
export const HAIRLINE = 'rgba(17, 15, 10, 0.05)'

// ─── Text hierarchy ──────────────────────────────────────────────────────────

export const TEXT_PRIMARY = '#1a1915'
export const TEXT_SECONDARY = '#6a6864'
export const TEXT_MUTED = '#a8a49d'

// ─── Warm chip / hover states ────────────────────────────────────────────────

export const WARM_CHIP = '#f6f4f0'
export const WARM_CHIP_HOVER = '#ede9e0'
export const WARM_HOVER_BG = '#f8f6f2'

// ─── Card shadow (multi-layer soft) ──────────────────────────────────────────

export const CARD_SHADOW =
  '0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'

export const BUTTON_SHADOW =
  '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)'

// ─── Status accent colors (warm, desaturated) ───────────────────────────────

export const STATUS_ACCENT: Record<string, string> = {
  DRAFT: '#a8a49d',
  PENDING_APPROVAL: '#c28840',
  CONFIRMED: '#3b7fbf',
  IN_PROGRESS: '#4d8a5c',
  COMPLETED: '#7c66a3',
  CANCELLED: '#b84a4a',
}

// ─── Common style object helpers ─────────────────────────────────────────────

export const warmCardStyle = {
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
  boxShadow: CARD_SHADOW,
} as const

export const warmPrimaryButtonStyle = {
  backgroundColor: TEXT_PRIMARY,
  color: '#ffffff',
  boxShadow: BUTTON_SHADOW,
} as const

export const warmSecondaryButtonStyle = {
  backgroundColor: WARM_CHIP,
  color: TEXT_PRIMARY,
} as const

// ─── Typography presets (for style={} use — Tailwind classes are preferred) ─

export const headingLetterSpacing = '-0.025em'
export const titleLetterSpacing = '-0.015em'
export const bodyLetterSpacing = '-0.005em'
