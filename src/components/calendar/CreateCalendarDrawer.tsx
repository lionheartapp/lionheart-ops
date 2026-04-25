'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, Loader2 } from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { COLOR_PRESETS, CALENDAR_TYPE_OPTIONS } from './calendar-constants'

interface CreateCalendarDrawerProps {
  isOpen: boolean
  onClose: () => void
  calendarName: string
  onCalendarNameChange: (name: string) => void
  calendarType: string
  onCalendarTypeChange: (type: string) => void
  calendarColor: string
  onCalendarColorChange: (color: string) => void
  onCreateCalendar: () => void
  isPending: boolean
}

export default function CreateCalendarDrawer({
  isOpen,
  onClose,
  calendarName,
  onCalendarNameChange,
  calendarType,
  onCalendarTypeChange,
  calendarColor,
  onCalendarColorChange,
  onCreateCalendar,
  isPending,
}: CreateCalendarDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-[420px] ui-glass-overlay z-50 flex flex-col sm:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                New Calendar
              </span>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6 space-y-5">
              <FloatingInput
                id="drawer-cal-name"
                label="Calendar name"
                value={calendarName}
                onChange={(e) => onCalendarNameChange(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && onCreateCalendar()}
              />
              <FloatingDropdown
                id="drawer-cal-type"
                label="Type"
                value={calendarType}
                onChange={(v) => onCalendarTypeChange(v)}
                options={CALENDAR_TYPE_OPTIONS}
              />
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => onCalendarColorChange(c.value)}
                      className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-400"
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    >
                      {calendarColor === c.value && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 space-y-3">
              <button
                onClick={onCreateCalendar}
                disabled={!calendarName.trim() || isPending}
                className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Calendar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
