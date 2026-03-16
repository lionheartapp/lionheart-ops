'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import AnimatedOrb from '@/components/ai/AnimatedOrb'
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

function LeoAvatar() {
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full"
      style={{
        background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
      }}
    >
      <Sparkles className="h-3 w-3 text-white" aria-hidden="true" />
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <LeoAvatar />
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/50 px-3 py-2 rounded-xl rounded-bl-sm shadow-sm inline-flex items-center gap-1.5">
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
        <div
          className="max-w-[85%] px-3 py-2 rounded-xl rounded-br-sm text-white text-sm leading-relaxed shadow-md"
          style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2">
      <LeoAvatar />
      <div className="max-w-[85%] bg-white/90 backdrop-blur-sm border border-slate-200/50 px-3 py-2 rounded-xl rounded-bl-sm text-sm text-slate-900 leading-relaxed whitespace-pre-wrap shadow-sm">
        {message.content}
      </div>
    </div>
  )
}

// ─── Initial message ──────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content:
    "Hi! Tell me about the event you're planning. Include details like the type of event, dates, location, expected number of attendees, and any special requirements — I'll take care of the rest.",
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
            ? 'Leo needs a Gemini API key to work. Please configure GEMINI_API_KEY in your environment.'
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
          content: 'Something went wrong connecting to Leo. Please try again.',
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
      <div className="relative flex-shrink-0 px-4 py-3 border-b border-slate-200/50 flex items-center gap-2">
        <LeoAvatar />
        <div>
          <p className="text-sm font-semibold text-slate-900">Leo</p>
          {isBusy && (
            <p className="text-[10px] text-indigo-500 font-medium -mt-0.5">Thinking...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 leo-scrollbar"
        style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}
      >
        {messages.length === 1 && messages[0].role === 'assistant' && !isLoading ? (
          /* Empty state with orb — matches Leo chatbot */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <AnimatedOrb state="idle" size={80} className="mb-5" />
            <p className="text-sm font-medium text-slate-700 mb-1">
              Hi! I&apos;m Leo, your Event Planner
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tell me about the event you&apos;re planning — type, dates, location, attendees, and any special requirements.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="bg-white/60 backdrop-blur-sm border-t border-slate-200/40 px-4 py-3 flex-shrink-0">
        {hasFirstSuggestion && (
          <p className="text-xs text-slate-400 mb-2">
            Ask Leo to refine — try &quot;Make it 3 days&quot; or &quot;Add a pool party on day 2&quot;
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
                ? 'Ask Leo to refine...'
                : 'Describe your event to Leo...'
            }
            rows={2}
            disabled={isBusy}
            className="flex-1 resize-none rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-300 focus:bg-white transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || isBusy}
            className="flex-shrink-0 w-10 h-10 rounded-full text-white flex items-center justify-center hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
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
    ? "Done! I've updated the event based on your feedback."
    : `Great — I've put together an event plan for **${suggestion.title}**.`

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
