'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      className="text-center py-16 text-slate-700"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/*
       * Icon stays at slate-300 — it's decorative. Title uses slate-700 (13.6:1
       * on white) and description uses slate-600 (7.2:1) so both meet WCAG AA
       * for body text even at small sizes. Fix for audit finding C2.
       */}
      <div className="flex justify-center mb-3 text-slate-300" aria-hidden="true">
        {icon}
      </div>
      <p className="text-sm mb-1 font-medium text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-600 mb-3">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="ui-btn-sm ui-btn-primary mt-1"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
