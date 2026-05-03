'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

export default function EventBufferSection() {
  const [bufferMinutes, setBufferMinutes] = useState<number | null>(null)
  const [savedValue, setSavedValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // UX-004: surface server errors to the user instead of dropping them in
  // console.error. The previous code logged the error and left the UI in a
  // permanently-saving state, then reset to "looks unsaved" with no message.
  const [error, setError] = useState('')

  useEffect(() => {
    fetchApi<{ eventBufferMinutes: number }>('/api/settings/organization')
      .then((data) => {
        setBufferMinutes(data.eventBufferMinutes)
        setSavedValue(data.eventBufferMinutes)
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch organization settings:', err)
        setError('Could not load event settings. Refresh to try again.')
      })
  }, [])

  const handleSave = async () => {
    if (bufferMinutes === null || bufferMinutes === savedValue) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ eventBufferMinutes: bufferMinutes }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok) {
        setSavedValue(bufferMinutes)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(json?.error?.message || 'Failed to save the event buffer. Please try again.')
      }
    } catch (err: unknown) {
      console.error('Failed to save event buffer setting:', err)
      setError(err instanceof Error ? err.message : 'Failed to save the event buffer.')
    } finally {
      setSaving(false)
    }
  }

  if (bufferMinutes === null) return null

  const isDirty = bufferMinutes !== savedValue

  return (
    <section>
      <h3 className="text-lg font-semibold text-slate-900">Event Settings</h3>
      <div className="h-px bg-slate-200 mt-2 mb-4" />
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="event-buffer" className="text-sm font-medium text-slate-900">
            Location buffer time
          </label>
          <p className="text-xs text-slate-500">
            Minimum minutes between events at the same location. Set to 0 to disable.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <input
              id="event-buffer"
              type="number"
              min={0}
              max={480}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Math.max(0, Math.min(480, parseInt(e.target.value) || 0)))}
              className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
            />
            <span className="text-sm text-slate-500">minutes</span>
            {isDirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-600 mt-2" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
