'use client'

/**
 * PresenceBar — Figma-style avatar row showing active collaborators.
 *
 * Features:
 *   - Avatar stack with overflow chip
 *   - Click avatar → popover with name, role, active tab, follow button
 *   - "Follow" mode: syncs your tab to the followed user's active tab
 *   - Chat toggle button opens the EventChatPanel
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { usePresence } from '@/lib/hooks/usePresence'
import type { ActiveUser } from '@/lib/hooks/usePresence'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  WARM_CHIP_HOVER,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 5

// ─── Avatar component ─────────────────────────────────────────────────────────

interface AvatarProps {
  user: ActiveUser
  isCurrent: boolean
  size?: number
  onClick?: () => void
  isFollowed?: boolean
}

function Avatar({ user, isCurrent, size = 32, onClick, isFollowed = false }: AvatarProps) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <button
      onClick={onClick}
      className="relative flex-shrink-0 cursor-pointer group"
      style={{ width: size, height: size }}
      title={user.name}
      type="button"
    >
      {/* Avatar circle */}
      <div
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: user.avatarUrl ? undefined : 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
        }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="text-white font-semibold"
            style={{ fontSize: size * 0.35 }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Ring — aurora for current user, green for followed */}
      {(isCurrent || isFollowed) && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: isFollowed
              ? '#4d8a5c'
              : 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
            padding: '2px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'destination-out',
            maskComposite: 'exclude',
          }}
        />
      )}
    </button>
  )
}

// ─── User Popover ─────────────────────────────────────────────────────────────

interface UserPopoverProps {
  user: ActiveUser
  isCurrent: boolean
  isFollowing: boolean
  onFollow: () => void
  onUnfollow: () => void
  onClose: () => void
}

