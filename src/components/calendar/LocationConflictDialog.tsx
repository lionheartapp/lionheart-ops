'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { AlertTriangle, Clock, MapPin } from 'lucide-react'

interface ConflictDetails {
  conflictingEventTitle: string
  conflictingStart: string
  conflictingEnd: string
  bufferMinutes: number
  location: string
}

interface LocationConflictDialogProps {
  isOpen: boolean
  conflict: ConflictDetails | null
  onClose: () => void
  onOverride: () => void
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function LocationConflictDialog({ isOpen, conflict, onClose, onOverride }: LocationConflictDialogProps) {
  const trapRef = useFocusTrap(isOpen)

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
      {isOpen && conflict && (
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
            aria-labelledby="location-conflict-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl"
          >
            <div className="px-6 pt-5 pb-4 space-y-4">
              {/* Warning header */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 id="location-conflict-title" className="text-sm font-semibold text-gray-900">
                    Location Conflict
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    This location already has an event scheduled nearby.
                  </p>
                </div>
              </div>

              {/* Conflict details card */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {conflict.conflictingEventTitle}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {formatDate(conflict.conflictingStart)}, {formatTime(conflict.conflictingStart)} &ndash; {formatTime(conflict.conflictingEnd)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span>{conflict.location}</span>
                </div>
              </div>

              {/* Buffer note */}
              <p className="text-xs text-gray-500">
                Your organization requires a {conflict.bufferMinutes}-minute buffer between events at the same location.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onOverride}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-full transition-colors"
              >
                Schedule Anyway
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
