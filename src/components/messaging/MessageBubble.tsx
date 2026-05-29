'use client'

/**
 * MessageBubble — renders a single message in the message list.
 *
 * Own messages get a subtle bg-primary-50 tint (not right-aligned -- Slack-style).
 * Consecutive messages from the same author within 5 min collapse avatar/name.
 * Shows reaction pills below message and pin/reaction actions on hover.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { MessageSquareText, Pin, MoreVertical, Pencil, Trash2, SmilePlus } from 'lucide-react'
import DOMPurify from 'dompurify'
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })
const EmojiPickerLazy = dynamic(() => import('./EmojiPicker'), { ssr: false })
import type { MessageWithAuthor } from '@/lib/services/messageService'
import type { ReactionGroup } from '@/lib/hooks/useReactions'
import ReactionBar from './ReactionBar'
import AttachmentPreview from './AttachmentPreview'
import BookingReferenceCard from './BookingReferenceCard'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: MessageWithAuthor
  isOwn: boolean
  showAvatar: boolean
  onThreadClick?: (messageId: string, message?: MessageWithAuthor) => void
  reactions?: ReactionGroup[]
  onReactionToggle?: (emoji: string) => void
  onPin?: (messageId: string) => void
  isPinned?: boolean
  onEdit?: (messageId: string) => void
  onEditSave?: (messageId: string, content: string) => void
  onEditCancel?: () => void
  isEditing?: boolean
  onDelete?: (messageId: string) => void
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
// Action bar with more dropdown
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Join Request system message with Accept / Deny buttons
// ---------------------------------------------------------------------------

function JoinRequestMessage({
  content,
  requestId,
  channelId,
  createdAt,
}: {
  content: string
  requestId: string
  channelId: string
  createdAt: string
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'approved' | 'denied'>('idle')

  async function handleAction(action: 'approve' | 'deny') {
    setStatus('loading')
    try {
      const res = await fetch(`/api/messaging/channels/${channelId}/join-request`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      })
      if (res.ok) {
        setStatus(action === 'approve' ? 'approved' : 'denied')
      } else {
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-4">
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-slate-200" />
        <p className="text-xs text-slate-500">
          <span dangerouslySetInnerHTML={{ __html: content }} />
          <span className="ml-2 text-slate-300">{timeAgo(createdAt)}</span>
        </p>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      {status === 'approved' ? (
        <span className="text-xs font-medium text-emerald-600">Approved</span>
      ) : status === 'denied' ? (
        <span className="text-xs font-medium text-slate-400">Declined</span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAction('approve')}
            disabled={status === 'loading'}
            className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-full cursor-pointer transition-colors disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => handleAction('deny')}
            disabled={status === 'loading'}
            className="px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full cursor-pointer transition-colors disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action bar with more dropdown
// ---------------------------------------------------------------------------

function ActionBar({
  message,
  isOwn,
  showPinIcon,
  onReactionToggle,
  onThreadClick,
  onPin,
  onEdit,
  onDelete,
}: {
  message: MessageWithAuthor
  isOwn: boolean
  showPinIcon: boolean
  onReactionToggle?: (emoji: string) => void
  onThreadClick?: (messageId: string, message?: MessageWithAuthor) => void
  onPin?: (messageId: string) => void
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuDropUp, setMenuDropUp] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [pickerDropDown, setPickerDropDown] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const reactionBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!showMenu) { setConfirmDelete(false); return }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
        setConfirmDelete(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowMenu(false)
        setConfirmDelete(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showMenu])

  return (
    <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
      <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm">
        {/* Add reaction */}
        {onReactionToggle && (
          <div className="relative">
            <button
              ref={reactionBtnRef}
              type="button"
              onClick={() => {
                if (!showReactionPicker && reactionBtnRef.current) {
                  const rect = reactionBtnRef.current.getBoundingClientRect()
                  // If button is in the top 40% of the viewport, open downward
                  setPickerDropDown(rect.top < window.innerHeight * 0.4)
                }
                setShowReactionPicker((prev) => !prev)
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors rounded-l-xl"
              title="Add reaction"
            >
              <SmilePlus className="w-5 h-5" />
            </button>
            {showReactionPicker && (
              <div className={`absolute right-0 z-50 ${pickerDropDown ? 'top-full mt-1' : 'bottom-full mb-1'}`}>
                <EmojiPickerLazy
                  onSelect={(emoji: string) => {
                    onReactionToggle(emoji)
                    setShowReactionPicker(false)
                  }}
                  onClose={() => setShowReactionPicker(false)}
                />
              </div>
            )}
          </div>
        )}
        {/* Reply in thread */}
        {onThreadClick && (
          <button
            type="button"
            onClick={() => onThreadClick(message.id, message)}
            className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors ${!onReactionToggle ? 'rounded-l-xl' : ''}`}
            title="Reply in thread"
          >
            <MessageSquareText className="w-5 h-5" />
          </button>
        )}
        {/* Pin */}
        {onPin && (
          <button
            type="button"
            onClick={() => onPin(message.id)}
            className={`w-9 h-9 flex items-center justify-center cursor-pointer transition-colors ${
              showPinIcon
                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title={showPinIcon ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-5 h-5" />
          </button>
        )}
        {/* More actions — only show if user has actions (own messages) */}
        {isOwn && (onEdit || onDelete) && (
          <div className="relative" ref={menuRef}>
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => {
                if (!showMenu && menuBtnRef.current) {
                  const rect = menuBtnRef.current.getBoundingClientRect()
                  setMenuDropUp(rect.bottom > window.innerHeight * 0.6)
                }
                setShowMenu((prev) => !prev)
              }}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors rounded-r-xl"
              title="More actions"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className={`absolute right-0 w-36 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20 ${
                menuDropUp ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => { onEdit(message.id); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors text-left"
                  >
                    <Pencil className="w-4 h-4 text-slate-400" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDelete) {
                        onDelete(message.id)
                        setShowMenu(false)
                        setConfirmDelete(false)
                      } else {
                        setConfirmDelete(true)
                      }
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors text-left ${
                      confirmDelete ? 'text-white bg-red-500 hover:bg-red-600' : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {confirmDelete ? 'Click to confirm' : 'Delete'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessageBubble({
  message,
  isOwn,
  showAvatar,
  onThreadClick,
  reactions = [],
  onReactionToggle,
  onPin,
  isPinned = false,
  onEdit,
  onEditSave,
  onEditCancel,
  isEditing = false,
  onDelete,
}: MessageBubbleProps) {
  const [editHtml, setEditHtml] = useState(message.content)
  // Reset edit content when entering edit mode
  useEffect(() => { if (isEditing) setEditHtml(message.content) }, [isEditing, message.content])
  const sanitizedContent = useMemo(() => {
    if (typeof window === 'undefined') return message.content
    return DOMPurify.sanitize(message.content, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'span', 'img'], ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-type', 'data-id', 'data-label', 'data-mention-suggestion-char', 'data-ref-type', 'data-status', 'src', 'alt'] })
  }, [message.content])
  // Detect emoji-only messages (1-3 emojis, no other text)
  const isEmojiOnly = useMemo(() => {
    const plain = sanitizedContent.replace(/<[^>]+>/g, '').trim()
    // Match 1-3 emoji characters with optional spaces, nothing else
    const emojiRegex = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}[\u{FE0F}]?(?:\u{200D}(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}[\u{FE0F}]?))*\s*){1,3}$/u
    return emojiRegex.test(plain)
  }, [sanitizedContent])

  const isBot = message.authorIsBot ?? false

  // System/bot messages render as centered announcements — no bubble, no avatar
  if (isBot) {
    // Check if this is a join request message with action buttons
    const joinRequestMatch = message.content.match(/\[join-request:([a-z0-9]+)\]/)
    const requestId = joinRequestMatch?.[1]
    const displayContent = sanitizedContent.replace(/\[join-request:[a-z0-9]+\]/g, '')

    if (requestId) {
      return (
        <JoinRequestMessage
          content={displayContent}
          requestId={requestId}
          channelId={message.channelId}
          createdAt={message.createdAt}
        />
      )
    }

    return (
      <div className="flex items-center gap-3 py-1.5 px-2">
        <div className="flex-1 h-px bg-slate-200" />
        <p className="text-xs text-slate-400 whitespace-nowrap">
          <span dangerouslySetInnerHTML={{ __html: displayContent }} />
          <span className="ml-2 text-slate-300">{timeAgo(message.createdAt)}</span>
        </p>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    )
  }

  const bgClass = isEmojiOnly
    ? 'py-1'
    : isOwn
      ? 'bg-primary-50 rounded-xl px-3 py-2'
      : 'bg-white rounded-xl px-3 py-2'

  const contentClass = isEmojiOnly
    ? 'text-4xl leading-tight'
    : 'text-sm text-slate-800 tiptap'

  const pinnedFromData = !!message.pinnedAt
  const showPinIcon = isPinned || pinnedFromData

  // Hover action bar — Slack-style floating toolbar
  const actionBar = (
    <ActionBar
      message={message}
      isOwn={isOwn}
      showPinIcon={showPinIcon}
      onReactionToggle={onReactionToggle}
      onThreadClick={onThreadClick}
      onPin={onPin}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  )

  // Reaction pills — only show when reactions exist (add button is in hover toolbar)
  const reactionSection = reactions.length > 0 ? (
    <ReactionBar
      reactions={reactions}
      messageId={message.id}
      onToggle={onReactionToggle ?? (() => {})}
    />
  ) : null

  // Collapsed message (same author, within 5 min) -- reduced top margin, no avatar/name
  if (!showAvatar) {
    return (
      <div className="group relative flex gap-3 mt-0.5">
        {/* Spacer matching avatar width */}
        <div className="w-8 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <RichTextEditor
                content={editHtml}
                onChange={setEditHtml}
                onSubmit={() => onEditSave?.(message.id, editHtml)}
                compact
                placeholder="Edit message..."
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={onEditCancel} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors">Cancel</button>
                <button type="button" onClick={() => onEditSave?.(message.id, editHtml)} className="px-3 py-1 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-full cursor-pointer transition-colors">Save</button>
              </div>
            </div>
          ) : (
            <div className={bgClass}>
              <div className={contentClass} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
              {message.editedAt && (
                <span className="text-xs text-slate-400 ml-1">(edited)</span>
              )}
              {message.attachments?.map((att) => (
                <AttachmentPreview key={att.id} attachment={att} />
              ))}
              {message.metadata && (message.metadata as Record<string, unknown>).type === 'booking-conflict' && (
                <BookingReferenceCard metadata={message.metadata as { type: 'booking-conflict'; booking: { title: string; spaceName: string; date: string; startTime: string; endTime: string; calendarEventId: string; sourceModule: string } }} />
              )}
            </div>
          )}
          {reactionSection}
        </div>
        {actionBar}
      </div>
    )
  }

  return (
    <div className="group relative flex gap-3 mt-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-slate-200 flex items-center justify-center">
        {message.authorAvatar ? (
          <OptimizedImage
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
        {/* Author name + BOT badge + timestamp + pin icon */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-slate-600">
            {message.authorName}
          </span>
          {isBot && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-600">
              BOT
            </span>
          )}
          <span className="text-xs text-slate-400">
            {timeAgo(message.createdAt)}
          </span>
          {message.editedAt && (
            <span className="text-xs text-slate-400">(edited)</span>
          )}
          {showPinIcon && (
            <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />
          )}
        </div>

        {/* Message body */}
        {isEditing ? (
          <div className="space-y-2">
            <RichTextEditor
              content={editHtml}
              onChange={setEditHtml}
              onSubmit={() => onEditSave?.(message.id, editHtml)}
              compact
              placeholder="Edit message..."
            />
            <div className="flex items-center gap-2">
              <button type="button" onClick={onEditCancel} className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer transition-colors">Cancel</button>
              <button type="button" onClick={() => onEditSave?.(message.id, editHtml)} className="px-3 py-1 text-xs text-white bg-slate-900 hover:bg-slate-800 rounded-full cursor-pointer transition-colors">Save</button>
            </div>
          </div>
        ) : (
          <div className={bgClass}>
            <div className={contentClass} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
            {message.attachments?.map((att) => (
              <AttachmentPreview key={att.id} attachment={att} />
            ))}
            {message.metadata && (message.metadata as Record<string, unknown>).type === 'booking-conflict' && (
              <BookingReferenceCard metadata={message.metadata as { type: 'booking-conflict'; booking: { title: string; spaceName: string; date: string; startTime: string; endTime: string; calendarEventId: string; sourceModule: string } }} />
            )}
          </div>
        )}

        {/* Reaction pills */}
        {reactionSection}

        {/* Thread reply count — Slack-style inline link */}
        {message.replyCount > 0 && (
          <button
            type="button"
            className="flex items-center gap-1.5 mt-1 px-1 py-0.5 -ml-1 rounded hover:bg-slate-50 cursor-pointer transition-colors duration-200 group/thread"
            onClick={() => onThreadClick?.(message.id, message)}
          >
            <MessageSquareText className="w-3.5 h-3.5 text-primary-500" />
            <span className="text-xs font-medium text-primary-500 group-hover/thread:underline">
              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </button>
        )}
      </div>

      {actionBar}
    </div>
  )
}
