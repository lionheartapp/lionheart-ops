'use client'

import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import { Paperclip, SendHorizonal, Smile, ImagePlay } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useSendMessage } from '@/lib/hooks/useSendMessage'
import { useFileUpload } from '@/lib/hooks/useFileUpload'
import RichTextEditor, { htmlToPlainText } from './RichTextEditor'
import EmojiPicker from './EmojiPicker'
import FileUploadProgress from './FileUploadProgress'
import SlashCommandPicker from './SlashCommandPicker'
import GifPicker from './GifPicker'

interface ComposerProps {
  channelId: string
  onSendTyping?: () => void
  parentId?: string
}

export default function Composer({ channelId, onSendTyping, parentId }: ComposerProps) {
  const { user } = useAuth()
  const [html, setHtml] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showSlashCommand, setShowSlashCommand] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const editorRef = useRef<{ insertContent: (text: string) => void } | null>(null)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
    const result = await upload(file)
    if (result) setPendingAttachment(result)
  }, [upload])

  const handleSend = useCallback(() => {
    const plainText = htmlToPlainText(html).trim()
    const hasContent = plainText.length > 0
    const hasAttachment = !!pendingAttachment

    if ((!hasContent && !hasAttachment) || isPending || isUploading) return

    sendMessage({
      content: hasContent ? html : ' ',
      parentId,
      attachments: pendingAttachment ? [pendingAttachment] : undefined,
    })
    setHtml('')
    setPendingAttachment(null)
    resetUpload()
  }, [html, isPending, isUploading, sendMessage, parentId, pendingAttachment, resetUpload])

  // Detect / at start of input to trigger slash command picker
  const handleChange = useCallback((newHtml: string) => {
    setHtml(newHtml)
    const plain = htmlToPlainText(newHtml).trim()
    if (plain === '/') {
      setShowSlashCommand(true)
    } else if (!plain.startsWith('/')) {
      setShowSlashCommand(false)
    }
  }, [])

  // When a reference is selected from the slash picker, insert a clickable chip
  const handleReferenceSelect = useCallback((item: { id: string; title: string; type: string; status: string }) => {
    setShowSlashCommand(false)
    const typeLabel = item.type === 'it' ? 'IT' : item.type === 'maintenance' ? 'Maintenance' : 'Event'
    const href = item.type === 'maintenance' ? `/maintenance/tickets/${item.id}`
      : item.type === 'it' ? `/it?ticket=${item.id}`
      : `/events/${item.id}`
    const chipHtml = `<a href="${href}" data-type="reference" data-id="${item.id}" data-ref-type="${item.type}" class="reference-chip" target="_blank" rel="noopener">${typeLabel}: ${item.title}</a>&nbsp;`
    // Clear the "/" and insert the chip
    setHtml('')
    setTimeout(() => {
      editorRef.current?.insertContent(chipHtml)
    }, 50)
  }, [])

  const canSend = (htmlToPlainText(html).trim().length > 0 || !!pendingAttachment) && !isPending && !isUploading

  return (
    <div className="bg-white border-t border-slate-200 px-4 py-3">
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

      {/* Slash command picker */}
      {showSlashCommand && (
        <div className="relative mb-2">
          <div className="absolute bottom-0 left-0 z-50">
            <SlashCommandPicker
              onSelect={handleReferenceSelect}
              onClose={() => setShowSlashCommand(false)}
            />
          </div>
        </div>
      )}

      {/* Rich text editor */}
      <RichTextEditor
        content={html}
        onChange={handleChange}
        onSubmit={handleSend}
        onTyping={onSendTyping}
        placeholder="Type a message..."
        onEditorReady={(e) => { editorRef.current = e }}
        channelId={channelId}
        currentUserId={user?.id}
      />

      {/* Bottom toolbar: attach, emoji, send */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          {/* eslint-disable-next-line no-restricted-syntax -- Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Add emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            {showEmoji && (
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <EmojiPicker
                  onSelect={(emoji) => {
                    editorRef.current?.insertContent(emoji)
                    setShowEmoji(false)
                  }}
                  onClose={() => setShowEmoji(false)}
                />
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGif((v) => !v)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Send GIF"
            >
              <ImagePlay className="w-5 h-5" />
            </button>
            {showGif && (
              <div className="absolute bottom-full left-0 mb-2 z-50">
                <GifPicker
                  onSelect={(gifUrl) => {
                    // Send the GIF as a message immediately
                    sendMessage({
                      content: `<img src="${gifUrl}" alt="GIF" class="inline-gif" />`,
                      parentId,
                    })
                    setShowGif(false)
                  }}
                  onClose={() => setShowGif(false)}
                />
              </div>
            )}
          </div>
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
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  )
}
