'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { StatusBadge } from './ITStatusBadge'
import { Send, Lock, MessageSquare, ArrowRight, UserPlus } from 'lucide-react'

interface Activity {
  id: string
  type: string
  content: string | null
  isInternal: boolean
  fromStatus?: string | null
  toStatus?: string | null
  createdAt: string
  actor: { id: string; firstName: string; lastName: string; avatar?: string | null } | null
  assignedTo?: { id: string; firstName: string; lastName: string } | null
}

interface ITActivityFeedProps {
  ticketId: string
  isPrivileged: boolean
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'STATUS_CHANGE':
      return <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
    case 'ASSIGNMENT':
      return <UserPlus className="w-3.5 h-3.5 text-blue-500" />
    case 'INTERNAL_NOTE':
      return <Lock className="w-3.5 h-3.5 text-amber-500" />
    default:
      return <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
  }
}

function ActivityEntry({ activity }: { activity: Activity }) {
  const actorName = activity.actor
    ? `${activity.actor.firstName} ${activity.actor.lastName}`
    : 'System'

  return (
    <div className="flex gap-3 py-2.5">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
          <ActivityIcon type={activity.type} />
        </div>
        <div className="w-px flex-1 bg-slate-200/50 mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
          <span className="font-medium text-slate-700">{actorName}</span>
          <span>&middot;</span>
          <time>{new Date(activity.createdAt).toLocaleString()}</time>
          {activity.isInternal && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
              <Lock className="w-2.5 h-2.5" />
              Internal
            </span>
          )}
        </div>

        {activity.type === 'STATUS_CHANGE' && activity.fromStatus && activity.toStatus ? (
          <div className="flex items-center gap-2 text-sm">
            <StatusBadge status={activity.fromStatus} />
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <StatusBadge status={activity.toStatus} />
            {activity.content && (
              <span className="text-slate-600 text-xs ml-2">— {activity.content}</span>
            )}
          </div>
        ) : activity.type === 'ASSIGNMENT' && activity.assignedTo ? (
          <p className="text-sm text-slate-700">
            Assigned to <span className="font-medium">{activity.assignedTo.firstName} {activity.assignedTo.lastName}</span>
            {activity.content && <span className="text-slate-500"> — {activity.content}</span>}
          </p>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{activity.content}</p>
        )}
      </div>
    </div>
  )
}

export default function ITActivityFeed({ ticketId, isPrivileged }: ITActivityFeedProps) {
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: activities = [], isLoading } = useQuery({
    ...queryOptions.itTicketComments(ticketId),
    refetchInterval: 15_000,
  })

  // Auto-scroll to bottom on new activities
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activities])

  const postComment = useMutation({
    mutationFn: () =>
      fetch(`/api/it/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: comment.trim(), isInternal }),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to post comment')
        return r.json()
      }),
    onSuccess: () => {
      setComment('')
      setIsInternal(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.itTicketComments.byTicket(ticketId) })
    },
  })

  const typedActivities = activities as Activity[]

  return (
    <div className="flex flex-col h-full">
      {/* Activity list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 space-y-0.5">
        {isLoading ? (
          <div className="space-y-3 animate-pulse py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-4 w-48 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : typedActivities.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No activity yet</p>
        ) : (
          typedActivities.map((a) => <ActivityEntry key={a.id} activity={a} />)
        )}
      </div>

      {/* Comment form */}
      <div className="border-t border-slate-200/50 pt-3 mt-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && comment.trim()) {
                e.preventDefault()
                postComment.mutate()
              }
            }}
            placeholder={isInternal ? 'Add internal note...' : 'Add a comment...'}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
          />
          <button
            onClick={() => postComment.mutate()}
            disabled={!comment.trim() || postComment.isPending}
            className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {isPrivileged && (
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400/40"
            />
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Internal note (hidden from submitter)
            </span>
          </label>
        )}
      </div>
    </div>
  )
}
