'use client'

import { motion, MotionConfig } from 'framer-motion'
import { type ReactNode } from 'react'
import { staggerContainer, EASE_OUT_CUBIC } from '@/lib/animations'

interface PageTransitionProps {
  children: ReactNode
  className?: string
  /** Stagger delay between child elements (default 0.06) */
  stagger?: number
}

/**
 * Wraps page content with a fade-in + stagger animation.
 * Respects reduced-motion preferences.
 */
export default function PageTransition({ children, className, stagger = 0.06 }: PageTransitionProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial="hidden"
        animate="visible"
        variants={staggerContainer(stagger, 0.05)}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}

/**
 * Individual animated item within a PageTransition.
 * Use as a direct child of PageTransition for staggered entrance.
 */
export function PageItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
