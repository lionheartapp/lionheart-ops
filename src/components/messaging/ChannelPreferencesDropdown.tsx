'use client'

/**
 * ChannelPreferencesDropdown — per-channel notification preferences (D-12, D-13).
 * Renders a bell icon button in the channel header that toggles a dropdown
 * with notification level (all / mentions / none) and email digest toggle.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelPreferencesDropdownProps {
  channelId: string
}

interface ChannelPreference {
  level: 'all' | 'mentions' | 'none'
  emailDigest: boolean
}

const LEVEL_OPTIONS: { value: ChannelPreference['level']; label: string; description: string }[] = [
  { value: 'all', label: 'All messages', description: 'Notified for every new message' },
  { value: 'mentions', label: 'Mentions only', description: 'Only when you are @mentioned' },
  { value: 'none', label: 'Nothing', description: 'No notifications from this channel' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelPreferencesDropdown({ channelId }: ChannelPreferencesDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Fetch current preferences
  const { data: preferences } = useQuery<ChannelPreference>({
    queryKey: ['channel-preferences', channelId],
    queryFn: async () => {
      const res = await fetch(`/api/messaging/channels/${channelId}/preferences`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch preferences')
      const json = await res.json()
      return json.data ?? { level: 'all', emailDigest: true }
    },
    enabled: !!channelId,
    staleTime: 60_000,
  })

  const currentLevel = preferences?.level ?? 'all'
  const currentEmailDigest = preferences?.emailDigest ?? true

  // Save preferences
  const saveMutation = useMutation({
    mutationFn: async (newPrefs: ChannelPreference) => {
      const res = await fetch(`/api/messaging/channels/${channelId}/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPrefs),
      })
      if (!res.ok) throw new Error('Failed to save preferences')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-preferences', channelId] })
    },
  })

  const handleLevelChange = useCallback(
    (level: ChannelPreference['level']) => {
      saveMutation.mutate({ level, emailDigest: currentEmailDigest })
    },
    [saveMutation, currentEmailDigest],
  )

  const handleEmailDigestToggle = useCallback(() => {
    saveMutation.mutate({ level: currentLevel, emailDigest: !currentEmailDigest })
  }, [saveMutation, currentLevel, currentEmailDigest])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-colors duration-200 ${
          isOpen
            ? 'bg-indigo-50 text-indigo-600'
            : currentLevel === 'none'
              ? 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`}
        title="Notification preferences"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="ui-glass-dropdown absolute right-0 top-full mt-1 w-64 rounded-xl shadow-lg z-50 py-2">
          <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Notify me about
          </div>

          {/* Level options */}
          {LEVEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleLevelChange(option.value)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer transition-colors duration-200 hover:bg-slate-50"
            >
              <div className="w-4 flex-shrink-0">
                {currentLevel === option.value && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-sm ${currentLevel === option.value ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                  {option.label}
                </p>
                <p className="text-xs text-slate-400">{option.description}</p>
              </div>
            </button>
          ))}

          {/* Divider */}
          <div className="border-t border-slate-200/60 my-1.5" />

          {/* Email digest toggle */}
          <button
            type="button"
            onClick={handleEmailDigestToggle}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition-colors duration-200 hover:bg-slate-50"
          >
            <span className="text-sm text-slate-700">Email digest</span>
            <div
              className={`w-8 h-5 rounded-full relative transition-colors duration-200 ${
                currentEmailDigest ? 'bg-indigo-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  currentEmailDigest ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
