'use client'

import { Loader2 } from 'lucide-react'

type LoadingVariant = 'inline' | 'section' | 'page'

interface LoadingStateProps {
  variant?: LoadingVariant
  label?: string
}

/**
 * Shared loading indicator.
 *
 * All variants announce themselves to assistive tech via role="status" +
 * aria-live="polite" so screen-reader users hear that the page is working.
 * The spinner icon is aria-hidden — the visible label does the talking.
 *
 * Audit refs: H3 (role=status missing on page/section variants), C2 (slate-400
 * label color failed AA contrast — bumped to slate-600 / slate-500).
 */
export default function LoadingState({
  variant = 'section',
  label = 'Loading…',
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-2 text-sm text-slate-600"
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>{label}</span>
      </span>
    )
  }

  if (variant === 'page') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center min-h-[60vh] text-slate-600"
      >
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-slate-500" aria-hidden="true" />
        <p className="text-sm">{label}</p>
      </div>
    )
  }

  // section (default)
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-16 text-slate-600"
    >
      <Loader2 className="w-6 h-6 animate-spin mb-3 text-slate-500" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