function UserPopover({ user, isCurrent, isFollowing, onFollow, onUnfollow, onClose }: UserPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const tabLabel = user.activeTab
    ? user.activeTab.charAt(0).toUpperCase() + user.activeTab.slice(1)
    : null

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute top-full mt-2 right-0 w-56 rounded-xl z-50 overflow-hidden"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div className="p-3">
        {/* User info */}
        <div className="flex items-center gap-2.5 mb-2">
          <Avatar user={user} isCurrent={isCurrent} size={36} />
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-semibold truncate"
              style={{ color: TEXT_PRIMARY }}
            >
              {user.name}{isCurrent ? ' (you)' : ''}
            </p>
            {tabLabel && (
              <p className="text-[11px] truncate" style={{ color: TEXT_SECONDARY }}>
                Viewing {tabLabel} tab
              </p>
            )}
          </div>
        </div>

        {/* Follow button — only for other users */}
        {!isCurrent && (
          <button
            onClick={isFollowing ? onUnfollow : onFollow}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer mt-1"
            style={{
              backgroundColor: isFollowing ? '#e8e3d9' : WARM_CHIP,
              color: isFollowing ? TEXT_PRIMARY : TEXT_SECONDARY,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isFollowing ? '#ddd7cb' : WARM_CHIP_HOVER
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isFollowing ? '#e8e3d9' : WARM_CHIP
            }}
          >
            {isFollowing ? (
              <>
                <EyeOff className="w-3.5 h-3.5" strokeWidth={2} />
                Stop following
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                Follow to their tab
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface PresenceBarProps {
  eventProjectId: string
  currentUserId: string | null | undefined
  activeTab?: string
  /** Callback to switch the active tab (used by follow mode) */
  onTabChange?: (tab: string) => void
  /** Callback to toggle the chat panel */
  onToggleChat?: () => void
  /** Whether the chat panel is currently open */
  isChatOpen?: boolean
  /** Number of unread chat messages */
  unreadCount?: number
}

export function PresenceBar({
  eventProjectId,
  currentUserId,
  activeTab,
  onTabChange,
  onToggleChat,
  isChatOpen = false,
  unreadCount = 0,
}: PresenceBarProps) {
  const { activeUsers } = usePresence(eventProjectId, currentUserId, activeTab)
  const [popoverUserId, setPopoverUserId] = useState<string | null>(null)
  const [followingUserId, setFollowingUserId] = useState<string | null>(null)

  // Follow mode: when the followed user changes tabs, switch ours
  const followedUser = followingUserId
    ? activeUsers.find(u => u.userId === followingUserId)
    : null

  useEffect(() => {
    if (!followedUser?.activeTab || !onTabChange) return
    if (followedUser.activeTab !== activeTab) {
      onTabChange(followedUser.activeTab)
    }
  }, [followedUser?.activeTab, activeTab, onTabChange])

  // If the followed user leaves, stop following
  useEffect(() => {
    if (followingUserId && !activeUsers.some(u => u.userId === followingUserId)) {
      setFollowingUserId(null)
    }
  }, [activeUsers, followingUserId])

  const handleAvatarClick = useCallback((userId: string) => {
    setPopoverUserId(prev => prev === userId ? null : userId)
  }, [])

  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId)
  const currentUser = activeUsers.find(u => u.userId === currentUserId)

  const allUsers = currentUser ? [currentUser, ...otherUsers] : otherUsers
  const visibleUsers = allUsers.slice(0, MAX_VISIBLE)
  const overflowCount = Math.max(0, allUsers.length - MAX_VISIBLE)

  return (
    <div className="flex items-center gap-2">
      {/* Avatar stack — only show when there are active users */}
      {allUsers.length > 0 && (
      <div className="relative flex items-center" aria-label="Active collaborators">
        <div className="flex items-center">
          {visibleUsers.map((user, i) => (
            <div
              key={user.userId}
              className="relative"
              style={{ marginLeft: i > 0 ? -8 : 0, zIndex: MAX_VISIBLE - i }}
            >
              <Avatar
                user={user}
                isCurrent={user.userId === currentUserId}
                size={32}
                onClick={() => handleAvatarClick(user.userId)}
                isFollowed={user.userId === followingUserId}
              />

              {/* Popover */}
              <AnimatePresence>
                {popoverUserId === user.userId && (
                  <UserPopover
                    user={user}
                    isCurrent={user.userId === currentUserId}
                    isFollowing={followingUserId === user.userId}
                    onFollow={() => {
                      setFollowingUserId(user.userId)
                      setPopoverUserId(null)
                    }}
                    onUnfollow={() => {
                      setFollowingUserId(null)
                      setPopoverUserId(null)
                    }}
                    onClose={() => setPopoverUserId(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          ))}

          {overflowCount > 0 && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold"
              style={{
                marginLeft: -8,
                backgroundColor: WARM_CHIP,
                color: TEXT_SECONDARY,
                border: `2px solid ${SURFACE}`,
              }}
              title={`${overflowCount} more`}
            >
              +{overflowCount}
            </div>
          )}
        </div>

        {/* Following indicator */}
        {followedUser && (
          <div
            className="flex items-center gap-1 ml-2 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: '#e8f5e9', color: '#2e7d32' }}
          >
            <Eye className="w-3 h-3" strokeWidth={2} />
            Following {followedUser.name.split(' ')[0]}
          </div>
        )}
      </div>
      )}

      {/* Chevron dropdown hint */}
      {allUsers.length > 0 && (
        <ChevronDown
          className="w-3 h-3 flex-shrink-0"
          strokeWidth={2}
          style={{ color: TEXT_MUTED }}
        />
      )}

      {/* Chat toggle */}
      {onToggleChat && (
        <button
          onClick={onToggleChat}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors cursor-pointer"
          style={{
            backgroundColor: isChatOpen ? '#e8e3d9' : WARM_CHIP,
            color: isChatOpen ? TEXT_PRIMARY : TEXT_SECONDARY,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isChatOpen ? '#ddd7cb' : WARM_CHIP_HOVER
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isChatOpen ? '#e8e3d9' : WARM_CHIP
          }}
          aria-label="Toggle team chat"
        >
          <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />
          Chat
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: '#c28840' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
