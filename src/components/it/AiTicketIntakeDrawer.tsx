'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Loader2, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface TicketData {
  ready: boolean
  module: string
  category: string
  title: string
  description: string
  priority: string
  locationText?: string
  customFields?: Record<string, unknown>
}

interface ResolutionData {
  selfResolved: boolean
  category: string
  issueDescription: string
  resolutionNote: string
}

interface AiTicketIntakeDrawerProps {
  isOpen: boolean
  onClose: () => void
  onTicketCreated?: (ticketNumber: string) => void
  onSwitchToManual?: () => void
  source?: 'DASHBOARD' | 'QR_CODE' | 'MAGIC_LINK'
  prefilledLocation?: string | null
  prefilledCategory?: string | null
  orgId?: string // for unauthenticated flows
}

const EXAMPLE_PROMPTS = [
  "My laptop won't connect to Wi-Fi",
  "I can't sign in to my account",
  "Projector in my room isn't displaying",
  "Smart board is frozen and won't restart",
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AiTicketIntakeDrawer({
  isOpen,
  onClose,
  onTicketCreated,
  onSwitchToManual,
  source = 'DASHBOARD',
  prefilledLocation,
  prefilledCategory,
  orgId,
}: AiTicketIntakeDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [resolutionData, setResolutionData] = useState<ResolutionData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketNumber, setTicketNumber] = useState('')
  const [selfResolved, setSelfResolved] = useState(false)
  const [aiErrored, setAiErrored] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const toastFiredRef = useRef(false)
  const { toast } = useToast()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, ticketData])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !streaming) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen, streaming])

  // Send initial greeting when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && !streaming) {
      sendMessage('hi', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const sendMessage = useCallback(async (text: string, isInitial = false) => {
    if (streaming) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = isInitial ? [] : [...messages, userMessage]

    if (!isInitial) {
      setMessages(newMessages)
    }
    setInput('')
    setStreaming(true)
    setTicketData(null)
    setResolutionData(null)

    try {
      const res = await fetch('/api/ai/ticket-intake/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          message: isInitial ? '[GREETING]' : text,
          history: newMessages.map((m) => ({ role: m.role, content: m.content })),
          source,
          prefilledLocation,
          prefilledCategory,
          ...(orgId && { orgId }),
        }),
      })

      // Check for non-streaming JSON response (AI unavailable)
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (data.data?.available === false) {
          // AI not available — caller should switch to manual form
          onClose()
          return
        }
      }

      // Parse SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let assistantText = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'delta' && event.content) {
              assistantText += event.content
              // Update assistant message in real time
              setMessages([
                ...newMessages,
                { role: 'assistant', content: stripJsonBlocks(assistantText) },
              ])
            }

            if (event.type === 'ticket_ready' && event.ticket) {
              setTicketData(event.ticket as TicketData)
            }

            if (event.type === 'self_resolved' && event.resolution) {
              setResolutionData(event.resolution as ResolutionData)
            }

            if (event.type === 'error') {
              toast(event.content || 'AI encountered an error', 'error')
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // Final message update
      if (assistantText) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: stripJsonBlocks(assistantText) },
        ])
      }
    } catch {
      setAiErrored(true)
      if (!toastFiredRef.current) {
        toastFiredRef.current = true
        toast('Something went wrong. You can still submit using the manual form.', 'error')
      }
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, source, prefilledLocation, prefilledCategory, orgId, toast, onClose])

  // Submit confirmed ticket
  async function handleSubmitTicket() {
    if (!ticketData) return
    setSubmitting(true)

    try {
      const res = await fetch('/api/ai/ticket-intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'submit_ticket',
          module: ticketData.module,
          category: ticketData.category,
          title: ticketData.title,
          description: ticketData.description,
          priority: ticketData.priority,
          locationText: ticketData.locationText,
          customFields: ticketData.customFields,
          source,
          ...(orgId && { orgId }),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        setTicketNumber(data.data.ticketNumber)
        setSubmitted(true)
        onTicketCreated?.(data.data.ticketNumber)
      } else {
        toast(data.error?.message || 'Failed to create ticket', 'error')
      }
    } catch {
      toast('Network error', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Log self-resolution
  async function handleSelfResolved() {
    if (!resolutionData) return

    try {
      await fetch('/api/ai/ticket-intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'self_resolved',
          category: resolutionData.category,
          issueDescription: resolutionData.issueDescription,
          resolutionNote: resolutionData.resolutionNote,
          source,
          ...(orgId && { orgId }),
        }),
      })
    } catch {
      // Silent — don't block the user
    }

    setSelfResolved(true)
  }

  // Handle close — log abandonment if conversation started
  function handleClose() {
    if (messages.length > 1 && !submitted && !selfResolved && !ticketData) {
      // Fire and forget abandonment log
      fetch('/api/ai/ticket-intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          action: 'abandoned',
          issueDescription: messages.find((m) => m.role === 'user')?.content ?? '',
          source,
          ...(orgId && { orgId }),
        }),
      }).catch(() => {})
    }

    // Reset state
    setMessages([])
    setInput('')
    setTicketData(null)
    setResolutionData(null)
    setSubmitted(false)
    setSelfResolved(false)
    setTicketNumber('')
    setAiErrored(false)
    toastFiredRef.current = false
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !streaming) {
        sendMessage(input.trim())
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose} />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(17,15,10,0.06)]">
          <div>
            <h3 className="text-base font-semibold text-[#1a1915]">IT Help</h3>
            <p className="text-xs text-[#a8a49d]">AI-assisted issue reporting</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-[#a8a49d] hover:text-[#1a1915] hover:bg-[#f5f4f0] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Welcome state — shown while waiting for initial AI greeting */}
          {messages.length === 0 && !submitted && !selfResolved && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#f5f4f0] px-4 py-3 text-sm text-[#6a6864] leading-relaxed">
                Hi! Tell me what&apos;s going on and I&apos;ll help get it sorted. You can describe
                the issue in your own words.
              </div>
              <div className="space-y-2">
                <p className="text-xs text-[#a8a49d] font-medium uppercase tracking-wide">Try something like...</p>
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => { if (!streaming) sendMessage(prompt) }}
                    disabled={streaming}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl border border-[rgba(17,15,10,0.08)] text-sm text-[#1a1915] hover:bg-[#f5f4f0] cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              {onSwitchToManual && (
                <button
                  type="button"
                  onClick={() => { onClose(); onSwitchToManual() }}
                  className="text-xs text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                >
                  Use manual form instead
                </button>
              )}
            </div>
          )}

          {/* AI error fallback */}
          {aiErrored && onSwitchToManual && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
              <p className="text-sm font-medium text-[#1a1915]">AI assistant is unavailable</p>
              <p className="text-xs text-[#6a6864]">You can still submit your issue using the manual form.</p>
              <button
                type="button"
                onClick={() => { onClose(); onSwitchToManual() }}
                className="mt-1 px-4 py-2 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all"
              >
                Open manual form
              </button>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1a1915] text-white rounded-br-md'
                      : 'bg-[#f5f4f0] text-[#1a1915] rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Streaming indicator */}
          {streaming && (
            <div className="flex justify-start">
              <div className="bg-[#f5f4f0] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a8a49d] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a8a49d] animate-pulse [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a8a49d] animate-pulse [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Ticket summary card */}
          {ticketData && !submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Ticket Summary
              </div>
              <div className="text-sm text-[#1a1915] space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#6a6864]">Category</span>
                  <span className="font-medium capitalize">{ticketData.category?.toLowerCase().replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6a6864]">Priority</span>
                  <span className={`font-medium ${ticketData.priority === 'URGENT' ? 'text-red-600' : ''}`}>
                    {ticketData.priority}
                  </span>
                </div>
                {ticketData.locationText && (
                  <div className="flex justify-between">
                    <span className="text-[#6a6864]">Location</span>
                    <span className="font-medium">{ticketData.locationText}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-blue-100">
                  <div className="font-medium">{ticketData.title}</div>
                  <div className="text-xs text-[#6a6864] mt-0.5 line-clamp-3">{ticketData.description}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSubmitTicket}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Submit to IT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTicketData(null)
                    sendMessage("I'd like to change something about the ticket.")
                  }}
                  className="px-3 py-2.5 rounded-full bg-white border border-[rgba(17,15,10,0.1)] text-sm text-[#6a6864] hover:bg-[#f5f4f0] cursor-pointer transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Self-resolved card */}
          {resolutionData && !selfResolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-200 bg-green-50/50 p-4 text-center"
            >
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-sm font-medium text-[#1a1915]">Issue resolved!</div>
              <p className="text-xs text-[#6a6864] mt-1">No ticket needed.</p>
              <button
                type="button"
                onClick={handleSelfResolved}
                className="mt-3 px-4 py-2 rounded-full bg-white border border-green-200 text-sm text-green-700 hover:bg-green-50 cursor-pointer transition-colors"
              >
                Close
              </button>
            </motion.div>
          )}

          {/* Submitted success */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-200 bg-green-50/50 p-5 text-center"
            >
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <div className="text-base font-semibold text-[#1a1915]">Submitted</div>
              <div className="text-sm text-[#6a6864] mt-1">
                Ticket <span className="font-mono font-semibold">{ticketNumber}</span> has been created.
              </div>
              <p className="text-xs text-[#a8a49d] mt-1">The team has been notified.</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 px-5 py-2 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all"
              >
                Done
              </button>
            </motion.div>
          )}

          {/* Self-resolved success */}
          {selfResolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-green-200 bg-green-50/50 p-5 text-center"
            >
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <div className="text-base font-semibold text-[#1a1915]">All set!</div>
              <p className="text-xs text-[#a8a49d] mt-1">Glad that got fixed. No ticket needed.</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 px-5 py-2 rounded-full bg-[#1a1915] text-white text-sm font-medium hover:bg-[#2a2925] active:scale-[0.97] cursor-pointer transition-all"
              >
                Close
              </button>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {!submitted && !selfResolved && (
          <div className="border-t border-[rgba(17,15,10,0.06)] px-5 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe your issue..."
                rows={1}
                disabled={streaming}
                className="flex-1 rounded-xl border border-[rgba(17,15,10,0.1)] bg-white px-3 py-2.5 text-sm text-[#1a1915] placeholder:text-[#a8a49d] focus:border-blue-400/60 focus:ring-2 focus:ring-blue-400/20 focus:outline-none transition-colors resize-none disabled:opacity-50"
                style={{ maxHeight: 120, minHeight: 40 }}
              />
              <button
                type="button"
                onClick={() => {
                  if (input.trim() && !streaming) sendMessage(input.trim())
                }}
                disabled={!input.trim() || streaming}
                className="p-2.5 rounded-xl bg-[#1a1915] text-white hover:bg-[#2a2925] active:scale-[0.95] cursor-pointer transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {streaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ```ticket and ```resolved JSON blocks from display text */
function stripJsonBlocks(text: string): string {
  return text
    .replace(/```ticket\s*\n[\s\S]*?\n```/gi, '')
    .replace(/```resolved\s*\n[\s\S]*?\n```/gi, '')
    .trim()
}
