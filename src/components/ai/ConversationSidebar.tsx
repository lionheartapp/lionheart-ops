'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Plus } from 'lucide-react'

interface ConversationItem {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface ConversationSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  activeConversationId: string | null
}

/** Group label for a conversation based on its date */
function getDateGroup(dateStr: string): 'Today' | 'Yesterday' | 'This Week' | 'Earlier' {
  const date = new Date(dateStr)
  const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  if (date >= todayStart) return 'Today'
  if (date >= yesterdayStart) return 'Yesterday'
  if (date >= weekStart) return 'This Week'
  return 'Earlier'
}

/** Format a date string for display within a group */
function formatGroupDate(dateStr: string, group: string): string {
  if (group === 'Today' || group === 'Yesterday') return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ConversationSidebar({
  isOpen,
  onClose,
  onSelectConversation,
  onNewConversation,
  activeConversationId,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/conversations?limit=30', { credentials: 'include' })
      if (!res.ok) return
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        setConversations(json.data)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchConversations()
    }
  }, [isOpen, fetchConversations])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }

    // Confirmed — optimistic remove
    setDeletingId(id)
    setConfirmDeleteId(null)
    setConversations((prev) => prev.filter((c) => c.id !== id))

    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch {
      // silent — optimistic removal is fine
    } finally {
      setDeletingId(null)
    }
  }, [confirmDeleteId])

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDeleteId(null)
  }, [])

  // Group conversations by date bucket
  const groups: { label: string; items: ConversationItem[] }[] = []
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Earlier'] as const

  const grouped: Record<string, ConversationItem[]> = {}
  for (const conv of conversations) {
    const g = getDateGroup(conv.updatedAt || conv.createdAt)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(conv)
  }

  for (const label of groupOrder) {
    if (grouped[label]?.length) {
      groups.push({ label, items: grouped[label] })
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Sliding panel */}
          <motion.div
            className="absolute top-0 left-0 bottom-0 z-20 w-[260px] flex flex-col border-r border-gray-200/60 bg-white/95 backdrop-blur-sm rounded-l-2xl overflow-hidden"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Conversations</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onNewConversation}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-[11px] font-medium cursor-pointer transition-opacity hover:opacity-90 active:scale-[0.97]"
                  style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)' }}
                  title="New conversation"
                >
                  <Plus className="h-3 w-3" />
                  New
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto leo-scrollbar">
              {isLoading ? (
                <div className="p-3 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg p-2.5">
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-1.5" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                    <MessageSquare className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500">No conversations yet</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Start chatting to see history</p>
                </div>
              ) : (
                <div className="py-1">
                  {groups.map(({ label, items }) => (
                    <div key={label}>
                      <div className="px-3 pt-3 pb-1">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                      </div>
                      {items.map((conv) => {
                        const isActive = conv.id === activeConversationId
                        const isConfirming = confirmDeleteId === conv.id
                        const dateLabel = formatGroupDate(conv.updatedAt || conv.createdAt, label)
                        const title = conv.title
                          ? conv.title.length > 30
                            ? conv.title.slice(0, 30) + '...'
                            : conv.title
                          : 'Untitled'

                        return (
                          <div
                            key={conv.id}
                            className={`group relative mx-1.5 mb-0.5 rounded-lg cursor-pointer transition-colors duration-200 ${
                              isActive
                                ? 'bg-primary-50'
                                : 'hover:bg-gray-50'
                            } ${deletingId === conv.id ? 'opacity-50' : ''}`}
                            onClick={() => !isConfirming && onSelectConversation(conv.id)}
                          >
                            {/* Active aurora border */}
                            {isActive && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg"
                                style={{ background: 'linear-gradient(180deg, #3B82F6 0%, #6366F1 100%)' }}
                              />
                            )}

                            <div className="px-3 py-2.5 pl-4">
                              <div className="flex items-start justify-between gap-1">
                                <p className={`text-xs font-medium leading-snug flex-1 min-w-0 truncate ${isActive ? 'text-primary-700' : 'text-gray-800'}`}>
                                  {title}
                                </p>

                                {/* Delete / confirm controls */}
                                {isConfirming ? (
                                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="text-[10px] text-red-500 hover:text-red-600 font-medium cursor-pointer"
                                      onClick={(e) => handleDelete(conv.id, e)}
                                    >
                                      Delete?
                                    </button>
                                    <button
                                      className="text-[10px] text-gray-400 hover:text-gray-600 cursor-pointer"
                                      onClick={handleCancelDelete}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 flex-shrink-0 cursor-pointer"
                                    onClick={(e) => handleDelete(conv.id, e)}
                                    aria-label="Delete conversation"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 mt-0.5">
                                {dateLabel && (
                                  <span className="text-[10px] text-gray-400">{dateLabel}</span>
                                )}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-500">
                                  {conv.messageCount} {conv.messageCount === 1 ? 'msg' : 'msgs'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
