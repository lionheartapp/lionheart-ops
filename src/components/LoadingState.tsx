'use client'

import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  variant?: 'inline' | 'section' | 'page'
  label?: string
}

export default function LoadingState({
  variant = 'section',
  label = 'Loading...',
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        {label}
      </span>
    )
  }

  if (variant === 'page') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" aria-hidden="true" />
        <p className="text-sm">{label}</p>
      </div>
    )
  }

  // section (default)
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin mb-3" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
