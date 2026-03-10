'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, MicOff, Square } from 'lucide-react'
import { useSpeechRecognition } from '@/lib/hooks/useSpeechRecognition'

interface InputFormProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
  isAvailable: boolean
  /** Called when listening state changes (drives the glow effect) */
  onListeningChange?: (listening: boolean) => void
}

/**
 * Chat input form with auto-resizing textarea and voice input.
 * Enter sends, Shift+Enter adds a newline.
 * Mic button toggles speech recognition.
 */
export default function InputForm({
  onSendMessage,
  isLoading,
  isAvailable,
  onListeningChange,
}: InputFormProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
      }
    }
  }, [transcript])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const msg = input.trim()
      if (!msg || isLoading) return

      // Stop listening if active
      if (isListening) {
        stopListening()
      }
      clearTranscript()

      onSendMessage(msg)
      setInput('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    },
    [input, isLoading, isListening, stopListening, clearTranscript, onSendMessage]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
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

  if (!isAvailable) {
    return (
      <div className="px-4 py-3 bg-amber-50 border-t border-gray-200">
        <p className="text-xs text-amber-700 text-center">
          AI Assistant is not available right now. Please try again later.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white px-3 py-3 rounded-b-2xl">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening...' : 'Ask anything...'}
          disabled={isLoading}
          rows={1}
          className={`flex-1 resize-none rounded-lg border bg-gray-50 px-3 py-2 text-sm leading-relaxed placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${
            isListening
              ? 'border-purple-400 focus:border-purple-400 focus:ring-purple-400'
              : 'border-gray-300 focus:border-blue-400 focus:ring-blue-400'
          }`}
        />

        {/* Mic button */}
        {voiceSupported && (
          <button
            type="button"
            onClick={handleMicClick}
            disabled={isLoading}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
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
          disabled={isLoading || !input.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-500"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-gray-400">
        {isListening ? 'Speak now — tap stop when done' : 'Shift+Enter for new line'}
      </p>
    </form>
  )
}
