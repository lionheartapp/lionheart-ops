'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PauseCircle } from 'lucide-react'

interface HoldReasonDialogProps {
  isOpen: boolean
  ticketTitle: string
  onConfirm: (holdReason: string) => void
  onCancel: () => void
}

const HOLD_REASONS = [
  { value: 'PARTS', label: 'Waiting for parts', description: 'Hardware or replacement parts on order' },
  { value: 'VENDOR', label: 'Waiting for vendor', description: 'Pending response from external vendor or supplier' },
  { value: 'USER_AVAILABILITY', label: 'User unavailable', description: 'Cannot reach the person who submitted the ticket' },
  { value: 'THIRD_PARTY', label: 'Third party', description: 'Blocked by an external service or contractor' },
  { value: 'OTHER', label: 'Other', description: 'Another reason not listed above' },
] as const

export default function HoldReasonDialog({ isOpen, ticketTitle, onConfirm, onCancel }: HoldReasonDialogProps) {
  const [selected, setSelected] = useState<string>('PARTS')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) setSelected('PARTS')
  }, [isOpen])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"]), input'
    )
    if (focusable.length > 0) focusable[0].focus()

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return
      const els = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [tabindex]:not([tabindex="-1"]), input'
      )
      if (els.length === 0) return
      const first = els[0]
      const last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const handleConfirm = useCallback(() => {
    onConfirm(selected)
  }, [onConfirm, selected])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative ui-glass-overlay rounded-2xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hold-reason-title"
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <PauseCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 id="hold-reason-title" className="text-lg font-semibold text-white">
                    Put on Hold
                  </h3>
                  <p className="text-sm text-white/80 truncate max-w-[260px]">{ticketTitle}</p>
                </div>
              </div>
            </div>

            {/* Reasons */}
            <div className="px-6 py-4">
              <p className="text-sm text-slate-500 mb-3">Why is this ticket being put on hold?</p>
              <div className="space-y-1.5">
                {HOLD_REASONS.map((reason) => {
                  const isSelected = selected === reason.value
                  return (
                    <button
                      key={reason.value}
                      type="button"
                      onClick={() => setSelected(reason.value)}
                      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-slate-50 border border-transparent hover:bg-slate-100'
                      }`}
                    >
                      {/* Radio indicator */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                          {reason.label}
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5">{reason.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
              >
                Confirm Hold
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
