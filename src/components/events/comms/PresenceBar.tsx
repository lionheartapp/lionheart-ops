'use client'

/**
 * PresenceBar — Google Docs/Figma-style avatar row showing active collaborators.
 *
 * Props:
 *   eventProjectId — the event project to track presence on
 *   currentUserId  — the logged-in user's ID (current user gets aurora ring)
 *   activeTab      — the tab currently visible (sent with heartbeats)
 */

import { motion, AnimatePresence } from 'framer-motion'
import { usePresence } from '@/lib/hooks/usePresence'
import type { ActiveUser } from '@/lib/hooks/usePresence'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 5

// ─── Avatar component ─────────────────────────────────────────────────────────

interface AvatarProps {
  user: ActiveUser
  isCurrent: boolean
  size?: number
}

function Avatar({ user, isCurrent, size = 32 }: AvatarProps) {
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  const tabLabel = user.activeTab
    ? user.activeTab.charAt(0).toUpperCase() + user.activeTab.slice(1) + ' tab'
    : null

  const tooltipText = tabLabel
    ? `${user.name} — ${tabLabel}`
    : user.name

  return (
    <div
      className="relative group flex-shrink-0"
      style={{ width: size, height: size }}
      title={tooltipText}
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

      {/* Aurora gradient ring for current user */}
      {isCurrent && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
            padding: '2px',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'destination-out',
            maskComposite: 'exclude',
          }}
        />
      )}

      {/* Tooltip on hover */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10"
        style={{ fontSize: 11 }}
      >
        {tooltipText}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

interface PresenceBarProps {
  eventProjectId: string
  currentUserId: string | null | undefined
  activeTab?: string
}

export function PresenceBar({ eventProjectId, currentUserId, activeTab }: PresenceBarProps) {
  const { activeUsers } = usePresence(eventProjectId, currentUserId, activeTab)

  // If only the current user is present (or no users), show minimal state
  const otherUsers = activeUsers.filter(u => u.userId !== currentUserId)
  const currentUser = activeUsers.find(u => u.userId === currentUserId)

  // Nothing to show if the hook hasn't fetched yet and no one is active
  if (activeUsers.length === 0) {
    return null
  }

  // Only current user active
  if (otherUsers.length === 0 && currentUser) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Avatar user={currentUser} isCurrent size={28} />
        <span>Only you here</span>
      </div>
    )
  }

  // Multiple users: show up to MAX_VISIBLE avatars, then overflow chip
  const allUsers = currentUser
    ? [currentUser, ...otherUsers]
    : otherUsers

  const visibleUsers = allUsers.slice(0, MAX_VISIBLE)
  const overflowCount = Math.max(0, allUsers.length - MAX_VISIBLE)

  return (
    <div className="flex items-center gap-1.5" aria-label="Active collaborators">
      <AnimatePresence mode="popLayout">
        {visibleUsers.map((user) => (
          <motion.div
            key={user.userId}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ marginLeft: visibleUsers.indexOf(user) > 0 ? -8 : 0 }}
          >
            <Avatar
              user={user}
              isCurrent={user.userId === currentUserId}
              size={32}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Overflow chip */}
      {overflowCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-600"
          style={{ marginLeft: -8 }}
          title={`${overflowCount} more collaborator${overflowCount !== 1 ? 's' : ''}`}
        >
          +{overflowCount}
        </motion.div>
      )}
    </div>
  )
}
