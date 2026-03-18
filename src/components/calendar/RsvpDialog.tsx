'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface RsvpDialogProps {
  isOpen: boolean
  status: 'DECLINED' | 'TENTATIVE'
  onSubmit: (responseNote?: string) => void
  onCancel: () => void
}

export default function RsvpDialog({ isOpen, status, onSubmit, onCancel }: RsvpDialogProps) {
  const trapRef = useFocusTrap(isOpen)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isOpen) setNote('')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onCancel])

  const label = status === 'DECLINED' ? 'Decline' : 'Maybe'
  const color = status === 'DECLINED' ? 'red' : 'amber'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-lightbox"
            onClick={onCancel}
          />
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rsvp-dialog-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-lightbox w-[380px] bg-white rounded-2xl shadow-xl"
          >
            <div className="px-6 pt-5 pb-2">
              <h3 id="rsvp-dialog-title" className="text-sm font-semibold text-slate-900 mb-2">
                {label} this event?
              </h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                aria-label="Response note"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900/10 focus:border-slate-900 resize-none"
                rows={3}
                maxLength={500}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onSubmit(note.trim() || undefined)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-full transition-colors cursor-pointer ${
                  color === 'red'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {label}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
