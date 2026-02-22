import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { platformFetch } from '../services/platformApi'

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * ScheduleCheck: Advanced maintenance window finder
 * Queries room schedules to surface 30+ minute gaps for non-disruptive repairs
 */
export default function ScheduleCheck({ roomId = '', rooms = [] }) {
  const [selectedRoom, setSelectedRoom] = useState(roomId)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [windows, setWindows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (selectedRoom) {
      fetchPrepWindows()
    }
  }, [selectedRoom, selectedDate])

  const fetchPrepWindows = async () => {
    if (!selectedRoom) return

    setLoading(true)
    setError(null)
    try {
      const res = await platformFetch(
        `/api/room/${selectedRoom}/prep-windows?date=${selectedDate}`
      )
      if (!res.ok) throw new Error('Failed to load prep windows')
      const data = await res.json()
      setWindows(data.windows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prep windows')
      setWindows([])
    } finally {
      setLoading(false)
    }
  }

  const bestWindow = windows.find((w) => w.isBestWindow)
  const selectedDateObj = new Date(selectedDate)
  const dayOfWeek = DAYS_OF_WEEK[selectedDateObj.getDay()]

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Maintenance Windows
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Find the best times to schedule repairs without interrupting classes.
        </p>
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Room
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {selectedRoom && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing windows for <strong>{dayOfWeek}</strong>, {selectedDate}
          </div>
        )}
      </motion.div>

      {/* Results */}
      {selectedRoom && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          ) : windows.length === 0 ? (
            <div className="p-6 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
              <p className="font-medium mb-1">No available windows today</p>
              <p>Classes or meetings fill the entire school day (8 AM - 4 PM).</p>
            </div>
          ) : (
            <>
              {/* Best Window (Recommended) */}
              {bestWindow && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-lg border-2 border-emerald-300 dark:border-emerald-600 p-6 shadow-lg"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-emerald-900 dark:text-emerald-100 text-lg">
                        Recommended Repair Window
                      </h3>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        {bestWindow.startTime} – {bestWindow.endTime} ({bestWindow.durationMinutes} minutes)
                      </p>
                    </div>
                  </div>
                  <p className="text-emerald-800 dark:text-emerald-200 text-sm">
                    {bestWindow.reason}
                  </p>
                </motion.div>
              )}

              {/* All Windows */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  All Available Windows ({windows.length})
                </p>
                <AnimatePresence>
                  {windows.map((w, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`p-4 rounded-lg border ${
                        w.isBestWindow
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700'
                          : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {w.startTime} – {w.endTime}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">
                              {w.durationMinutes} min • {w.reason}
                            </div>
                            {w.blockingTeachers && w.blockingTeachers.length > 0 && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                Classes: {w.blockingTeachers.map((t) => t.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        {w.isBestWindow && (
                          <div className="px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium shrink-0">
                            Best
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </motion.div>
      )}
          <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 text-xs">
            {blocks.map((b, i) => (
              <li key={i}>
                {b.startTime}–{b.endTime} {b.subject || '—'} {b.roomName ? `(${b.roomName})` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Avoid these times when scheduling repairs or tech support.
          </p>
        </div>
      )}
    </div>
  )
}
