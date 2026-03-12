'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Mic, MicOff, Square, ImagePlus, X } from 'lucide-react'
import { useSpeechRecognition } from '@/lib/hooks/useSpeechRecognition'
import { ALLOWED_IMAGE_TYPES } from '@/lib/validation/file-upload'
import type { ImageAttachment } from '@/lib/types/assistant'
import MentionDropdown from './MentionDropdown'
import { useGlobalSearch } from '@/lib/hooks/useGlobalSearch'

const MAX_IMAGES = 3
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4MB

interface InputFormProps {
  onSendMessage: (message: string, images?: ImageAttachment[]) => void
  isLoading: boolean
  isAvailable: boolean
  /** Called when listening state changes (drives the glow effect) */
  onListeningChange?: (listening: boolean) => void
}

/**
 * Chat input form with auto-resizing textarea, voice input, and image upload.
 * Enter sends, Shift+Enter adds a newline.
 * Mic button toggles speech recognition.
 * Images can be attached via button, paste, or drag-and-drop.
 */
export default function InputForm({
  onSendMessage,
  isLoading,
  isAvailable,
  onListeningChange,
}: InputFormProps) {
  const [input, setInput] = useState('')
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderTransition, setPlaceholderTransition] = useState(true)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStartIndex, setMentionStartIndex] = useState(0)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formWrapperRef = useRef<HTMLDivElement>(null)

  // @mention user search — reuses the global search endpoint (TanStack Query caches it)
  const mentionSearchQuery = mentionQuery && mentionQuery.length >= 1 ? mentionQuery : ''
  const { data: mentionSearchData, isLoading: mentionLoading } = useGlobalSearch(mentionSearchQuery)
  const mentionUsers = useMemo(
    () => mentionSearchData?.users?.slice(0, 5) ?? [],
    [mentionSearchData?.users]
  )
  const isMentionOpen = mentionQuery !== null && mentionQuery.length >= 1 && (mentionLoading || mentionUsers.length > 0)

  const PLACEHOLDER_EXAMPLES = useMemo(() => [
    'How many open tickets do we have?',
    'There\'s a leak in the boys bathroom...',
    'Schedule a staff meeting for Friday',
    'What events are coming up this week?',
    'Show me our maintenance stats',
    'Create an IT ticket for a broken projector',
  ], [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    toggleListening,
    stopListening,
    clearTranscript,
  } = useSpeechRecognition()

  // Notify parent when listening state changes
  useEffect(() => {
    onListeningChange?.(isListening)
  }, [isListening, onListeningChange])

  // Sync transcript into the input field
  useEffect(() => {
    if (transcript) {
      setInput(transcript)
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
      }
    }
  }, [transcript])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Cycle placeholder examples when not focused and empty
  // Uses a clone of the first item at end of list for seamless wrap
  useEffect(() => {
    if (isFocused || input) return
    const total = PLACEHOLDER_EXAMPLES.length
    const timer = setInterval(() => {
      setPlaceholderIdx((prev) => {
        const next = prev + 1
        if (next === total) {
          // Animate to the clone (index = total), then snap back to 0
          setPlaceholderTransition(true)
          setTimeout(() => {
            setPlaceholderTransition(false)
            setPlaceholderIdx(0)
            // Re-enable transition after the snap
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setPlaceholderTransition(true))
            })
          }, 500) // wait for the transition to finish
          return next
        }
        setPlaceholderTransition(true)
        return next
      })
    }, 3000)
    return () => clearInterval(timer)
  }, [isFocused, input, PLACEHOLDER_EXAMPLES])

  // Clear image error after 3 seconds
  useEffect(() => {
    if (!imageError) return
    const timer = setTimeout(() => setImageError(null), 3000)
    return () => clearTimeout(timer)
  }, [imageError])

  /** Convert a File to ImageAttachment (base64) */
  const fileToAttachment = useCallback((file: File): Promise<ImageAttachment | null> => {
    // Validate type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError(`${file.name}: unsupported type. Use JPEG, PNG, WebP, or GIF.`)
      return Promise.resolve(null)
    }
    // Validate size
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`${file.name}: exceeds 4MB limit.`)
      return Promise.resolve(null)
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip data URL prefix: "data:image/png;base64,..."
        const base64 = result.split(',')[1]
        if (!base64) {
          resolve(null)
          return
        }
        resolve({ data: base64, mimeType: file.type, name: file.name })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }, [])

  /** Add files to the images list (respecting MAX_IMAGES) */
  const addFiles = useCallback(async (files: File[]) => {
    setImageError(null)
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      setImageError(`Max ${MAX_IMAGES} images allowed.`)
      return
    }

    const toProcess = files.slice(0, remaining)
    if (files.length > remaining) {
      setImageError(`Only ${remaining} more image(s) can be added.`)
    }

    const results = await Promise.all(toProcess.map(fileToAttachment))
    const valid = results.filter(Boolean) as ImageAttachment[]
    if (valid.length > 0) {
      setImages((prev) => [...prev, ...valid])
    }
  }, [images.length, fileToAttachment])

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const msg = input.trim()
      if ((!msg && images.length === 0) || isLoading) return

      // Stop listening if active
      if (isListening) {
        stopListening()
      }
      clearTranscript()

      onSendMessage(msg || '(image)', images.length > 0 ? images : undefined)
      setInput('')
      setImages([])
      setMentionQuery(null)
      setImageError(null)
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    },
    [input, images, isLoading, isListening, stopListening, clearTranscript, onSendMessage]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When mention dropdown is open, intercept navigation keys
    if (isMentionOpen && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionSelectedIndex((prev) => (prev + 1) % mentionUsers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionSelectedIndex((prev) => (prev - 1 + mentionUsers.length) % mentionUsers.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selectedUser = mentionUsers[mentionSelectedIndex]
        if (selectedUser) handleMentionSelect(selectedUser)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Detect @mention trigger from text + cursor position
  const detectMention = useCallback((text: string, cursorPos: number) => {
    // Walk backwards from cursor to find an unescaped @
    const before = text.slice(0, cursorPos)
    const atIdx = before.lastIndexOf('@')

    if (atIdx === -1) {
      setMentionQuery(null)
      return
    }

    // @ must be at start or preceded by a space/newline
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) {
      setMentionQuery(null)
      return
    }

    const query = before.slice(atIdx + 1)

    // Dismiss if query contains a space after a complete name (user already selected)
    // But allow spaces within the query for multi-word names like "Tom Sm"
    if (query.length > 30) {
      setMentionQuery(null)
      return
    }

    setMentionStartIndex(atIdx)
    setMentionQuery(query.length >= 1 ? query : query.length === 0 ? '' : null)
    setMentionSelectedIndex(0)
  }, [])

  // Handle @mention user selection
  const handleMentionSelect = useCallback((user: { firstName?: string | null; lastName?: string | null; email: string }) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
    const before = input.slice(0, mentionStartIndex)
    const after = input.slice(textareaRef.current?.selectionStart ?? input.length)
    const newValue = `${before}@${name} ${after}`
    setInput(newValue)
    setMentionQuery(null)

    // Restore focus and cursor position after insertion
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const cursorPos = before.length + name.length + 2 // @name + space
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(cursorPos, cursorPos)
        // Auto-resize
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
      }
    })
  }, [input, mentionStartIndex])

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setInput(value)
    detectMention(value, e.target.selectionStart ?? value.length)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  // Re-detect mentions when cursor position changes (click, arrow keys after dropdown closes)
  const handleSelect = () => {
    if (textareaRef.current) {
      detectMention(input, textareaRef.current.selectionStart)
    }
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      // Clear input if starting fresh
      if (!input.trim()) {
        clearTranscript()
      }
      toggleListening()
    }
  }

  const handleImageButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) addFiles(files)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  // Paste support
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
    }
  }, [addFiles])

  // Drag-and-drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) addFiles(files)
  }, [addFiles])

  if (!isAvailable) {
    return (
      <div className="px-4 py-3 bg-amber-50 border-t border-gray-200">
        <p className="text-xs text-amber-700 text-center">
          AI Assistant is not available right now. Please try again later.
        </p>
      </div>
    )
  }

  const acceptTypes = [...ALLOWED_IMAGE_TYPES].join(',')

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200/40 bg-white/60 backdrop-blur-sm px-3 py-3 rounded-b-2xl">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex gap-2 mb-2 px-0.5">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name}
                className="w-12 h-12 rounded-lg object-cover border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${img.name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {imageError && (
        <p className="text-xs text-red-500 mb-1.5 px-0.5">{imageError}</p>
      )}

      <div
        className={`flex items-center gap-2 ${isDragging ? 'rounded-lg ring-2 ring-blue-400 ring-dashed bg-blue-50/50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Image upload button */}
        <button
          type="button"
          onClick={handleImageButtonClick}
          disabled={isLoading || images.length >= MAX_IMAGES}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gray-100/80 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-40 cursor-pointer"
          aria-label="Attach image"
          title={images.length >= MAX_IMAGES ? `Max ${MAX_IMAGES} images` : 'Attach image'}
        >
          <ImagePlus className="h-4 w-4" />
        </button>

        <div className="relative flex-1" ref={formWrapperRef}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSelect={handleSelect}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isDragging ? 'Drop image here...' : isListening ? 'Listening...' : isFocused ? 'Ask anything...' : undefined}
            disabled={isLoading}
            rows={1}
            className={`w-full resize-none rounded-2xl border bg-gray-50/80 px-4 py-2.5 text-sm leading-relaxed overflow-hidden placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${
              isListening
                ? 'border-indigo-300 focus:border-indigo-400 focus:ring-indigo-400'
                : 'border-gray-200/80 focus:border-indigo-400 focus:ring-indigo-400'
            }`}
          />
          {/* Animated "Try:" placeholder with vertical scroll */}
          {!input && !isFocused && !isListening && !isDragging && (
            <div className="pointer-events-none absolute inset-0 flex items-start px-4 py-2.5 overflow-hidden">
              <span className="text-sm leading-relaxed text-gray-400 flex-shrink-0">Try:&nbsp;</span>
              <div className="relative overflow-hidden flex-1" style={{ height: '1.625em', fontSize: '0.875rem' }}>
                <div
                  style={{
                    transform: `translateY(-${placeholderIdx * 1.625}em)`,
                    transition: placeholderTransition ? 'transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
                    fontSize: '0.875rem',
                  }}
                >
                  {PLACEHOLDER_EXAMPLES.map((example, i) => (
                    <div key={i} className="text-sm leading-relaxed text-gray-400 truncate" style={{ height: '1.625em' }}>
                      {example}
                    </div>
                  ))}
                  {/* Clone of first item for seamless wrap */}
                  <div className="text-sm leading-relaxed text-gray-400 truncate" style={{ height: '1.625em' }}>
                    {PLACEHOLDER_EXAMPLES[0]}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* @mention autocomplete dropdown */}
          <MentionDropdown
            users={mentionUsers}
            isLoading={mentionLoading}
            isOpen={isMentionOpen}
            selectedIndex={mentionSelectedIndex}
            onSelect={handleMentionSelect}
            anchorBottom={(textareaRef.current?.offsetHeight ?? 44) + 4}
          />
        </div>

        {/* Mic button */}
        {voiceSupported && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isLoading}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-gray-100/80 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            } disabled:opacity-40`}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Send button */}
        <button
          type="submit"
          disabled={isLoading || (!input.trim() && images.length === 0)}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-white transition-all hover:shadow-md disabled:opacity-40 cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-gray-400">
        {isDragging ? 'Drop to attach' : isListening ? 'Speak now — tap stop when done' : 'Shift+Enter for new line · Paste or drop images'}
      </p>
    </form>
  )
}
