'use client'

import { useState } from 'react'
import { Loader2, Clock } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { useQueryClient } from '@tanstack/react-query'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LaborEntryFormProps {
  ticketId: string
  currentUserId: string
  /** If available, show a dropdown with available technicians */
  technicians?: { id: string; firstName: string; lastName: string }[]
  onCreated?: () => void
  onCancel?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function computeDuration(date: string, startTime: string, endTime: string): number | null {
  if (!date || !startTime || !endTime) return null
  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  return diff > 0 ? diff : null
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LaborEntryForm({
  ticketId,
  currentUserId,
  technicians,
  onCreated,
  onCancel,
}: LaborEntryFormProps) {
  const queryClient = useQueryClient()

  const [date, setDate] = useState(today())
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [durationInput, setDurationInput] = useState('')
  const [notes, setNotes] = useState('')
  const [technicianId, setTechnicianId] = useState(currentUserId)
  const [inputMode, setInputMode] = useState<'times' | 'duration'>('times')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const computedMinutes = inputMode === 'times' ? computeDuration(date, startTime, endTime) : null
  const durationMinutes = inputMode === 'duration'
    ? (parseFloat(durationInput) > 0 ? Math.round(parseFloat(durationInput) * 60) : null)
    : computedMinutes

  const canSubmit = !isSubmitting && (
    inputMode === 'times'
      ? !!(date && startTime && endTime && computedMinutes && computedMinutes > 0)
      : !!(durationMinutes && durationMinutes > 0)
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setError('')

    const body: Record<string, unknown> = {
      technicianId,
      notes: notes.trim() || undefined,
    }

    if (inputMode === 'times' && date && startTime && endTime) {
      body.startTime = new Date(`${date}T${startTime}`).toISOString()
      body.endTime = new Date(`${date}T${endTime}`).toISOString()
    } else {
      // duration-only mode: use today's date as startTime
      const now = new Date()
      const start = new Date(now.getTime() - (durationMinutes ?? 0) * 60 * 1000)
      body.startTime = start.toISOString()
      body.endTime = now.toISOString()
      body.durationMinutes = durationMinutes
    }

    try {
      await fetchApi(`/api/maintenance/tickets/${ticketId}/labor`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })

      queryClient.invalidateQueries({ queryKey: ['labor-entries', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', ticketId] })
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      {/* Input mode toggle */}
      <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50 w-fit gap-0.5">
        <button
          type="button"
          onClick={() => setInputMode('times')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            inputMode === 'times'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Start / End Times
        </button>
        <button
          type="button"
          onClick={() => setInputMode('duration')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            inputMode === 'duration'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Duration Only
        </button>
      </div>

      {inputMode === 'times' ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Time <span className="text-red-500">*</span></label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">End Time <span className="text-red-500">*</span></label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Duration (hours) <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="0.1"
            step="0.25"
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            placeholder="e.g. 1.5 for 1h 30m"
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      )}

      {/* Computed duration hint */}
      {computedMinutes != null && computedMinutes > 0 && inputMode === 'times' && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600">
          <Clock className="w-3 h-3" />
          Duration: {formatDuration(computedMinutes)}
        </p>
      )}

      {/* Technician selector */}
      {technicians && technicians.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Technician</label>
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
          >
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}{t.id === currentUserId ? ' (You)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional: describe work performed..."
          rows={2}
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder:text-gray-400"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
          Log Time
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
