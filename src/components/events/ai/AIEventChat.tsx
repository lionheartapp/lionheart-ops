'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import type { AIEventSuggestion } from '@/lib/types/event-ai'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export interface AIEventChatProps {
  onSuggestionGenerated: (suggestion: AIEventSuggestion) => void
  onRefinement: (field: string, instruction: string) => void
  isGenerating: boolean
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      {/* Avatar badge */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
        <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
      </div>
      <div className="ui-glass px-4 py-3 rounded-2xl rounded-bl-sm inline-flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-sm bg-gray-900 text-white text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      {/* Sparkle avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
        <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
      </div>
      <div className="max-w-[80%] ui-glass px-4 py-3 rounded-2xl rounded-bl-sm text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}

// ─── Initial message ──────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Tell me about the event you're planning. Include details like the type of event, dates, location, expected number of attendees, and any special requirements.",
  timestamp: new Date(),
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIEventChat({ onSuggestionGenerated, onRefinement, isGenerating }: AIEventChatProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasFirstSuggestion, setHasFirstSuggestion] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ─── Scroll to bottom on new messages ──────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ─── Send message ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading || isGenerating) return

    const userMessage: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/events/ai/create-from-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        const errorMsg =
          json?.error?.code === 'AI_UNAVAILABLE'
            ? 'AI features require a Gemini API key. Please configure GEMINI_API_KEY in your environment.'
            : json?.error?.message ?? 'Something went wrong. Please try again.'

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: errorMsg, timestamp: new Date() },
        ])
        return
      }

      const suggestion: AIEventSuggestion = json.data

      // Build a natural-language summary of what was generated
      const summary = buildSummaryMessage(suggestion, hasFirstSuggestion, trimmed)

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: summary, timestamp: new Date() },
      ])

      if (!hasFirstSuggestion) {
        setHasFirstSuggestion(true)
        onSuggestionGenerated(suggestion)
      } else {
        // Refinement — pass back as a refinement instruction
        onRefinement('all', trimmed)
        onSuggestionGenerated(suggestion)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong connecting to AI. Please try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, isGenerating, hasFirstSuggestion, onSuggestionGenerated, onRefinement])

  // ─── Keyboard handler ───────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const isBusy = isLoading || isGenerating

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200/50 flex items-center gap-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Event AI</p>
          <p className="text-xs text-gray-400">Describe your event in natural language</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200/50 flex-shrink-0">
        {hasFirstSuggestion && (
          <p className="text-xs text-gray-400 mb-2">
            You can refine the event — try &quot;Make it 3 days&quot; or &quot;Add a pool party on day 2&quot;
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasFirstSuggestion
                ? 'Refine the event description...'
                : 'Describe your event (type, dates, location, attendees)...'
            }
            rows={3}
            disabled={isBusy}
            className="flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isBusy}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Send message"
          >
            {isBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSummaryMessage(
  suggestion: AIEventSuggestion,
  isRefinement: boolean,
  _userInput: string,
): string {
  const blockCount = suggestion.scheduleBlocks?.length ?? 0
  const taskCount = suggestion.suggestedTasks?.length ?? 0
  const docCount = suggestion.suggestedDocs?.length ?? 0
  const budgetCount = suggestion.budgetEstimate?.length ?? 0

  const prefix = isRefinement
    ? "I've updated the event based on your feedback."
    : `I've created an event plan for **${suggestion.title}**.`

  const details: string[] = []
  if (blockCount > 0) details.push(`${blockCount} schedule block${blockCount !== 1 ? 's' : ''}`)
  if (taskCount > 0) details.push(`${taskCount} task${taskCount !== 1 ? 's' : ''}`)
  if (docCount > 0) details.push(`${docCount} document${docCount !== 1 ? 's' : ''}`)
  if (budgetCount > 0) details.push(`${budgetCount} budget categor${budgetCount !== 1 ? 'ies' : 'y'}`)

  const summary =
    details.length > 0
      ? ` It includes ${details.join(', ')}. Review the preview on the right and edit anything before creating.`
      : ' Review the preview on the right and edit anything before creating.'

  return prefix + summary
}
