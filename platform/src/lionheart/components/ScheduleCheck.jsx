import { useState, useEffect } from 'react'
import { platformFetch } from '../services/platformApi'

/** For IT & Maintenance: select a teacher to see their block schedule and avoid disturbing class during repairs */
export default function ScheduleCheck() {
  const [teachers, setTeachers] = useState([])
  const [teacherId, setTeacherId] = useState('')
  const [blocks, setBlocks] = useState([])

  useEffect(() => {
    platformFetch('/api/users')
      .then((r) => r.json())
      .then(setTeachers)
      .catch(() => setTeachers([]))
  }, [])

  useEffect(() => {
    if (!teacherId) {
      setBlocks([])
      return
    }
    platformFetch(`/api/user/${teacherId}/schedule`)
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks || []))
      .catch(() => setBlocks([]))
  }, [teacherId])

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
        Schedule check
      </h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
        Select a teacher to see their block schedule. Schedule repairs during prep periods to avoid disturbing class.
      </p>
      <select
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        className="w-full max-w-xs px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
      >
        <option value="">— No teacher selected —</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name || t.email}
          </option>
        ))}
      </select>
      {blocks.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm">
          <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">Today&apos;s blocks:</p>
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
