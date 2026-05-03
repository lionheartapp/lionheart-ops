'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * F-016: canonical empty-state component.
 *
 * The codebase had ~6 distinct empty-state implementations across Inventory,
 * IT, Maintenance, Athletics, etc. — some had icons, some didn't, some had
 * CTAs, some were just faded text. This component is the single shared
 * version. New empty states should use it; the existing ones can migrate
 * over time (low-risk replacement, no breaking changes).
 *
 * Usage:
 *
 *   <EmptyState
 *     icon={Package}
 *     title="No inventory items yet"
 *     body="Add your first item to start tracking stock across departments."
 *     primaryAction={{ label: 'Add item', onClick: openCreate }}
 *     secondaryAction={{ label: 'Import CSV', href: '/inventory/import' }}
 *   />
 */

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

interface EmptyStateProps {
  /** Optional Lucide icon rendered in a soft circle above the title. */
  icon?: LucideIcon
  /** Optional custom illustration in place of the icon. */
  illustration?: ReactNode
  /** Headline — keep to ~6 words. */
  title: string
  /** Supporting text — keep to one or two sentences. */
  body?: string
  /** Primary call-to-action (filled). */
  primaryAction?: EmptyStateAction
  /** Secondary call-to-action (outline). */
  secondaryAction?: EmptyStateAction
  /** Override the default vertical spacing if needed. */
  className?: string
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: 'primary' | 'secondary'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'

  if (action.href) {
    return (
      <a href={action.href} className={`${base} ${styles}`}>
        {action.label}
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={`${base} ${styles}`}
    >
      {action.label}
    </button>
  )
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  body,
  primaryAction,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}
      role="status"
    >
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : Icon ? (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-slate-500" aria-hidden="true" />
        </div>
      ) : null}

      <h3 className="text-base font-semibold text-slate-900 mb-1.5">{title}</h3>

      {body && (
        <p className="text-sm text-slate-500 max-w-md mb-5">{body}</p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  )
}

export default EmptyState
