/**
 * Shared animation variants and utilities for Framer Motion.
 * Import these across the app for consistent, polished animations.
 */
import type { Variants, Transition } from 'framer-motion'

// ─── Easing ────────────────────────────────────────────────────────
export const EASE_OUT_CUBIC = [0.25, 0.1, 0.25, 1] as const
export const EASE_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24 }

// ─── Fade + slide variants ─────────────────────────────────────────
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
}

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

// ─── Stagger container ─────────────────────────────────────────────
export function staggerContainer(stagger = 0.05, delayChildren = 0): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: stagger, delayChildren },
    },
  }
}

// ─── List item (for staggered lists/tables) ────────────────────────
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
}

// ─── Card entrance ─────────────────────────────────────────────────
export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
}

// ─── Tab crossfade ─────────────────────────────────────────────────
export const tabContent: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

// ─── Dropdown/popover ──────────────────────────────────────────────
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
}

// ─── Page transition ───────────────────────────────────────────────
export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
}

// ─── Notification badge pop ────────────────────────────────────────
export const badgePop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 500, damping: 15 },
  },
}

// ─── Toast animations ──────────────────────────────────────────────
export const toastSlideIn: Variants = {
  hidden: { opacity: 0, x: 80, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    x: 80,
    scale: 0.95,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

// ─── Sidebar section expand ────────────────────────────────────────
export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}

// ─── Button micro-interaction defaults ─────────────────────────────
export const buttonTap = { scale: 0.97 }
export const buttonHover = { scale: 1.02 }

// ─── Shared transition presets ─────────────────────────────────────
export const quickTransition: Transition = { duration: 0.15, ease: 'easeOut' }
export const normalTransition: Transition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
export const slowTransition: Transition = { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }
