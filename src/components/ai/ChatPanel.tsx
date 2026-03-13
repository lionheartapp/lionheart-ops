'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw, Clock } from 'lucide-react'
import MessageList from './MessageList'
import InputForm from './InputForm'
import ActionConfirmation from './ActionConfirmation'
import RichConfirmationCard from './RichConfirmationCard'
import WorkflowPlanCard from './WorkflowPlanCard'
import AiGlow from './AiGlow'
import ConversationSidebar from './ConversationSidebar'
import type { ConversationTurn, ActionConfirmation as ActionConfirmationType, StreamEvent, ImageAttachment, WorkflowPlan, WorkflowStep } from '@/lib/types/assistant'

interface ChatPanelProps {
  onClose?: () => void
  /** Notifies parent when AI is active (listening or thinking) */
  onAiActiveChange?: (active: boolean) => void
  /** 'floating' = fixed-position popup (default), 'embedded' = fills parent container */
  variant?: 'floating' | 'embedded'
}

/**
 * Main AI Assistant chat panel.
 * Manages conversation state, sends messages to the API,
 * and handles action confirmations for write operations.
 * Streams responses via SSE for real-time text display.
 *
 * Supports two layout modes:
 * - floating (default): fixed-position popup with close button
 * - embedded: fills parent container, no close button (used in dashboard right rail)
 */
