'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Search, BarChart3, Calendar, Building2, Wrench, Cloud, Package } from 'lucide-react'
import type { ConversationTurn } from '@/lib/types/assistant'
import ChoiceButtons from './ChoiceButtons'
import SuggestionChips from './SuggestionChips'
import AnimatedOrb, { type OrbState } from './AnimatedOrb'

interface MessageListProps {
  conversation: ConversationTurn[]
  isLoading: boolean
  isStreaming?: boolean
  activeTools?: string[]
  aiState?: OrbState
  onChoiceSelect?: (choice: string) => void
  onSuggestionSelect?: (suggestion: string) => void
}

/** Human-friendly labels for tool names */
const TOOL_LABELS: Record<string, { label: string; icon: typeof Search }> = {
  query_maintenance_stats: { label: 'Checking maintenance data', icon: BarChart3 },
  query_it_stats: { label: 'Checking IT analytics', icon: BarChart3 },
  search_platform: { label: 'Searching', icon: Search },
  list_upcoming_events: { label: 'Checking calendar', icon: Calendar },
  get_campus_info: { label: 'Looking up campus info', icon: Building2 },
  get_ticket_details: { label: 'Looking up ticket', icon: Wrench },
  get_device_info: { label: 'Looking up device', icon: Wrench },
  create_maintenance_ticket: { label: 'Preparing ticket draft', icon: Wrench },
  create_event: { label: 'Preparing event draft', icon: Calendar },
  create_it_ticket: { label: 'Preparing IT ticket draft', icon: Wrench },
  update_maintenance_ticket_status: { label: 'Preparing status update', icon: Wrench },
  assign_maintenance_ticket: { label: 'Looking up assignee', icon: Search },
  check_room_availability: { label: 'Checking room availability', icon: Calendar },
  get_weather_forecast: { label: 'Checking weather', icon: Cloud },
  check_resource_availability: { label: 'Checking inventory', icon: Package },
}

/** Render basic markdown in chat messages: bold, italic, inline code, bullet lists, paragraphs */
function ChatMarkdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/)

  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim()
        if (!trimmed) return null

        // Check if this paragraph is a bullet list
        const lines = trimmed.split('\n')
        const isList = lines.every((l) => /^[\s]*[-•]\s/.test(l) || l.trim() === '')

        if (isList) {
          return (
            <ul key={pIdx} className="list-disc list-inside space-y-0.5 my-1">
              {lines.map((line, lIdx) => {
                const content = line.replace(/^[\s]*[-•]\s*/, '')
                if (!content.trim()) return null
                return <li key={lIdx}>{renderInline(content)}</li>
              })}
            </ul>
          )
        }

        return (
          <span key={pIdx}>
            {pIdx > 0 && <br />}
            {renderInline(trimmed)}
          </span>
        )
      })}
    </>
  )
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  // Split on markdown patterns, preserving delimiters
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*([\s\S]+?)\*\*([\s\S]*)$/)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>)
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[2]}</strong>)
      remaining = boldMatch[3]
      continue
    }

    // Italic: *text*
    const italicMatch = remaining.match(/^([\s\S]*?)\*([\s\S]+?)\*([\s\S]*)$/)
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>)
      parts.push(<em key={key++}>{italicMatch[2]}</em>)
      remaining = italicMatch[3]
      continue
    }

    // Inline code: `text`
    const codeMatch = remaining.match(/^([\s\S]*?)`([\s\S]+?)`([\s\S]*)$/)
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>)
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">
          {codeMatch[2]}
        </code>
      )
      remaining = codeMatch[3]
      continue
    }

    // No more patterns
    parts.push(<span key={key++}>{remaining}</span>)
    break
  }

  return <>{parts}</>
}

/**
 * Scrollable list of conversation messages.
 * Supports streaming display with blinking cursor and tool execution indicators.
 * Renders ChoiceButtons and SuggestionChips below the last assistant message.
 */
