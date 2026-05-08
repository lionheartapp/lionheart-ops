'use client'

/**
 * MessagingShell -- top-level messaging layout.
 *
 * Desktop: 280px channel sidebar + message area + optional thread panel overlay.
 * Mobile (<768px): single-view state machine (channels | messages | thread).
 */

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, ChevronLeft, Menu } from 'lucide-react'
import type { MessageWithAuthor } from '@/lib/services/messageService'
import { useChannels } from '@/lib/hooks/useChannels'
import ChannelList from './ChannelList'
import MessageArea from './MessageArea'
import ThreadPanel from './ThreadPanel'
import SearchPanel from './SearchPanel'
import BrowseChannelsPanel from './BrowseChannelsPanel'
import NewMessageView from './NewMessageView'

// ---------------------------------------------------------------------------
// Mobile detection hook
// ---------------------------------------------------------------------------

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < breakpoint)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isMobile
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MobileView = 'channels' | 'messages' | 'thread'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagingShell() {
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const channelFromUrl = searchParams.get('channel')
  const composeFromUrl = searchParams.get('compose') === 'true'
  const browseFromUrl = searchParams.get('browse') === 'true'
  const [activeChannelId, setActiveChannelId] = useState<string | null>(channelFromUrl)
  const [composeMode, setComposeMode] = useState(composeFromUrl)
  const [browseMode, setBrowseMode] = useState(browseFromUrl)

  // Sync with URL when query param changes (e.g. sidebar panel navigates)
  useEffect(() => {
    if (searchParams.get('browse') === 'true') {
      setBrowseMode(true)
      setComposeMode(false)
      setActiveChannelId(null)
      return
    }
    setBrowseMode(false)
    if (searchParams.get('compose') === 'true') {
      setComposeMode(true)
      setActiveChannelId(null)
      return
    }
    setComposeMode(false)
    if (channelFromUrl && channelFromUrl !== activeChannelId) {
      setActiveChannelId(channelFromUrl)
    }
  }, [channelFromUrl, searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear activeChannelId if the user isn't a member of that channel
  // (e.g. URL from a previous session, impersonating a different user)
  const { data: userChannels } = useChannels()
  useEffect(() => {
    if (!activeChannelId || !userChannels) return
    const isMember = userChannels.some((ch) => ch.id === activeChannelId)
    if (!isMember) {
      setActiveChannelId(null)
    }
  }, [activeChannelId, userChannels])

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [activeThreadMessage, setActiveThreadMessage] = useState<MessageWithAuthor | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('channels')
  const [showSearch, setShowSearch] = useState(false)

  // Cmd+K / Ctrl+K keyboard shortcut to toggle search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle channel selection
  const handleSelectChannel = useCallback(
    (channelId: string) => {
      setActiveChannelId(channelId)
      setActiveThreadId(null)
      setActiveThreadMessage(null)
      if (isMobile) setMobileView('messages')
    },
    [isMobile],
  )

  // Handle thread click from MessageArea
  const handleThreadClick = useCallback(
    (messageId: string, message?: MessageWithAuthor) => {
      setActiveThreadId(messageId)
      if (message) {
        setActiveThreadMessage(message)
      }
      if (isMobile) setMobileView('thread')
    },
    [isMobile],
  )

  // Close thread panel
  const handleCloseThread = useCallback(() => {
    setActiveThreadId(null)
    setActiveThreadMessage(null)
    if (isMobile) setMobileView('messages')
  }, [isMobile])

  // Mobile: go back to channel list
  const handleBackToChannels = useCallback(() => {
    setMobileView('channels')
  }, [])

  // Mobile: go back to messages from thread
  const handleBackToMessages = useCallback(() => {
    setActiveThreadId(null)
    setActiveThreadMessage(null)
    setMobileView('messages')
  }, [])

  // Handle search result navigation
  const handleSearchNavigate = useCallback(
    (channelId: string) => {
      handleSelectChannel(channelId)
      setShowSearch(false)
    },
    [handleSelectChannel],
  )

  // Handle add person to DM — creates a new group DM with existing + new member
  const handleAddPerson = useCallback(
    async (newUserId: string) => {
      if (!activeChannelId) return
      try {
        // Get current channel members
        const chRes = await fetch(`/api/messaging/channels/${activeChannelId}`, { credentials: 'include' })
        const chJson = await chRes.json()
        if (!chJson.ok) return
        const currentMemberIds: string[] = chJson.data.members?.map((m: { userId: string }) => m.userId) ?? []

        // Create group DM with all existing members + new person
        const otherIds = [...new Set([...currentMemberIds, newUserId])].filter(Boolean)
        const res = await fetch('/api/messaging/dms', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: otherIds }),
        })
        const json = await res.json()
        if (json.ok) {
          queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
          handleSelectChannel(json.data.id)
          window.history.replaceState(null, '', `/messaging?channel=${json.data.id}`)
        }
      } catch {
        // Non-fatal
      }
    },
    [activeChannelId, queryClient, handleSelectChannel],
  )

  // Shared search panel (rendered in both mobile and desktop)
  const searchPanel = showSearch ? (
    <SearchPanel
      onClose={() => setShowSearch(false)}
      onNavigate={handleSearchNavigate}
    />
  ) : null

  // -------------------------------------------------------------------------
  // Mobile layout
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <div className="ui-glass h-[calc(100vh-64px)] rounded-xl overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* Mobile: Channel list view */}
          {mobileView === 'channels' && (
            <motion.div
              key="channels"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="absolute inset-0 z-10 bg-white flex flex-col"
            >
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-slate-500" />
                <h1 className="text-sm font-semibold text-slate-700">Messaging</h1>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ChannelList
                  activeChannelId={activeChannelId}
                  onSelectChannel={handleSelectChannel}
                  onBrowseChannels={() => setBrowseMode(true)}
                />
              </div>
            </motion.div>
          )}

          {/* Mobile: Message area view */}
          {mobileView === 'messages' && activeChannelId && (
            <motion.div
              key="messages"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="absolute inset-0 z-10 bg-white flex flex-col"
            >
              {/* Mobile message header with back button */}
              <div className="px-2 py-2 border-b border-slate-200 flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleBackToChannels}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                  aria-label="Back to channels"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-semibold text-slate-700 truncate">Messages</span>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <MessageArea
                  channelId={activeChannelId}
                  onThreadClick={handleThreadClick}
                  onSearchClick={() => setShowSearch(true)}
                  onAddPerson={handleAddPerson}
                />
              </div>
            </motion.div>
          )}

          {/* Mobile: Thread view (replaces message area) */}
          {mobileView === 'thread' && activeChannelId && activeThreadId && activeThreadMessage && (
            <motion.div
              key="thread"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="absolute inset-0 z-10 bg-white flex flex-col"
            >
              {/* Mobile thread header with back button */}
              <div className="px-2 py-2 border-b border-slate-200 flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleBackToMessages}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                  aria-label="Back to messages"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-semibold text-slate-700">Thread</span>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <ThreadPanel
                  channelId={activeChannelId}
                  parentMessageId={activeThreadId}
                  parentMessage={activeThreadMessage}
                  onClose={handleBackToMessages}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {searchPanel}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Desktop layout — full-width message area (channels live in sidebar panel)
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full overflow-hidden relative bg-white">
      {/* Message area — full width, animated transitions */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {composeMode ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-1 flex flex-col min-h-0"
            >
              <NewMessageView
                onChannelSelected={(channelId) => {
                  setComposeMode(false)
                  setActiveChannelId(channelId)
                  window.history.replaceState(null, '', `/messaging?channel=${channelId}`)
                }}
                onClose={() => {
                  setComposeMode(false)
                  window.history.replaceState(null, '', '/messaging')
                }}
              />
            </motion.div>
          ) : browseMode ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-1 flex flex-col min-h-0"
            >
              <BrowseChannelsPanel
                onJoined={(channelId) => {
                  setBrowseMode(false)
                  handleSelectChannel(channelId)
                  window.history.replaceState(null, '', `/messaging?channel=${channelId}`)
                }}
                onClose={() => setBrowseMode(false)}
              />
            </motion.div>
          ) : activeChannelId ? (
            <motion.div
              key={`channel-${activeChannelId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <MessageArea
                channelId={activeChannelId}
                onThreadClick={handleThreadClick}
                onSearchClick={() => setShowSearch(true)}
                onAddPerson={handleAddPerson}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400"
            >
              <MessageSquare className="w-10 h-10" />
              <p className="text-sm">Select a channel from the sidebar to start messaging</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Thread panel overlay (desktop) */}
      <AnimatePresence>
        {activeThreadId && activeThreadMessage && activeChannelId && (
          <div className="absolute right-0 top-0 bottom-0 z-20">
            <ThreadPanel
              channelId={activeChannelId}
              parentMessageId={activeThreadId}
              parentMessage={activeThreadMessage}
              onClose={handleCloseThread}
            />
          </div>
        )}
      </AnimatePresence>

      {searchPanel}
    </div>
  )
}
