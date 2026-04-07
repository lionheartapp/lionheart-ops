'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, CalendarDays } from 'lucide-react'

interface SlotChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  slotStart?: Date
  onChooseMeeting: () => void
  onChoosePlanEvent: () => void
}

export default function SlotChoiceModal({
  isOpen,
  onClose,
  slotStart,
  onChooseMeeting,
  onChoosePlanEvent,
}: SlotChoiceModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-80 overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">What are you creating?</h3>
                    {slotStart && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {slotStart.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="p-3 space-y-2">
                <button
                  onClick={onChooseMeeting}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Schedule Meeting</p>
                    <p className="text-xs text-slate-500 mt-0.5">Informal — added instantly, no approval</p>
                  </div>
                </button>

                <button
                  onClick={onChoosePlanEvent}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                    <CalendarDays className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Plan Event</p>
                    <p className="text-xs text-slate-500 mt-0.5">Formal — AV, facilities &amp; admin approval</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
