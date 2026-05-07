'use client'

/**
 * MessageBubble — renders a single message in the message list.
 *
 * Own messages get a subtle bg-primary-50 tint (not right-aligned — Slack-style).
 * Consecutive messages from the same author within 5 min collapse avatar/name.
 * Content is plain text only (markdown deferred to Phase 27).
 */

import { MessageSquareText } from 'lucide-react'
import type { MessageWithAuthor } from '@/lib/services/messageService'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: MessageWithAuthor
  isOwn: boolean
  showAvatar: boolean
  onThreadClick?: (messageId: string, message?: MessageWithAuthor) => void
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`

  // Fall back to short date
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessageBubble({
  message,
  isOwn,
  showAvatar,
  onThreadClick,
}: MessageBubbleProps) {
  const bgClass = isOwn
    ? 'bg-primary-50 rounded-xl px-3 py-2'
    : 'bg-white rounded-xl px-3 py-2'

  // Hover action: "Reply in thread"
  const threadAction = onThreadClick ? (
    <div className="absolute right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      <button
        type="button"
        onClick={() => onThreadClick(message.id, message)}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-200 shadow-sm text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
        title="Reply in thread"
      >
        <MessageSquareText className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Thread</span>
      </button>
    </div>
  ) : null

  // Collapsed message (same author, within 5 min) — reduced top margin, no avatar/name
  if (!showAvatar) {
    return (
      <div className="group relative flex gap-3 mt-0.5">
        {/* Spacer matching avatar width */}
        <div className="w-8 flex-shrink-0" />
        <div className={bgClass}>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {message.content}
          </p>
          {message.editedAt && (
            <span className="text-xs text-slate-400 ml-1">(edited)</span>
          )}
        </div>
        {threadAction}
      </div>
    )
  }

  return (
    <div className="group relative flex gap-3 mt-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-slate-200 flex items-center justify-center">
        {message.authorAvatar ? (
          <img
            src={message.authorAvatar}
            alt={message.authorName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <span className="text-xs font-medium text-slate-500">
            {getInitials(message.authorName)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Author name + timestamp */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-600">
            {message.authorName}
          </span>
          <span className="text-xs text-slate-400">
            {timeAgo(message.createdAt)}
          </span>
          {message.editedAt && (
            <span className="text-xs text-slate-400">(edited)</span>
          )}
        </div>

        {/* Message body */}
        <div className={bgClass}>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {message.content}
          </p>
        </div>

        {/* Thread link (shows reply count when replies exist) */}
        {message.replyCount > 0 && (
          <button
            type="button"
            className="text-xs text-primary-500 cursor-pointer mt-0.5 transition-colors duration-200 hover:text-primary-600"
            onClick={() => onThreadClick?.(message.id, message)}
          >
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {threadAction}
    </div>
  )
}
