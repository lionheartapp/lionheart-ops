/** Landing page design tokens — shared across all section components. */

export const TEXT_PRIMARY = '#0f0f0f'
export const TEXT_SECONDARY = '#5a5a5a'
export const TEXT_MUTED = '#9a9a9a'
export const BORDER = 'rgba(15, 15, 15, 0.08)'
export const BORDER_SOFT = 'rgba(15, 15, 15, 0.05)'
export const SURFACE_ALT = '#fafaf9'
export const SURFACE_WARM = '#fdfcfb'
export const DARK_SURFACE = '#0b0b0e'

export const CARD_SHADOW =
  '0 0 0 1px rgba(34,42,53,0.06), 0 0.8px 2.9px rgba(0,0,0,0.02), 0 2px 7.8px rgba(0,0,0,0.027), 0 4px 18px rgba(0,0,0,0.04)'
export const HERO_MOCKUP_SHADOW =
  '0 0 0 1px rgba(34,42,53,0.08), 0 30px 60px -20px rgba(15,15,15,0.18), 0 18px 36px -18px rgba(15,15,15,0.12)'

export const AI_GRADIENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%)'

/** Smooth "aurora" easing used across the page. */
export const EASE = [0.25, 0.1, 0.25, 1] as const

/** Reusable viewport trigger: fires once, ~80px before the section enters. */
export const REVEAL_VIEWPORT = { once: true, margin: '-80px' } as const

/** Standard fade-up variants for whole sections. */
export const REVEAL_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
} as const
