'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Plus, Trash2, Calendar, Clock, BookOpen } from 'lucide-react'
import { platformPost, platformFetch } from '@/services/platformApi'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function MySchedule({ currentUser, rooms = [] }) {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedDay, setSelectedDay] = useState(1) // Monday
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [subject, setSubject] = useState('')

  // Fetch user's schedules on mount
  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await platformFetch(`/api/teacher-schedule`)
      if (!res.ok) throw new Error('Failed to load schedules')
      const data = await res.json()
      setSchedules(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSchedule = async (e) => {
    e.preventDefault()
    setError(null)

    if (!selectedRoom || !startTime || !endTime) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await platformPost('/api/teacher-schedule', {
        roomId: selectedRoom,
        dayOfWeek: selectedDay,
        startTime,
        endTime,
        subject: subject || undefined,
      })

      if (!res.ok) throw new Error('Failed to save schedule')
      const created = await res.json()

      setSchedules((prev) => [...prev, created])
      setSelectedRoom('')
      setStartTime('08:00')
      setEndTime('09:00')
      setSubject('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSchedule = async (id) => {
    if (!confirm('Delete this schedule entry?')) return

    try {
      const res = await platformFetch(`/api/teacher-schedule/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete')
      setSchedules((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule')
    }
  }

  // Group schedules by day
  const schedulesByDay = {}
  schedules.forEach((s) => {
    if (!schedulesByDay[s.dayOfWeek]) schedulesByDay[s.dayOfWeek] = []
    schedulesByDay[s.dayOfWeek].push(s)
  })

  return (
    <div className="space-y-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">My Schedule</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tell the system when you're teaching in each room. This helps schedulers find better setup & maintenance windows.
        </p>
      </div>

      {/* Add Schedule Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6"
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Class or Prep Period
        </h3>

        <form onSubmit={handleAddSchedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Room */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Room
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Day of Week */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Day of Week
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OF_WEEK.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Subject or Class Name (optional)
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Algebra II, Lunch Duty"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Saving…' : 'Add to Schedule'}
          </button>
        </form>
      </motion.div>

      {/* Schedule Display */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No schedule entries yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((dayName, dayIdx) => {
              const daySchedules = schedulesByDay[dayIdx]
              if (!daySchedules) return null

              return (
                <div
                  key={dayIdx}
                  className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4"
                >
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{dayName}</h4>
                  <div className="space-y-2">
                    {daySchedules.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-700/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
                              {s.startTime} - {s.endTime}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {s.room?.name} {s.subject && `• ${s.subject}`}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