export default function ChatPanel({ onClose, onAiActiveChange, variant = 'floating' }: ChatPanelProps) {
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [isListening, setIsListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<ActionConfirmationType | null>(null)
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowPlan | null>(null)
  const [workflowStepStatuses, setWorkflowStepStatuses] = useState<Record<number, WorkflowStep['status']>>({})
  const [workflowStepErrors, setWorkflowStepErrors] = useState<Record<number, string>>({})
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false)
  const [activeTools, setActiveTools] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // AI is "active" when listening (voice) or thinking (loading/streaming)
  const isAiActive = isListening || isLoading || isStreaming

  // Granular state for the animated orb
  const aiState = isListening ? 'listening' as const : isLoading ? 'thinking' as const : isStreaming ? 'streaming' as const : 'idle' as const

  useEffect(() => {
    onAiActiveChange?.(isAiActive)
  }, [isAiActive, onAiActiveChange])

  const handleListeningChange = useCallback((listening: boolean) => {
    setIsListening(listening)
  }, [])

  const handleSendMessage = useCallback(
    async (message: string, images?: ImageAttachment[]) => {
      if ((!message.trim() && (!images || images.length === 0)) || isLoading || isStreaming) return

      // Clear any pending action confirmation — the user chose to interact
      // via the conversation flow instead of the confirmation overlay
      setPendingAction(null)

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
        ...(images && images.length > 0 ? { images } : {}),
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
            conversationId: conversationId || undefined,
            ...(images && images.length > 0 ? { images } : {}),
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
                  // Merge rich card onto existing pending action (preserving payload from action_confirmation)
                  setPendingAction((prev) => {
                    const cardType = event.card?.cardType
                    const fallbackType = cardType === 'ticket' ? 'create_maintenance_ticket' : 'create_event'
                    const fallbackDesc = cardType === 'ticket' ? 'Ticket draft ready for review' : 'Event draft ready for review'

                    return prev ? {
                      ...prev,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      richCard: event.card,
                    } as any : {
                      type: fallbackType,
                      description: fallbackDesc,
                      payload: {},
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      richCard: event.card,
                    } as any
                  })
                  break

                case 'workflow_plan':
                  setPendingWorkflow(event.plan)
                  setWorkflowStepStatuses({})
                  setWorkflowStepErrors({})
                  break

                case 'conversation_id':
                  setConversationId(event.conversationId)
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

  const handleConfirmAction = useCallback(async (modifiedPayload?: Record<string, unknown>) => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    setIsLoading(true)

    try {
      const payload = modifiedPayload || action.payload
      const res = await fetch('/api/ai/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: payload.action || action.type,
          payload,
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

  const handleApproveWorkflow = useCallback(async () => {
    if (!pendingWorkflow || isExecutingWorkflow) return
    setIsExecutingWorkflow(true)

    try {
      const res = await fetch('/api/ai/assistant/execute-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ steps: pendingWorkflow.steps }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event: StreamEvent = JSON.parse(jsonStr)

            switch (event.type) {
              case 'workflow_step_start':
                setWorkflowStepStatuses((prev) => ({
                  ...prev,
                  [event.stepNumber]: 'running',
                }))
                break

              case 'workflow_step_complete':
                setWorkflowStepStatuses((prev) => ({
                  ...prev,
                  [event.stepNumber]: 'done',
                }))
                break

              case 'workflow_step_failed':
                setWorkflowStepStatuses((prev) => ({
                  ...prev,
                  [event.stepNumber]: 'failed',
                }))
                setWorkflowStepErrors((prev) => ({
                  ...prev,
                  [event.stepNumber]: event.error,
                }))
                break

              case 'workflow_complete':
                setConversation((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: event.summary,
                    timestamp: new Date().toISOString(),
                  },
                ])
                // Clear workflow after a brief delay so user sees final state
                setTimeout(() => {
                  setPendingWorkflow(null)
                  setIsExecutingWorkflow(false)
                  setWorkflowStepStatuses({})
                  setWorkflowStepErrors({})
                }, 1500)
                break

              case 'error':
                setConversation((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content: event.message,
                    timestamp: new Date().toISOString(),
                  },
                ])
                setIsExecutingWorkflow(false)
                break
            }
          } catch {
            // Malformed SSE — skip
          }
        }
      }
    } catch {
      setConversation((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Network error. The workflow may not have completed.',
          timestamp: new Date().toISOString(),
        },
      ])
      setIsExecutingWorkflow(false)
    }
  }, [pendingWorkflow, isExecutingWorkflow])

  const handleCancelWorkflow = useCallback(() => {
    setPendingWorkflow(null)
    setWorkflowStepStatuses({})
    setWorkflowStepErrors({})
    setIsExecutingWorkflow(false)
    setConversation((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: 'No problem — I cancelled the workflow.',
        timestamp: new Date().toISOString(),
      },
    ])
  }, [])

  const handleClearChat = useCallback(() => {
    abortRef.current?.abort()
    setConversation([])
    setConversationId(null)
    setIsLoading(false)
    setIsStreaming(false)
    setActiveTools([])
    setPendingAction(null)
    setPendingWorkflow(null)
    setWorkflowStepStatuses({})
    setWorkflowStepErrors({})
    setIsExecutingWorkflow(false)
  }, [])

  const handleChoiceSelect = useCallback((choice: string) => {
    handleSendMessage(choice)
  }, [handleSendMessage])

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    handleSendMessage(suggestion)
  }, [handleSendMessage])

  const handleFeedback = useCallback(async (messageId: string, score: number) => {
    if (!conversationId) return
    try {
      await fetch(`/api/conversations/${conversationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId, score }),
      })
      // Update local conversation state to reflect feedback
      setConversation((prev) =>
        prev.map((turn) =>
          turn.messageId === messageId ? { ...turn, feedbackScore: score } : turn
        )
      )
    } catch {
      // silent
    }
  }, [conversationId])

  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const json = await res.json()
      if (!json.ok || !Array.isArray(json.data?.messages)) return

      // Map persisted messages to ConversationTurn format
      const turns: ConversationTurn[] = json.data.messages
        .filter((msg: { role: string }) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg: { role: string; content: string; createdAt: string; id: string; feedbackScore?: number }) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          timestamp: msg.createdAt,
          messageId: msg.id,
          feedbackScore: msg.feedbackScore ?? undefined,
        }))

      setConversation(turns)
      setConversationId(id)
      setShowSidebar(false)
      setPendingAction(null)
      setPendingWorkflow(null)
      setWorkflowStepStatuses({})
      setWorkflowStepErrors({})
    } catch {
      // silent
    }
  }, [])

  const handleNewConversation = useCallback(() => {
    handleClearChat()
    setShowSidebar(false)
  }, [handleClearChat])

  const isEmbedded = variant === 'embedded'

  const panelContent = (
    <div
      className={`relative flex flex-col ${
        isEmbedded
          ? 'w-full h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200/60 shadow-sm'
          : 'w-[384px] rounded-2xl border border-slate-200/60 shadow-2xl'
      }`}
      style={{
        background: 'linear-gradient(rgb(255 255 255) 0%, rgb(249 252 255) 100%)',
        ...(isEmbedded ? {} : { height: '520px' }),
      }}
    >
      {/* Header — minimal glass style */}
      <div className="relative flex-shrink-0 flex items-center justify-between px-4 pt-2.5 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
            }}
          >
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Leo</h3>
            {isAiActive && (
              <p className="text-[10px] text-indigo-500 font-medium -mt-0.5">
                {isListening ? 'Listening...' : isLoading ? 'Thinking...' : 'Responding...'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSidebar((prev) => !prev)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            aria-label="Conversation history"
            title="Conversation history"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          {conversation.length > 0 && (
            <button
              onClick={handleClearChat}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              aria-label="Clear conversation"
              title="New conversation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {!isEmbedded && onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              aria-label="Close"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          )}
        </div>

        {/* Aurora accent line — below header */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{
            background: isAiActive
              ? 'linear-gradient(90deg, #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)'
              : 'linear-gradient(90deg, #3B82F6, #6366F1)',
            backgroundSize: isAiActive ? '200% 100%' : '100% 100%',
            animation: isAiActive ? 'glowSlide 2s linear infinite' : 'none',
            opacity: isAiActive ? 1 : 0.5,
          }}
        />
      </div>

      {/* Conversation history sidebar */}
      <ConversationSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        activeConversationId={conversationId}
      />

      {/* Messages */}
      <MessageList
        conversation={conversation}
        isLoading={isLoading}
        isStreaming={isStreaming}
        activeTools={activeTools}
        aiState={aiState}
        onChoiceSelect={handleChoiceSelect}
        onSuggestionSelect={handleSuggestionSelect}
        onFeedback={handleFeedback}
      />

      {/* Input with voice */}
      <InputForm
        onSendMessage={handleSendMessage}
        isLoading={isLoading || isStreaming}
        isAvailable={isAvailable}
        onListeningChange={handleListeningChange}
      />

      {/* Action confirmation overlay */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {pendingAction && (
        (pendingAction as any).richCard ? (
          <RichConfirmationCard
            action={pendingAction as any}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        ) : (
          <ActionConfirmation
            action={pendingAction}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )
      )}

      {/* Workflow plan overlay */}
      {pendingWorkflow && (
        <WorkflowPlanCard
          plan={pendingWorkflow}
          stepStatuses={workflowStepStatuses}
          stepErrors={workflowStepErrors}
          isExecuting={isExecutingWorkflow}
          onApprove={handleApproveWorkflow}
          onCancel={handleCancelWorkflow}
        />
      )}
    </div>
  )

  // Embedded mode: render inline, no fixed positioning or AiGlow wrapper
  if (isEmbedded) {
    return (
      <>
        {panelContent}
        <style jsx global>{`
          @keyframes glowSlide {
            from { background-position: 0% 50%; }
            to { background-position: 200% 50%; }
          }
        `}</style>
      </>
    )
  }

  // Floating mode: fixed-position popup with AiGlow and entrance animation
  return (
    <motion.div
      className="fixed bottom-24 right-6 z-50"
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <AiGlow active={isAiActive} shape="rounded">
        {panelContent}
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
