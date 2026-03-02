'use client'

import { ReactNode } from 'react'

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
    <div className="text-center py-16 text-gray-400">
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
    </div>
  )
}
