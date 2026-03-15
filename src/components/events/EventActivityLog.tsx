'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { staggerContainer, listItem } from '@/lib/animations'
import { useEventActivity, type EventActivityLog as ActivityEntry } from '@/lib/hooks/useEventProject'

// ─── Activity type display config ───────────────────────────────────────

const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Created', color: 'bg-blue-100 text-blue-700' },
  STATUS_CHANGE: { label: 'Status', color: 'bg-purple-100 text-purple-700' },
  UPDATED: { label: 'Updated', color: 'bg-gray-100 text-gray-700' },
  TASK_CREATED: { label: 'Task Added', color: 'bg-green-100 text-green-700' },
  TASK_UPDATED: { label: 'Task Updated', color: 'bg-yellow-100 text-yellow-700' },
  TASK_COMPLETED: { label: 'Task Done', color: 'bg-green-100 text-green-700' },
  TASK_DELETED: { label: 'Task Removed', color: 'bg-red-100 text-red-600' },
  SCHEDULE_BLOCK_ADDED: { label: 'Block Added', color: 'bg-blue-100 text-blue-700' },
  SCHEDULE_BLOCK_UPDATED: { label: 'Block Updated', color: 'bg-yellow-100 text-yellow-700' },
  SCHEDULE_BLOCK_REMOVED: { label: 'Block Removed', color: 'bg-red-100 text-red-600' },
  APPROVAL_GRANTED: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  APPROVAL_REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-600' },
  APPROVAL_SUBMITTED: { label: 'Submitted', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600' },
}

// ─── Description builder ─────────────────────────────────────────────────────

function buildDescription(entry: ActivityEntry): string {
  const details = entry.details as Record<string, unknown> | null
  switch (entry.action) {
    case 'CREATED':
      return 'created this event'
    case 'STATUS_CHANGE':
      if (details?.from && details?.to) {
        return `changed status from ${String(details.from).replace(/_/g, ' ').toLowerCase()} to ${String(details.to).replace(/_/g, ' ').toLowerCase()}`
      }
      return 'changed status'
    case 'UPDATED':
      return 'updated event details'
    case 'TASK_CREATED':
      return details?.title ? `added task: ${String(details.title)}` : 'added a task'
    case 'TASK_UPDATED':
      return details?.title ? `updated task: ${String(details.title)}` : 'updated a task'
    case 'TASK_COMPLETED':
      return details?.title ? `completed task: ${String(details.title)}` : 'completed a task'
    case 'TASK_DELETED':
      return details?.title ? `removed task: ${String(details.title)}` : 'removed a task'
    case 'SCHEDULE_BLOCK_ADDED':
      return details?.title ? `added schedule block: ${String(details.title)}` : 'added a schedule block'
    case 'SCHEDULE_BLOCK_UPDATED':
      return details?.title ? `updated schedule block: ${String(details.title)}` : 'updated a schedule block'
    case 'SCHEDULE_BLOCK_REMOVED':
      return details?.title ? `removed schedule block: ${String(details.title)}` : 'removed a schedule block'
    case 'APPROVAL_GRANTED':
      return 'approved this event'
    case 'APPROVAL_REJECTED':
      return 'rejected this event'
    case 'APPROVAL_SUBMITTED':
      return 'submitted for approval'
    case 'CONFIRMED':
      return 'confirmed this event'
    case 'CANCELLED':
      return 'cancelled this event'
    default:
      return entry.action.replace(/_/g, ' ').toLowerCase()
  }
}

// ─── Actor display ────────────────────────────────────────────────────────────

function ActorAvatar({ actor }: { actor: ActivityEntry['actor'] }) {
  const initials = actor?.firstName
    ? `${actor.firstName[0]}${actor.lastName?.[0] || ''}`.toUpperCase()
    : actor?.email?.[0]?.toUpperCase() || '?'

  const displayName = actor?.firstName
    ? `${actor.firstName} ${actor.lastName || ''}`.trim()
    : actor?.email || 'Unknown'

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
        {actor?.avatar ? (
          <img src={actor.avatar} alt={displayName} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-indigo-700">{initials}</span>
        )}
      </div>
      <span className="text-sm font-medium text-gray-900">{displayName}</span>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-start gap-3 py-2">
          <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EventActivityLogProps {
  eventProjectId: string
  limit?: number
}

export function EventActivityLog({ eventProjectId, limit }: EventActivityLogProps) {
  const { data: entries, isLoading } = useEventActivity(eventProjectId)

  if (isLoading) return <ActivitySkeleton />

  const displayed = limit ? (entries || []).slice(0, limit) : (entries || [])

  if (displayed.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
    )
  }

  return (
    <motion.div
      variants={staggerContainer(0.04)}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      {displayed.map((entry) => {
        const typeConfig = ACTIVITY_LABELS[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-600' }
        const description = buildDescription(entry)
        const timeAgo = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })

        return (
          <motion.div
            key={entry.id}
            variants={listItem}
            className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
          >
            <ActorAvatar actor={entry.actor} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${typeConfig.color}`}
                >
                  {typeConfig.label}
                </span>
                <span className="text-sm text-gray-700 truncate">{description}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
