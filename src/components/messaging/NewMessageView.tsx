'use client'

/**
 * NewMessageView — compose a new DM or group DM.
 *
 * Flow:
 * 1. Pick recipients from the person list
 * 2. List collapses, composer appears
 * 3. Type message, hit Send
 * 4. DM is created (or found) and message is sent in one step
 * 5. Navigate to the new channel
 */

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, UserPlus, Loader2, Paperclip, Smile, ImagePlay } from 'lucide-react'
import PersonSearchPanel from './PersonSearchPanel'
import type { PersonSearchUser } from './PersonSearchPanel'
import dynamic from 'next/dynamic'
import { htmlToPlainText } from './rich-text-utils'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

interface Recipient {
  id: string
  name: string
  avatar: string | null
}

interface NewMessageViewProps {
  onChannelSelected: (channelId: string) => void
  onClose: () => void
}

export default function NewMessageView({ onChannelSelected, onClose }: NewMessageViewProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [showPeoplePicker, setShowPeoplePicker] = useState(true)
  const [html, setHtml] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const selectedIds = new Set(recipients.map((r) => r.id))

  const handleSelectPerson = useCallback(async (user: PersonSearchUser) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email

    // For 1:1 DMs: immediately find or create the conversation and navigate to it.
    // This way existing message history is visible right away.
    const allRecipientIds = [...recipients.map((r) => r.id), user.id]
    try {
      const res = await fetch('/api/messaging/dms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: allRecipientIds }),
      })
      const json = await res.json()
      if (json.ok) {
        await queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] })
        onChannelSelected(json.data.id)
        return
      }
    } catch {
      // Fall through to compose mode if the DM lookup fails
    }

    // Fallback: add to recipients list and show composer
    setRecipients((prev) => {
      if (prev.some((r) => r.id === user.id)) return prev
      return [...prev, { id: user.id, name, avatar: user.avatar }]
    })
    setShowPeoplePicker(false)
  }, [recipients, queryClient, onChannelSelected])

  const handleRemoveRecipient = useCallback((id: string) => {
    setRecipients((prev) => {
      const next = prev.filter((r) => r.id !== id)
      if (next.length === 0) setShowPeoplePicker(true)
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    const plainText = htmlToPlainText(html).trim()
    if (!plainText || recipients.length === 0 || sending) return

    setSending(true)
    setError(null)
    try {
      // Step 1: Find or create the DM
      const dmRes = await fetch('/api/messaging/dms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: recipients.map((r) => r.id) }),
      })
      const dmJson = await dmRes.json()
      if (!dmJson.ok) throw new Error(dmJson.error?.message || 'Failed to create conversation')

      const channelId = dmJson.data.id

      // Step 2: Send the message
      const msgRes = await fetch(`/api/messaging/channels/${channelId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html }),
      })
      if (!msgRes.ok) throw new Error('Failed to send message')

      // Step 3: Refresh both channels and messages so the conversation shows
      // the just-sent message immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messaging', 'channels'] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'messages', channelId] }),
      ])
      onChannelSelected(channelId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }, [html, recipients, sending, queryClient, onChannelSelected])

  const canSend = htmlToPlainText(html).trim().length > 0 && recipients.length > 0 && !sending

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header: To chips + add more */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/60 flex-shrink-0 min-h-[48px] flex-wrap">
        <span className="text-sm text-slate-400 font-medium flex-shrink-0">To:</span>

        {recipients.map((r) => {
          const initials = r.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
          return (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 bg-primary-50 border border-primary-200 rounded-lg text-sm"
            >
              {r.avatar ? (
                <OptimizedImage src={r.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[9px] font-medium text-white">
                  {initials}
                </span>
              )}
              <span className="font-medium text-primary-700">{r.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveRecipient(r.id)}
                className="ml-0.5 text-primary-400 hover:text-primary-600 cursor-pointer"
                aria-label={`Remove ${r.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )
        })}

        {/* Add more button — shows when picker is hidden and we have recipients */}
        {!showPeoplePicker && recipients.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPeoplePicker(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add
          </button>
        )}

        {/* Close compose */}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto p-1 text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Person picker — visible when picking, max height limited */}
      {showPeoplePicker && (
        <PersonSearchPanel
          excludeIds={selectedIds}
          onSelect={handleSelectPerson}
          onClose={() => {
            if (recipients.length > 0) {
              setShowPeoplePicker(false)
            } else {
              onClose()
            }
          }}
          closeOnSelect={false}
          className="border-b border-slate-200/60 bg-white flex-shrink-0"
        />
      )}

      {/* Composer area — visible once we have recipients and picker is closed */}
      <div className="flex-1 flex flex-col min-h-0">
        {recipients.length > 0 && !showPeoplePicker ? (
          <>
            <div className="flex-1" />
            {error && (
              <div className="px-4 py-2 text-sm text-red-500">{error}</div>
            )}
            <div className="px-4 py-3 border-t border-slate-200/60 flex-shrink-0">
              <RichTextEditor
                content={html}
                onChange={setHtml}
                onSubmit={handleSend}
                placeholder="Type a message..."
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Attach file"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Add emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Send GIF"
                  >
                    <ImagePlay className="w-5 h-5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    canSend
                      ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : !showPeoplePicker ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
            Select someone to start a conversation
          </div>
        ) : null}
      </div>
    </div>
  )
}
