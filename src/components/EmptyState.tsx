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
      className="text-center py-16 text-gray-400"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
      <p className="text-sm mb-1">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mb-3">{description}</p>
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
