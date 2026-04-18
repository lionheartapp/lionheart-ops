'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'

type ErrorCardVariant = 'widget' | 'page'

interface ErrorCardProps {
  /** Short noun phrase — e.g. "events", "inventory". The word "Failed to load " is prepended. */
  resource: string
  /** Full message. If provided, replaces the default "Failed to load {resource}" headline. */
  title?: string
  /** Optional detail line (e.g. parsed HTTP error copy). */
  message?: string
  /** Retry handler. When absent, no retry button is rendered. */
  onRetry?: () => void
  /** Visual density. `widget` fits inside a dashboard card; `page` takes the full page width. */
  variant?: ErrorCardVariant
}

/**
 * Shared retry / failure card.
 *
 * Audit ref M1: each page (dashboard, events, inventory, tickets) had its own
 * inline error card with slightly different copy, icons, and CTA sizing. This
 * is the one-place-for-failure-copy.
 *
 * Pair with `httpErrorMessage()` from `@/lib/errors/http-message` for the
 * `message` body so the category of failure is communicated consistently.
 */
export default function ErrorCard({
  resource,
  title,
  message,
  onRetry,
  variant = 'widget',
}: ErrorCardProps) {
  const headline = title ?? `Failed to load ${resource}`

  const wrapperClass =
    variant === 'page'
      ? 'flex flex-col items-center justify-center text-center min-h-[50vh] px-6'
      : 'flex flex-col items-center justify-center text-center py-12 px-4'

  const iconSize = variant === 'page' ? 'w-14 h-14' : 'w-12 h-12'
  const glyphSize = variant === 'page' ? 'w-7 h-7' : 'w-6 h-6'
  const titleClass =
    variant === 'page'
      ? 'text-lg font-semibold text-slate-800 mb-1'
      : 'text-base font-semibold text-slate-800 mb-1'

  return (
    <div role="alert" aria-live="polite" className={wrapperClass}>
      <div
        className={`${iconSize} rounded-full bg-red-50 flex items-center justify-center mb-3`}
        aria-hidden="true"
      >
        <AlertTriangle className={`${glyphSize} text-red-500`} />
      </div>
      <p className={titleClass}>{headline}</p>
      {message && <p className="text-xs text-slate-600 mb-4 max-w-xs">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  )
}
