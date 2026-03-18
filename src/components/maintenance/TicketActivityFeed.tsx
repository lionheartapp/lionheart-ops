'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  MessageSquare,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Lock,
  Loader2,
  Send,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { listItem, staggerContainer } from '@/lib/animations'
import { IllustrationMaintenance } from '@/components/illustrations'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActivityType =
  | 'STATUS_CHANGE'
  | 'COMMENT'
  | 'ASSIGNMENT'
  | 'INTERNAL_NOTE'
  | 'PHOTO_ADDED'

interface Actor {
  id: string
  firstName: string
  lastName: string
}

interface Activity {
  id: string
  type: ActivityType
  content: string | null
  isInternal: boolean
  fromStatus?: string | null
  toStatus?: string | null
  createdAt: string
  actor: Actor | null
  assignedTo?: Actor | null
}

interface TicketActivityFeedProps {
  ticketId: string
  isPrivileged: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-slate-100 text-slate-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-pink-100 text-pink-700',
  DONE: 'bg-primary-100 text-primary-700',
  CANCELLED: 'bg-slate-100 text-slate-400',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getActivityIcon(type: ActivityType, isInternal: boolean) {
  if (isInternal) return <Lock className="w-3.5 h-3.5 text-white" />
  switch (type) {
    case 'STATUS_CHANGE': return <RefreshCw className="w-3.5 h-3.5 text-white" />
    case 'COMMENT': return <MessageSquare className="w-3.5 h-3.5 text-white" />
    case 'ASSIGNMENT': return <UserCheck className="w-3.5 h-3.5 text-white" />
    case 'PHOTO_ADDED': return <MessageSquare className="w-3.5 h-3.5 text-white" />
    default: return <MessageSquare className="w-3.5 h-3.5 text-white" />
  }
}

function getActivityDotColor(type: ActivityType, isInternal: boolean): string {
  if (isInternal) return 'bg-purple-500'
  switch (type) {
    case 'STATUS_CHANGE': return 'bg-blue-500'
    case 'COMMENT': return 'bg-primary-500'
    case 'ASSIGNMENT': return 'bg-orange-500'
    case 'PHOTO_ADDED': return 'bg-teal-500'
    default: return 'bg-slate-400'
  }
}

function actorName(actor: Actor | null): string {
  if (!actor) return 'System'
  return `${actor.firstName} ${actor.lastName}`.trim() || 'Unknown'
}

function getInitials(actor: Actor | null): string {
  if (!actor) return 'S'
  const f = actor.firstName?.[0] ?? ''
  const l = actor.lastName?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

// ─── Activity Entry ───────────────────────────────────────────────────────────

function ActivityEntry({ activity }: { activity: Activity }) {
  const dotColor = getActivityDotColor(activity.type, activity.isInternal)
  const icon = getActivityIcon(activity.type, activity.isInternal)
  const name = actorName(activity.actor)

  return (
    <motion.div variants={listItem} className="flex gap-3">
      {/* Left: icon dot */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full ${dotColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          {icon}
        </div>
        {/* Connecting line — rendered by parent */}
      </div>

      {/* Right: content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Actor avatar */}
            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
              {getInitials(activity.actor)}
            </div>
            <span className="text-sm font-medium text-slate-900">{name}</span>
            {activity.isInternal && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                <Lock className="w-2.5 h-2.5" />
                Internal
              </span>
            )}
          </div>
          <time
            dateTime={activity.createdAt}
            title={formatAbsolute(activity.createdAt)}
            className="text-xs text-slate-400 flex-shrink-0 mt-0.5 cursor-help"
          >
            {formatRelative(activity.createdAt)}
          </time>
        </div>

        {/* Activity body */}
        {activity.type === 'STATUS_CHANGE' ? (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {activity.fromStatus && (
              <>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[activity.fromStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                  {STATUS_LABELS[activity.fromStatus] ?? activity.fromStatus}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
              </>
            )}
            {activity.toStatus && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[activity.toStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_LABELS[activity.toStatus] ?? activity.toStatus}
              </span>
            )}
            {activity.content && (
              <p className="text-xs text-slate-500 mt-1 w-full">{activity.content}</p>
            )}
          </div>
        ) : activity.type === 'ASSIGNMENT' ? (
          <div className="mt-1.5">
            <p className="text-sm text-slate-600">{activity.content}</p>
          </div>
        ) : (
          <div className={`mt-1.5 rounded-xl px-3 py-2 text-sm text-slate-700 ${activity.isInternal ? 'bg-purple-50/60 border border-purple-100' : 'bg-slate-50 border border-slate-100'}`}>
            {activity.content}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketActivityFeed({ ticketId, isPrivileged }: TicketActivityFeedProps) {
  const queryClient = useQueryClient()
  const feedRef = useRef<HTMLDivElement>(null)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['maintenance-ticket-activities', ticketId],
    queryFn: () => fetchApi<Activity[]>(`/api/maintenance/tickets/${ticketId}/activities`),
    staleTime: 30 * 1000,
  })

  // Auto-scroll on new activity
  useEffect(() => {
    if (feedRef.current && activities.length > 0) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [activities.length])

  const commentMutation = useMutation({
    mutationFn: async () => {
      return fetchApi<Activity>(`/api/maintenance/tickets/${ticketId}/activities`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: comment.trim(), isInternal }),
      })
    },
    onSuccess: () => {
      setComment('')
      setIsInternal(false)
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket-activities', ticketId] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-200 rounded w-1/3" />
              <div className="h-10 bg-slate-100 rounded-xl w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* Feed */}
      <div ref={feedRef} className="max-h-[480px] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <IllustrationMaintenance className="w-32 h-24 mx-auto mb-1" />
            <p className="text-sm text-slate-400">No activity yet — actions and comments will appear here.</p>
          </div>
        ) : (
          <motion.div
            className="relative"
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.04, 0)}
          >
            {/* Vertical line behind entries */}
            <div className="absolute left-3.5 top-3.5 bottom-0 w-px bg-slate-100" aria-hidden />
            {activities.map((activity) => (
              <ActivityEntry key={activity.id} activity={activity} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Comment box */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus:border-primary-400 placeholder:text-slate-400 transition-colors"
        />

        <div className="flex items-center justify-between gap-3">
          {/* Internal note checkbox — techs / head only */}
          {isPrivileged && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus-visible:ring-purple-400 cursor-pointer"
              />
              <Lock className="w-3 h-3 text-purple-500" />
              Internal note (not visible to submitter)
            </label>
          )}
          {!isPrivileged && <div />}

          <button
            onClick={() => commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {commentMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Post
          </button>
        </div>

        {commentMutation.isError && (
          <p className="text-xs text-red-600">Failed to post comment. Please try again.</p>
        )}
      </div>
    </div>
  )
}
