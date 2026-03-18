'use client'

import { useState } from 'react'
import type { PlanningComment } from '@/lib/hooks/usePlanningSeason'

interface CommentThreadProps {
  comments: PlanningComment[]
  onAddComment: (message: string, isAdminOnly?: boolean) => void
  isSubmitting?: boolean
  isAdmin?: boolean
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function CommentThread({ comments, onAddComment, isSubmitting, isAdmin }: CommentThreadProps) {
  const [message, setMessage] = useState('')
  const [isAdminOnly, setIsAdminOnly] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    onAddComment(message.trim(), isAdminOnly)
    setMessage('')
    setIsAdminOnly(false)
  }

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {comments.map((comment) => (
            <div key={comment.id} className={`px-3 py-2 rounded-lg text-sm ${comment.isAdminOnly ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-slate-900 text-xs">
                  {comment.author.firstName} {comment.author.lastName}
                </span>
                <span className="text-xs text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
                {comment.isAdminOnly && <span className="text-xs text-amber-600 font-medium">Admin only</span>}
              </div>
              <p className="text-slate-700 text-sm">{comment.message}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
          disabled={isSubmitting}
        />
        {isAdmin && (
          <label className="flex items-center gap-1 text-xs text-slate-500">
            <input type="checkbox" checked={isAdminOnly} onChange={(e) => setIsAdminOnly(e.target.checked)} className="rounded" />
            Admin
          </label>
        )}
        <button type="submit" disabled={isSubmitting || !message.trim()} className="px-3 py-2 bg-slate-900 text-white text-xs font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 transition">
          Send
        </button>
      </form>
    </div>
  )
}
