'use client'

import { motion } from 'framer-motion'
import { cardEntrance } from '@/lib/animations'

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-100 text-gray-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-orange-100 text-orange-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA: 'QA Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial',
  IT_AV: 'IT / A/V',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

function relativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

interface MaintenanceTicketLite {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  category: string
  createdAt: string | Date
  assignedTo?: { firstName: string; lastName: string } | null
  building?: { name: string } | null
  area?: { name: string } | null
  room?: { displayName: string | null; roomNumber: string | null } | null
  asset?: {
    repeatAlertSentAt?: string | Date | null
    costAlertSentAt?: string | Date | null
    eolAlertSentAt?: string | Date | null
  } | null
}

interface TicketCardProps {
  ticket: MaintenanceTicketLite
}

export default function TicketCard({ ticket }: TicketCardProps) {
  const locationParts = [
    ticket.building?.name,
    ticket.area?.name,
    ticket.room?.displayName || ticket.room?.roomNumber,
  ].filter(Boolean)

  const hasAssetAlerts = ticket.asset && (
    ticket.asset.repeatAlertSentAt ||
    ticket.asset.costAlertSentAt ||
    ticket.asset.eolAlertSentAt
  )

  return (
    <motion.a
      href={`/maintenance/tickets/${ticket.id}`}
      variants={cardEntrance}
      className="relative block ui-glass-hover rounded-2xl p-4 cursor-pointer no-underline"
    >
      {/* Asset alert pulse dot */}
      {hasAssetAlerts && (
        <span
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-white animate-pulse"
          title="Asset has active alerts"
        />
      )}

      {/* Ticket number */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-400 font-medium">{ticket.ticketNumber}</span>
        <span className="text-xs text-gray-400">{relativeTime(ticket.createdAt)}</span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-gray-900 mb-3 line-clamp-2 leading-snug">
        {ticket.title}
      </h4>

      {/* Location */}
      {locationParts.length > 0 && (
        <p className="text-xs text-gray-500 mb-3 truncate">
          {locationParts.join(' › ')}
        </p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABELS[ticket.status] || ticket.status}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
          {ticket.priority.charAt(0) + ticket.priority.slice(1).toLowerCase()}
        </span>
        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
          {CATEGORY_LABELS[ticket.category] || ticket.category}
        </span>
      </div>

      {/* Assigned tech */}
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-xs text-gray-500 font-medium">
            {ticket.assignedTo
              ? (ticket.assignedTo.firstName[0] + ticket.assignedTo.lastName[0]).toUpperCase()
              : '?'}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {ticket.assignedTo
            ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
            : 'Unassigned'}
        </span>
      </div>
    </motion.a>
  )
}
