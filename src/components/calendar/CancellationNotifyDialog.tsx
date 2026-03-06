'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface CancellationNotifyDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function CancellationNotifyDialog({ isOpen, onClose }: CancellationNotifyDialogProps) {
  const trapRef = useFocusTrap(isOpen)
  const [message, setMessage] = useState('')

  // Reset message when dialog opens
  useEffect(() => {
    if (isOpen) setMessage('')
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50"
            onClick={onClose}
          />
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancellation-notify-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] bg-white rounded-2xl shadow-xl"
          >
            <div className="px-6 pt-5 pb-2">
              <p id="cancellation-notify-title" className="text-sm text-gray-700 leading-relaxed">
                Would you like to send cancellation emails to the guests of this event?
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)"
                aria-label="Cancellation message"
                className="mt-3 w-full px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-900/10 focus:border-gray-900 resize-none"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                Don&apos;t send
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-colors"
              >
                Send
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
