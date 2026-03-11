'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw } from 'lucide-react'
import MessageList from './MessageList'
import InputForm from './InputForm'
import ActionConfirmation from './ActionConfirmation'
import AiGlow from './AiGlow'
import type { ConversationTurn, ActionConfirmation as ActionConfirmationType, StreamEvent } from '@/lib/types/assistant'

interface ChatPanelProps {
  onClose: () => void
  /** Notifies parent when AI is active (listening or thinking) */
  onAiActiveChange?: (active: boolean) => void
}

/**
 * Main AI Assistant chat panel.
 * Manages conversation state, sends messages to the API,
 * and handles action confirmations for write operations.
 * Streams responses via SSE for real-time text display.
 */
export default function ChatPanel({ onClose, onAiActiveChange }: ChatPanelProps) {
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionConfirmationType | null>(null)
  const [activeTools, setActiveTools] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // AI is "active" when listening (voice) or thinking (loading/streaming)
  const isAiActive = isListening || isLoading || isStreaming

  useEffect(() => {
    onAiActiveChange?.(isAiActive)
  }, [isAiActive, onAiActiveChange])

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsListening(listening)
  }, [])

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading || isStreaming) return

      // Clear choices/suggestions from the previous assistant message
      setConversation((prev) => {
        if (prev.length === 0) return prev
        const updated = [...prev]
        const lastIdx = updated.length - 1
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = { ...updated[lastIdx], choices: undefined, suggestions: undefined }
        }
        return updated
      })

      // Optimistically add user message + empty assistant placeholder
      const userTurn: ConversationTurn = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }
      setConversation((prev) => [...prev, userTurn])
      setIsLoading(true)
      setActiveTools([])

      // Abort any previous stream
      abortRef.current?.abort()
      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        const res = await fetch('/api/ai/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message,
            conversationHistory: conversation,
          }),
          signal: abortController.signal,
        })

        // Non-streaming response (e.g., { available: false })
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          const json = await res.json()
          setIsLoading(false)

          if (!json.ok) {
            setConversation((prev) => [
              ...prev,
              {
                role: 'assistant',
                content: json.error?.message || 'Something went wrong. Please try again.',
                timestamp: new Date().toISOString(),
              },
            ])
            return
          }

          if (!json.data.available) {
            setIsAvailable(false)
            setConversation((prev) => prev.slice(0, -1))
            return
          }

          setConversation(json.data.conversationHistory)
          if (json.data.actionConfirmation) {
            setPendingAction(json.data.actionConfirmation)
          }
          return
        }

        // SSE streaming response
        if (!res.body) {
          throw new Error('No response body')
        }

        setIsLoading(false)
        setIsStreaming(true)

        // Add empty assistant message to fill incrementally
        const assistantTurn: ConversationTurn = {
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        }
        setConversation((prev) => [...prev, assistantTurn])

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let streamedContent = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse SSE lines from buffer
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6).trim()
            if (!jsonStr) continue

            try {
              const event: StreamEvent = JSON.parse(jsonStr)

              switch (event.type) {
                case 'delta':
                  streamedContent += event.content
                  setConversation((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: streamedContent }
                    }
                    return updated
                  })
                  break

                case 'tool_start':
                  setActiveTools((prev) => [...prev, event.tool])
                  break

                case 'tool_result':
                  setActiveTools((prev) => prev.filter((t) => t !== event.tool))
                  break

                case 'action_confirmation':
                  setPendingAction(event.action)
                  break

                case 'choices':
                  // Store choices on the last assistant turn
                  setConversation((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, choices: event.options }
                    }
                    return updated
                  })
                  break

                case 'suggestions':
                  // Store suggestions on the last assistant turn
                  setConversation((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, suggestions: event.items }
                    }
                    return updated
                  })
                  break

                case 'rich_confirmation':
                  // Store the rich confirmation card data as a pending action
                  // Plan 14-03 will add the richCard field to ActionConfirmation properly
                  setPendingAction({
                    type: 'create_event',
                    description: 'Event draft ready for review',
                    payload: {},
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    richCard: event.card,
                  } as any)
                  break

                case 'done':
                  setConversation(event.conversationHistory)
                  break

                case 'error':
                  setConversation((prev) => {
                    const updated = [...prev]
                    const last = updated[updated.length - 1]
                    if (last?.role === 'assistant' && !last.content) {
                      updated[updated.length - 1] = { ...last, content: event.message }
                    } else {
                      updated.push({
                        role: 'assistant',
                        content: event.message,
                        timestamp: new Date().toISOString(),
                      })
                    }
                    return updated
                  })
                  break
              }
            } catch {
              // Malformed SSE line — skip
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.error('[ChatPanel] Stream error:', error)
        setConversation((prev) => {
          // If last message is an empty assistant placeholder, fill it
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: 'Network error. Please check your connection and try again.',
            }
          } else {
            updated.push({
              role: 'assistant',
              content: 'Network error. Please check your connection and try again.',
              timestamp: new Date().toISOString(),
            })
          }
          return updated
        })
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
        setActiveTools([])
      }
    },
    [conversation, isLoading, isStreaming]
  )

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: action.payload.action || action.type,
          payload: action.payload,
        }),
      })
      const json = await res.json()

      const message = json.ok
        ? json.data.message || 'Done!'
        : json.error?.message || 'Something went wrong. Please try again.'

      setConversation((prev) => [
        ...prev,
        { role: 'assistant', content: message, timestamp: new Date().toISOString() },
      ])
    } catch {
      setConversation((prev) => [
        ...prev,
        { role: 'assistant', content: 'Network error. The action may not have completed.', timestamp: new Date().toISOString() },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [pendingAction])

  const handleCancelAction = useCallback(() => {
    setPendingAction(null)
    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'No problem — I cancelled that action.',
        timestamp: new Date().toISOString(),
      },
    ])
  }, [])

  const handleClearChat = useCallback(() => {
    abortRef.current?.abort()
    setConversation([])
    setIsLoading(false)
    setIsStreaming(false)
    setActiveTools([])
  }, [])

  const handleChoiceSelect = useCallback((choice: string) => {
    handleSendMessage(choice)
  }, [handleSendMessage])

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    handleSendMessage(suggestion)
  }, [handleSendMessage])

  return (
    <motion.div
      className="fixed bottom-24 right-6 z-50"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <AiGlow active={isAiActive} shape="rounded">
        <div
          className="flex w-[384px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
            {isAiActive && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-[2px] ai-glow-spin"
                style={{
                  background:
                    'linear-gradient(90deg, #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)',
                  backgroundSize: '200% 100%',
                  animation: 'glowSlide 2s linear infinite',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}

            <div className="flex items-center gap-2">
              <Sparkles className={`h-4 w-4 ${isAiActive ? 'text-white animate-pulse' : 'text-white/90'}`} />
              <h3 className="text-sm font-semibold text-white">
                {isListening ? 'Listening...' : isLoading ? 'Thinking...' : isStreaming ? 'Leo' : 'Leo'}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {conversation.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                  aria-label="Clear conversation"
                  title="New conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Close"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <MessageList
            conversation={conversation}
            isLoading={isLoading}
            isStreaming={isStreaming}
            activeTools={activeTools}
            onChoiceSelect={handleChoiceSelect}
            onSuggestionSelect={handleSuggestionSelect}
          />

          {/* Input with voice */}
          <InputForm
            onSendMessage={handleSendMessage}
            isLoading={isLoading || isStreaming}
            isAvailable={isAvailable}
            onListeningChange={handleListeningChange}
          />

          {/* Action confirmation overlay */}
          {pendingAction && (
            <ActionConfirmation
              action={pendingAction}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
            />
          )}
        </div>
      </AiGlow>

      <style jsx global>{`
        @keyframes glowSlide {
          from {
            background-position: 0% 50%;
          }
          to {
            background-position: 200% 50%;
          }
        }
      `}</style>
    </motion.div>
  )
}
