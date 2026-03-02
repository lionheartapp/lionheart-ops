'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface NotifyAttendeesDialogProps {
  isOpen: boolean
  onClose: () => void
  onSend: () => void
  onDontSend: () => void
}

export default function NotifyAttendeesDialog({ isOpen, onClose, onSend, onDontSend }: NotifyAttendeesDialogProps) {
  const trapRef = useFocusTrap(isOpen)

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
            aria-labelledby="notify-attendees-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] bg-white rounded-2xl shadow-xl"
          >
            <div className="px-6 pt-5 pb-2">
              <p id="notify-attendees-title" className="text-sm text-gray-700 leading-relaxed">
                Would you like to send update notifications to the guests of this event?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">
              <button
                onClick={onDontSend}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Don&apos;t send
              </button>
              <button
                onClick={onSend}
                className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
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
