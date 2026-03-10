'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import ChatPanel from './ChatPanel'
import AiGlow from './AiGlow'

/**
 * Floating AI Assistant chat button.
 * Fixed bottom-right, toggles the ChatPanel open/closed.
 * Shows Apple Intelligence-style gradient glow when AI is active.
 * Only renders when user is authenticated.
 */
export default function ChatButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  /** True when the AI is listening (voice) or thinking (processing) */
  const [isAiActive, setIsAiActive] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth-token')
    setIsAuthenticated(!!token)
  }, [])

  const handleAiActiveChange = useCallback((active: boolean) => {
    setIsAiActive(active)
  }, [])

  if (!isAuthenticated) return null

  return (
    <>
      {/* Floating toggle button with glow */}
      <div className="fixed bottom-6 right-6 z-[60]">
        <AiGlow active={isAiActive && !isOpen} shape="circle">
          <motion.button
            onClick={() => setIsOpen((prev) => !prev)}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-6 w-6" />
                </motion.span>
              ) : (
                <motion.span
                  key="open"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <MessageCircle className="h-6 w-6" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </AiGlow>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <ChatPanel
            onClose={() => setIsOpen(false)}
            onAiActiveChange={handleAiActiveChange}
          />
        )}
      </AnimatePresence>
    </>
  )
}
