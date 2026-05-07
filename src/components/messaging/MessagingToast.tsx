'use client'

/**
 * MessagingToast — a slide-in toast notification for messaging events
 * (mentions, DMs). Positioned top-right with glassmorphism styling.
 */

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, AtSign, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessagingToastProps {
  title: string
  body: string
  channelId: string
  type: 'messaging_mention' | 'messaging_dm'
  onDismiss: () => void
  onNavigate: (channelId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MessagingToast({
  title,
  body,
  channelId,
  type,
  onDismiss,
  onNavigate,
}: MessagingToastProps) {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const Icon = type === 'messaging_mention' ? AtSign : MessageSquare

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="ui-glass rounded-xl shadow-lg p-4 max-w-sm w-full cursor-pointer transition-colors duration-200 hover:bg-white/80"
      onClick={() => onNavigate(channelId)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary-600" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {title}
          </p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {body}
          </p>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors duration-200"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}
