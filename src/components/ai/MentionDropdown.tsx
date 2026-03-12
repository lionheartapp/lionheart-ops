'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { dropdownVariants } from '@/lib/animations'

export interface MentionUser {
  id: string
  firstName?: string | null
  lastName?: string | null
  email: string
  avatar?: string | null
  jobTitle?: string | null
}

interface MentionDropdownProps {
  users: MentionUser[]
  isLoading: boolean
  isOpen: boolean
  selectedIndex: number
  onSelect: (user: MentionUser) => void
  /** Offset from bottom of the form wrapper */
  anchorBottom: number
}

export default function MentionDropdown({
  users,
  isLoading,
  isOpen,
  selectedIndex,
  onSelect,
  anchorBottom,
}: MentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={dropdownVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="ui-glass-dropdown absolute left-0 right-0 z-50 max-h-60 overflow-y-auto py-1"
          style={{ bottom: anchorBottom }}
          ref={listRef}
        >
          {isLoading && users.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
          ) : users.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">No users found</div>
          ) : (
            users.map((user, idx) => {
              const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
              const initials = (user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')

              return (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault() // prevent textarea blur
                    onSelect(user)
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                    idx === selectedIndex
                      ? 'bg-indigo-50 text-indigo-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar */}
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={name}
                      className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600 flex-shrink-0">
                      {initials || '?'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{name}</div>
                    {user.jobTitle && (
                      <div className="text-xs text-gray-400 truncate">{user.jobTitle}</div>
                    )}
                  </div>

                  <span className="text-xs text-gray-400 flex-shrink-0 truncate max-w-[140px]">
                    {user.email}
                  </span>
                </button>
              )
            })
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
