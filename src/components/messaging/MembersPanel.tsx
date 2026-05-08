'use client'

/**
 * MembersPanel — slide-out panel showing channel members.
 * Supports removing members (with two-click confirm) and leaving the channel.
 * Hides the system bot from the list.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, LogOut, Loader2, Crown, Shield, UserMinus } from 'lucide-react'
import { useChannel } from '@/lib/hooks/useChannels'
import { useAuth } from '@/lib/hooks/useAuth'

interface MembersPanelProps {
  channelId: string
  onClose: () => void
  onLeave?: () => void
}

export default function MembersPanel({ channelId, onClose, onLeave }: MembersPanelProps) {
  const { data: channel } = useChannel(channelId)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [leaving, setLeaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const currentUserId = user?.id ?? null
  const isDM = channel?.type === 'DM' || channel?.type === 'GROUP_DM'

  // Filter out the system bot from the visible list
  const visibleMembers = (channel?.members ?? []).filter((m) => {
    const email = (m.user as Record<string, unknown>).email as string | undefined
    return email !== 'bot@lionheart.internal'
  })

  async function handleLeave() {
    if (!currentUserId) return
    setLeaving(true)
    try {
      if (isDM) {
        // DMs: hide via the hide endpoint
        await fetch(`/api/messaging/channels/${channelId}/hide`, {
          method: 'POST',
          credentials: 'include',
        })
      } else {
        // Channels: remove self via members endpoint
        await fetch(`/api/messaging/channels/${channelId}/members`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId }),
        })
      }
      queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
      onLeave?.()
      onClose()
    } finally {
      setLeaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (confirmRemoveId !== userId) {
      setConfirmRemoveId(userId)
      return
    }

    setRemovingId(userId)
    setConfirmRemoveId(null)
    try {
      if (isDM) {
        // For group DMs, we can't use removeMember — it blocks DMs.
        // Instead we'd need a different approach. For now, skip.
        return
      }
      await fetch(`/api/messaging/channels/${channelId}/members`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      await queryClient.refetchQueries({ queryKey: ['messaging', 'channels'] })
      await queryClient.refetchQueries({ queryKey: ['messaging', 'channels', channelId] })
    } finally {
      setRemovingId(null)
    }
  }

  const roleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-3.5 h-3.5 text-amber-500" />
    if (role === 'admin') return <Shield className="w-3.5 h-3.5 text-primary-500" />
    return null
  }

  return (
    <div className="w-72 h-full bg-white border-l border-slate-200 flex flex-col shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-800">
          Members{visibleMembers.length > 0 && ` (${visibleMembers.length})`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto py-1">
        {visibleMembers.map((m) => {
          const name = `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || 'User'
          const initials = `${(m.user.firstName || '')[0] || ''}${(m.user.lastName || '')[0] || ''}`.toUpperCase() || '?'
          const isMe = m.userId === currentUserId
          const isConfirming = confirmRemoveId === m.userId
          const isRemoving = removingId === m.userId
          const canRemove = !isMe && !isDM

          return (
            <div
              key={m.userId}
              className="group/member flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors"
            >
              {m.user.avatar ? (
                <img src={m.user.avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-medium text-white">{initials}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {name}{isMe && <span className="text-slate-400 font-normal"> (you)</span>}
                  </span>
                  {roleIcon(m.role)}
                </div>
              </div>

              {/* Remove button — visible on hover, two-click confirm */}
              {canRemove && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.userId)}
                  disabled={isRemoving}
                  className={`flex-shrink-0 transition-all cursor-pointer ${
                    isConfirming
                      ? 'px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded-full'
                      : 'p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover/member:opacity-100'
                  }`}
                  title={isConfirming ? 'Click to confirm' : `Remove ${name}`}
                  aria-label={isConfirming ? 'Click to confirm removal' : `Remove ${name}`}
                >
                  {isRemoving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isConfirming ? (
                    'Remove?'
                  ) : (
                    <UserMinus className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Leave / hide */}
      <div className="flex-shrink-0 border-t border-slate-200/60 p-3">
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
        >
          {leaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {isDM ? 'Leave conversation' : 'Leave channel'}
        </button>
      </div>
    </div>
  )
}
