'use client'

import { useCallback, useRef, useState } from 'react'
import { Smile, Paperclip, SendHorizonal } from 'lucide-react'
import { useSendMessage } from '@/lib/hooks/useSendMessage'
import { useFileUpload } from '@/lib/hooks/useFileUpload'
import { TEXTAREA_CLASSES } from '@/components/ui/form-tokens'
import EmojiPicker from './EmojiPicker'
import MentionAutocomplete from './MentionAutocomplete'
import FileUploadProgress from './FileUploadProgress'

interface ComposerProps {
  channelId: string
  onSendTyping: () => void
  parentId?: string
}

export default function Composer({ channelId, onSendTyping, parentId }: ComposerProps) {
  const [content, setContent] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [mentionState, setMentionState] = useState<{
    active: boolean
    query: string
    position: { top: number; left: number }
  }>({ active: false, query: '', position: { top: 0, left: 0 } })

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { sendMessage, isPending } = useSendMessage(channelId)
  const { upload, isUploading, progress, error: uploadError, reset: resetUpload } = useFileUpload(channelId)

  const [pendingAttachment, setPendingAttachment] = useState<{
    fileName: string
    fileSize: number
    mimeType: string
    storageUrl: string
  } | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so re-selecting same file works
    if (fileInputRef.current) fileInputRef.current.value = ''

    const result = await upload(file)
    if (result) {
      setPendingAttachment(result)
    }
  }, [upload])

  const handleSend = useCallback(() => {
    const trimmed = content.trim()
    const hasContent = trimmed.length > 0
    const hasAttachment = !!pendingAttachment

    if ((!hasContent && !hasAttachment) || isPending || isUploading) return

    sendMessage({
      content: trimmed || ' ', // API requires content, send space if only attachment
      parentId,
      attachments: pendingAttachment ? [pendingAttachment] : undefined,
    })
    setContent('')
    setPendingAttachment(null)
    resetUpload()

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [content, isPending, isUploading, sendMessage, parentId, pendingAttachment, resetUpload])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If mention autocomplete is active, let it handle Enter/Arrow keys
      if (mentionState.active) {
        if (['Enter', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
          return // MentionAutocomplete handles these via document listener
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, mentionState.active],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      setContent(value)
      onSendTyping()

      // Auto-resize
      const el = e.target
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`

      // Detect @mention
      const cursorPos = el.selectionStart
      const textBeforeCursor = value.slice(0, cursorPos)
      const mentionMatch = /@(\w*)$/.exec(textBeforeCursor)

      if (mentionMatch) {
        setMentionState({
          active: true,
          query: mentionMatch[1],
          position: { top: 8, left: 0 },
        })
      } else {
        setMentionState((prev) => (prev.active ? { ...prev, active: false } : prev))
      }
    },
    [onSendTyping],
  )

  const handleEmojiSelect = useCallback((emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      setContent((prev) => prev + emoji)
      setShowEmoji(false)
      return
    }

    const start = el.selectionStart
    const end = el.selectionEnd
    const before = content.slice(0, start)
    const after = content.slice(end)
    const newContent = before + emoji + after

    setContent(newContent)
    setShowEmoji(false)

    // Restore cursor position after emoji
    requestAnimationFrame(() => {
      el.focus()
      const newPos = start + emoji.length
      el.setSelectionRange(newPos, newPos)
    })
  }, [content])

  const handleMentionSelect = useCallback(
    (user: { id: string; name: string }) => {
      const el = textareaRef.current
      if (!el) return

      const cursorPos = el.selectionStart
      const textBeforeCursor = content.slice(0, cursorPos)
      const mentionMatch = /@(\w*)$/.exec(textBeforeCursor)

      if (mentionMatch) {
        const start = cursorPos - mentionMatch[0].length
        const after = content.slice(cursorPos)
        const mentionText = `${user.name} `
        const newContent = content.slice(0, start) + `@${mentionText}` + after

        setContent(newContent)
        setMentionState({ active: false, query: '', position: { top: 0, left: 0 } })

        requestAnimationFrame(() => {
          el.focus()
          const newPos = start + mentionText.length + 1
          el.setSelectionRange(newPos, newPos)
        })
      }
    },
    [content],
  )

  const handleMentionClose = useCallback(() => {
    setMentionState({ active: false, query: '', position: { top: 0, left: 0 } })
  }, [])

  const canSend = (content.trim().length > 0 || !!pendingAttachment) && !isPending && !isUploading

  return (
    <div className="bg-white border-t border-slate-200 px-4 py-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmoji((v) => !v)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line no-restricted-syntax -- Hidden file input cannot use UI Input component */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
          className="hidden"
        />

        <span className="text-xs text-slate-400 ml-auto">Markdown supported</span>
      </div>

      {/* Upload progress / error / pending attachment */}
      {isUploading && (
        <FileUploadProgress
          fileName="Uploading..."
          progress={progress}
          onCancel={resetUpload}
        />
      )}
      {uploadError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-red-600 flex-1">{uploadError}</p>
          <button
            type="button"
            onClick={resetUpload}
            className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {pendingAttachment && !isUploading && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-2">
          <p className="text-xs text-indigo-700 truncate flex-1">
            {pendingAttachment.fileName}
          </p>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            className="text-xs text-indigo-400 hover:text-indigo-600 cursor-pointer"
          >
            Remove
          </button>
        </div>
      )}

      {/* Textarea + Send */}
      <div className="relative">
        {mentionState.active && (
          <MentionAutocomplete
            query={mentionState.query}
            position={mentionState.position}
            onSelect={handleMentionSelect}
            onClose={handleMentionClose}
          />
        )}

        {/* eslint-disable-next-line no-restricted-syntax -- Composer needs custom keyboard handling incompatible with UI Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className={`${TEXTAREA_CLASSES} min-h-[44px] max-h-[160px] overflow-y-auto resize-none pr-12`}
          rows={1}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
            canSend
              ? 'bg-indigo-500 text-white hover:bg-indigo-600'
              : 'bg-slate-100 text-slate-300'
          }`}
          aria-label="Send message"
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
