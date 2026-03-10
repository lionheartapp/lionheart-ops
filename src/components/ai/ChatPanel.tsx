'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw } from 'lucide-react'
import MessageList from './MessageList'
import InputForm from './InputForm'
import ActionConfirmation from './ActionConfirmation'
import AiGlow from './AiGlow'
import type { ConversationTurn, ActionConfirmation as ActionConfirmationType } from '@/lib/types/assistant'

interface ChatPanelProps {
  onClose: () => void
  /** Notifies parent when AI is active (listening or thinking) */
  onAiActiveChange?: (active: boolean) => void
}

/**
 * Main AI Assistant chat panel.
 * Manages conversation state, sends messages to the API,
 * and handles action confirmations for write operations.
 * Shows Apple Intelligence gradient glow when listening/thinking.
 */
export default function ChatPanel({ onClose, onAiActiveChange }: ChatPanelProps) {
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionConfirmationType | null>(null)

  // AI is "active" when listening (voice) or thinking (loading)
  const isAiActive = isListening || isLoading

  // Propagate active state to parent (drives button glow when panel is closed)
  useEffect(() => {
    onAiActiveChange?.(isAiActive)
  }, [isAiActive, onAiActiveChange])

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsListening(listening)
  }, [])

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isLoading) return

      // Optimistically add user message
      const userTurn: ConversationTurn = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }
      setConversation((prev) => [...prev, userTurn])
      setIsLoading(true)

      try {
        const res = await fetch('/api/ai/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message,
            conversationHistory: conversation,
          }),
        })

        const json = await res.json()

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
      } catch (error) {
        console.error('[ChatPanel] Fetch error:', error)
        setConversation((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Network error. Please check your connection and try again.',
            timestamp: new Date().toISOString(),
          },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [conversation, isLoading]
  )

  const handleConfirmAction = useCallback(() => {
    setPendingAction(null)
    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'Action confirmed. This feature will create the ticket in a future update.',
        timestamp: new Date().toISOString(),
      },
    ])
  }, [])

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
    setConversation([])
  }, [])

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
          {/* Header — shows animated gradient bar when active */}
          <div className="relative flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
            {/* Active indicator bar */}
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
                {isListening ? 'Listening...' : isLoading ? 'Thinking...' : 'AI Assistant'}
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
          <MessageList conversation={conversation} isLoading={isLoading} />

          {/* Input with voice */}
          <InputForm
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
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

      {/* Additional animation for the gradient slide in the header bar */}
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
