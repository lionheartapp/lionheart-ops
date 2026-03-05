'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { type ReactNode } from 'react'
import { staggerContainer, listItem } from '@/lib/animations'

interface StaggerListProps {
  children: ReactNode
  className?: string
  /** HTML element for the list container */
  as?: 'ul' | 'ol' | 'div'
  /** Stagger delay between items (default 0.04) */
  stagger?: number
  /** Unique key to trigger re-animation on content change */
  animationKey?: string
}

/**
 * Wraps a list of items with staggered entrance animations.
 * Each direct child should be a StaggerItem or motion element with `listItem` variants.
 */
export default function StaggerList({
  children,
  className,
  as = 'div',
  stagger = 0.04,
  animationKey,
}: StaggerListProps) {
  const Component = motion[as] as typeof motion.div

  return (
    <Component
      key={animationKey}
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer(stagger)}
    >
      {children}
    </Component>
  )
}

/**
 * Individual list item with fade-up entrance animation.
 */
export function StaggerItem({
  children,
  className,
  onClick,
  role,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  role?: string
}) {
  return (
    <motion.div
      className={className}
      variants={listItem}
      onClick={onClick}
      role={role}
    >
      {children}
    </motion.div>
  )
}

/**
 * Animated list item that can enter/exit with layout animation.
 * Use inside AnimatePresence for items that can be added/removed.
 */
export function AnimatedListItem({
  children,
  className,
  itemKey,
  onClick,
}: {
  children: ReactNode
  className?: string
  itemKey: string
  onClick?: () => void
}) {
  return (
    <motion.div
      key={itemKey}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
