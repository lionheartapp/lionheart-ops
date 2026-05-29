'use client'

/**
 * PinnedMessagesPanel — slide-in panel showing all pinned messages in a channel.
 *
 * Fetches from GET /api/messaging/channels/{id}/pins. Click a message
 * to close the panel (scrolling to it is deferred to a future enhancement).
 */

import { X, Pin } from 'lucide-react'
import { usePinnedMessages } from '@/lib/hooks/usePinnedMessages'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

interface PinnedMessagesPanelProps {
  channelId: string
  onClose: () => void
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

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function PinnedMessagesPanel({ channelId, onClose }: PinnedMessagesPanelProps) {
  const { data: pinnedMessages, isLoading } = usePinnedMessages(channelId)

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Pinned Messages</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
          aria-label="Close pinned messages"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200" />
                  <div className="h-3 w-20 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!pinnedMessages || pinnedMessages.length === 0) && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Pin className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No pinned messages</p>
            <p className="text-xs text-slate-400 mt-1">
              Pin important messages to find them quickly
            </p>
          </div>
        )}

        {pinnedMessages?.map((msg) => (
          <button
            key={msg.id}
            type="button"
            onClick={onClose}
            className="w-full text-left bg-slate-50 rounded-lg p-3 hover:bg-slate-100 cursor-pointer transition-colors duration-200 border border-transparent hover:border-slate-200"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                {msg.authorAvatar ? (
                  <OptimizedImage
                    src={msg.authorAvatar}
                    alt={msg.authorName}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-slate-500">
                    {getInitials(msg.authorName)}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium text-slate-600 truncate">
                {msg.authorName}
              </span>
              <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                {formatDate(msg.createdAt)}
              </span>
            </div>
            <p className="text-sm text-slate-700 line-clamp-3 whitespace-pre-wrap">
              {msg.content}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
