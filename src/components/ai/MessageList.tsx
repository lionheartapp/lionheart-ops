'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Sparkles } from 'lucide-react'
import type { ConversationTurn } from '@/lib/types/assistant'

interface MessageListProps {
  conversation: ConversationTurn[]
  isLoading: boolean
}

/**
 * Scrollable list of conversation messages.
 * User messages are blue/right-aligned, assistant messages are white/left-aligned.
 */
export default function MessageList({ conversation, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation, isLoading])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
      {/* Empty state */}
      {conversation.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            Hi! I&apos;m your AI Assistant
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Ask me about maintenance tickets, IT devices, campus info, events, or analytics. I can also help create tickets.
          </p>
        </div>
      )}

      {/* Messages */}
      {conversation.map((turn, idx) => (
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
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm'
            }`}
          >
            {turn.content}
          </div>
          <span className="text-[10px] text-gray-400 px-1">
            {formatTime(turn.timestamp)}
          </span>
        </motion.div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
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
