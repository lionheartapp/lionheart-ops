import { type ReactNode } from 'react'
import { Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { createElement } from 'react'

/** Returns a time-based greeting string ("Good morning" / "Good afternoon" / "Good evening"). */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
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