export default function MessageList({
  conversation,
  isLoading,
  isStreaming = false,
  activeTools = [],
  aiState = 'idle',
  onChoiceSelect,
  onSuggestionSelect,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, isLoading, isStreaming, activeTools])

  const isLastAssistantStreaming = isStreaming && conversation.length > 0 && conversation[conversation.length - 1]?.role === 'assistant'

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'linear-gradient(180deg, #f8faff 0%, #f1f5f9 100%)' }}>
      {/* Empty state — animated orb */}
      {conversation.length === 0 && !isLoading && (
        <motion.div
          className="flex flex-col items-center justify-center h-full text-center px-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <AnimatedOrb state={aiState} size={80} className="mb-5" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Hi! I&apos;m Leo, your AI Assistant
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Ask me anything about your school — tickets, events, campus info, or analytics.
          </p>
        </motion.div>
      )}

      {/* Messages */}
      {conversation.map((turn, idx) => {
        const isLastMsg = idx === conversation.length - 1
        const showCursor = isLastMsg && isLastAssistantStreaming

        return (
          <motion.div
            key={idx}
            className={`flex flex-col gap-1 ${
              turn.role === 'user' ? 'items-end' : 'items-start'
            }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'text-white rounded-br-sm shadow-md'
                  : 'bg-white/90 backdrop-blur-sm text-gray-900 border border-gray-200/50 rounded-bl-sm shadow-sm'
              }`}
              style={turn.role === 'user' ? { background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' } : undefined}
            >
              {turn.role === 'assistant' && turn.content ? (
                <ChatMarkdown text={turn.content} />
              ) : (
                turn.content || (showCursor ? '' : '')
              )}
              {showCursor && (
                <span className="inline-block w-[2px] h-[14px] bg-gray-400 ml-0.5 align-middle animate-blink" />
              )}
              {/* Image thumbnails on user messages */}
              {turn.role === 'user' && turn.images && turn.images.length > 0 && (
                <div className="flex gap-1.5 mt-1.5">
                  {turn.images.map((img, imgIdx) => (
                    <button
                      key={imgIdx}
                      type="button"
                      onClick={() => {
                        const url = `data:${img.mimeType};base64,${img.data}`
                        window.open(url, '_blank')
                      }}
                      className="block rounded-md overflow-hidden border border-white/20 hover:opacity-80 transition-opacity cursor-pointer"
                      title={img.name}
                    >
                      <img
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt={img.name}
                        className="w-16 h-16 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!showCursor && (
              <span className="text-[10px] text-gray-400 px-1">
                {formatTime(turn.timestamp)}
              </span>
            )}

            {/* Choice buttons — only on last assistant message, only when not streaming */}
            {turn.role === 'assistant' && isLastMsg && !isStreaming && !isLoading &&
              turn.choices && turn.choices.length > 0 && onChoiceSelect && (
              <ChoiceButtons
                options={turn.choices}
                onSelect={onChoiceSelect}
              />
            )}

            {/* Suggestion chips — only on last assistant message, only when idle */}
            {turn.role === 'assistant' && isLastMsg && !isStreaming && !isLoading &&
              turn.suggestions && turn.suggestions.length > 0 && onSuggestionSelect && (
              <SuggestionChips
                items={turn.suggestions}
                onSelect={onSuggestionSelect}
              />
            )}
          </motion.div>
        )
      })}

      {/* Tool execution indicators */}
      {activeTools.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {activeTools.map((tool) => {
            const info = TOOL_LABELS[tool] || { label: 'Working', icon: Loader2 }
            const Icon = info.icon
            return (
              <div
                key={tool}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/80 backdrop-blur-sm border border-indigo-100/50 text-xs text-indigo-600"
              >
                <Icon className="w-3 h-3 animate-pulse" />
                <span>{info.label}...</span>
              </div>
            )
          })}
        </motion.div>
      )}

      {/* Loading indicator (before streaming starts) */}
      {isLoading && !isStreaming && (
        <motion.div
          className="flex items-start gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={endRef} />
    </div>
  )
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}
