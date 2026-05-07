'use client'

/**
 * MessageBubble — renders a single message in the message list.
 *
 * Own messages get a subtle bg-primary-50 tint (not right-aligned — Slack-style).
 * Consecutive messages from the same author within 5 min collapse avatar/name.
 * Content is plain text only (markdown deferred to Phase 27).
 */

import type { MessageWithAuthor } from '@/lib/services/messageService'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: MessageWithAuthor
  isOwn: boolean
  showAvatar: boolean
  onThreadClick?: (messageId: string) => void
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

  // Collapsed message (same author, within 5 min) — reduced top margin, no avatar/name
  if (!showAvatar) {
    return (
      <div className="flex gap-3 mt-0.5">
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
      </div>
    )
  }

  return (
    <div className="flex gap-3 mt-3">
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

        {/* Thread link */}
        {message.replyCount > 0 && (
          <button
            type="button"
            className="text-xs text-primary-500 cursor-pointer mt-0.5 transition-colors duration-200 hover:text-primary-600"
            onClick={() => onThreadClick?.(message.id)}
          >
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
    </div>
  )
}
