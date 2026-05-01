'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarRange, Calendar, X } from 'lucide-react'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'

interface ActiveSeason {
  id: string
  name: string
  isSubmissionsOpen: boolean
}

interface YearPlanPromptProps {
  isOpen: boolean
  onClose: () => void
  /** User chose to add this event to the year plan */
  onYearPlan: (seasonId: string) => void
  /** User chose to create a regular event (not for the year plan) */
  onRegularEvent: () => void
}

/**
 * Prompt shown when a user creates an event and there's an active
 * planning season collecting submissions. Asks whether the event
 * is for the year plan or for now.
 */
export default function YearPlanPrompt({
  isOpen,
  onClose,
  onYearPlan,
  onRegularEvent,
}: YearPlanPromptProps) {
  const { activeSchoolId } = useActiveSchool()
  const [season, setSeason] = useState<ActiveSeason | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSeason = useCallback(async () => {
    try {
      const url = activeSchoolId
        ? `/api/planning-seasons/my-dashboard?schoolId=${encodeURIComponent(activeSchoolId)}`
        : '/api/planning-seasons/my-dashboard'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        if (json.ok && json.data?.season?.isSubmissionsOpen) {
          setSeason(json.data.season)
          return
        }
      }
      setSeason(null)
    } catch {
      setSeason(null)
    } finally {
      setLoading(false)
    }
  }, [activeSchoolId])

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      fetchSeason()
    }
  }, [isOpen, fetchSeason])

  // If no active collecting season, skip straight to regular event
  useEffect(() => {
    if (!loading && !season && isOpen) {
      onRegularEvent()
    }
  }, [loading, season, isOpen, onRegularEvent])

  if (!isOpen || loading || !season) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

        {/* Dialog */}
        <motion.div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <h3 className="text-lg font-bold text-slate-900">Where should this event go?</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-3">
            {/* Year Plan option */}
            <button
              onClick={() => onYearPlan(season.id)}
              className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <CalendarRange className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-900">
                  Add to {season.name}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit as a year plan event for review and scheduling
                </p>
              </div>
            </button>

            {/* Regular event option */}
            <button
              onClick={onRegularEvent}
              className="w-full flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Create for now
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Schedule this event on the current calendar
                </p>
              </div>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
