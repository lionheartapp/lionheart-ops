import { type ReactNode } from 'react'
import { Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { createElement } from 'react'

/**
 * Options for `getGreeting`.
 *
 * Audit ref L4: the original signature only returned an English string.
 * Consumers that wanted a different locale had to rewrite the helper inline,
 * and there was no way to test the evening-branch deterministically. The
 * `locale` + `now` options make the function i18n-ready and trivially unit-
 * testable while preserving the existing zero-arg call sites.
 */
export interface GetGreetingOptions {
  /** BCP 47 locale tag. Defaults to `'en-US'`. */
  locale?: string
  /** Override "now" — useful for tests. */
  now?: Date
}

const GREETINGS_BY_LOCALE: Record<string, [string, string, string]> = {
  'en-US': ['Good morning', 'Good afternoon', 'Good evening'],
  'en-GB': ['Good morning', 'Good afternoon', 'Good evening'],
  'es': ['Buenos días', 'Buenas tardes', 'Buenas noches'],
  'es-MX': ['Buenos días', 'Buenas tardes', 'Buenas noches'],
  'fr': ['Bonjour', 'Bon après-midi', 'Bonsoir'],
  'fr-FR': ['Bonjour', 'Bon après-midi', 'Bonsoir'],
  'de': ['Guten Morgen', 'Guten Tag', 'Guten Abend'],
  'it': ['Buongiorno', 'Buon pomeriggio', 'Buonasera'],
  'pt': ['Bom dia', 'Boa tarde', 'Boa noite'],
  'pt-BR': ['Bom dia', 'Boa tarde', 'Boa noite'],
}

/**
 * Returns a time-based greeting string. Defaults to English (morning /
 * afternoon / evening) but falls back through the locale hierarchy so
 * `'en-AU'` will use `'en-US'` copy if no exact match exists.
 */
export function getGreeting(options: GetGreetingOptions = {}): string {
  const { locale = 'en-US', now = new Date() } = options
  const hour = now.getHours()

  const baseLocale = locale.split('-')[0]
  const copy =
    GREETINGS_BY_LOCALE[locale] ||
    GREETINGS_BY_LOCALE[baseLocale] ||
    GREETINGS_BY_LOCALE['en-US']

  if (hour < 5) return copy[2]   // Late night (midnight–4:59 AM) → evening greeting
  if (hour < 12) return copy[0]  // Morning (5 AM–11:59 AM)
  if (hour < 18) return copy[1]  // Afternoon (12 PM–5:59 PM)
  return copy[2]                 // Evening (6 PM–11:59 PM)
}

/** Maps a ticket status string to a status icon (lucide-react component). */
export function getStatusIcon(status: string): ReactNode {
  switch (status) {
    case 'OPEN':
      return createElement(AlertCircle, { className: 'w-5 h-5 text-red-500', 'aria-hidden': 'true' })
    case 'IN_PROGRESS':
      return createElement(Clock, { className: 'w-5 h-5 text-primary-500', 'aria-hidden': 'true' })
    case 'RESOLVED':
      return createElement(CheckCircle, { className: 'w-5 h-5 text-green-500', 'aria-hidden': 'true' })
    default:
      return createElement(Clock, { className: 'w-5 h-5 text-slate-400', 'aria-hidden': 'true' })
  }
}

/** Maps a ticket status string to a human-readable label. */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN': return 'Open'
    case 'IN_PROGRESS': return 'In Progress'
    case 'RESOLVED': return 'Resolved'
    default: return status
  }
}

/** Maps a ticket priority string to Tailwind CSS classes. */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-700'
    case 'HIGH':
      return 'bg-red-100 text-red-700'
    case 'NORMAL':
      return 'bg-yellow-100 text-yellow-700'
    case 'LOW':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

/** Formats a date string as a relative date ("Today", "Yesterday", "3 days ago") or short date. */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
