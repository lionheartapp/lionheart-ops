'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

export type RecurringEditMode = 'this' | 'thisAndFollowing' | 'all'

interface RecurringEditDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (mode: RecurringEditMode) => void
  title?: string
  confirmLabel?: string
  variant?: 'default' | 'danger'
}

const OPTIONS: { value: RecurringEditMode; label: string }[] = [
  { value: 'this', label: 'This event' },
  { value: 'thisAndFollowing', label: 'This and following events' },
  { value: 'all', label: 'All events' },
]

export default function RecurringEditDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Edit recurring event',
  confirmLabel = 'OK',
  variant = 'default',
}: RecurringEditDialogProps) {
  const [selected, setSelected] = useState<RecurringEditMode>('this')
  const trapRef = useFocusTrap(isOpen)

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) setSelected('this')
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
            aria-labelledby="recurring-edit-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[340px] bg-white rounded-2xl shadow-heavy"
          >
            <div className="px-6 pt-5 pb-4">
              <h2 id="recurring-edit-title" className="text-base font-semibold text-slate-900 mb-4">
                {title}
              </h2>

              <div className="space-y-2">
                {OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-3 py-1.5 cursor-pointer group"
                  >
                    <span className="relative flex items-center justify-center w-5 h-5">
                      <span className={`w-5 h-5 rounded-full border-2 transition-colors ${
                        selected === opt.value
                          ? 'border-primary-600'
                          : 'border-slate-300 group-hover:border-slate-400'
                      }`} />
                      {selected === opt.value && (
                        <span className="absolute w-2.5 h-2.5 rounded-full bg-primary-600" />
                      )}
                    </span>
                    <input
                      type="radio"
                      name="recurring-edit-mode"
                      value={opt.value}
                      checked={selected === opt.value}
                      onChange={() => setSelected(opt.value)}
                      className="sr-only"
                    />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(selected)}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-full transition-colors ${
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
