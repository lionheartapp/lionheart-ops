'use client'

import { useState, useEffect } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown, FloatingTextarea, type DropdownOption } from '@/components/ui/FloatingInput'
import RRuleBuilder from '@/components/athletics/RRuleBuilder'
import { handleAuthResponse } from '@/lib/client-auth'

interface Team {
  id: string
  name: string
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface PracticeDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  teams: Team[]
  preselectedTeamId?: string
}

export default function PracticeDrawer({
  isOpen,
  onClose,
  onSaved,
  teams,
  preselectedTeamId,
}: PracticeDrawerProps) {
  const [form, setForm] = useState({
    athleticTeamId: '',
    startTime: '',
    endTime: '',
    location: '',
    notes: '',
    recurring: false,
    rrule: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setForm({
      athleticTeamId: preselectedTeamId || '',
      startTime: '',
      endTime: '',
      location: '',
      notes: '',
      recurring: false,
      rrule: '',
    })
    setError('')
  }, [isOpen, preselectedTeamId])

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.sport.name})`,
    color: t.sport.color,
  }))

  const handleSave = async () => {
    if (!form.athleticTeamId) { setError('Team is required'); return }
    if (!form.startTime) { setError('Start time is required'); return }
    if (!form.endTime) { setError('End time is required'); return }

    setSaving(true)
    setError('')

    try {
      const token = localStorage.getItem('auth-token')
      const payload: Record<string, any> = {
        athleticTeamId: form.athleticTeamId,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (form.recurring && form.rrule) {
        payload.rrule = form.rrule
      }

      const res = await fetch('/api/athletics/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to create practice'); return }

      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="New Practice"
      width="lg"
    >
      <div className="space-y-5">
        <FloatingDropdown
          id="practice-team"
          label="Team"
          value={form.athleticTeamId}
          onChange={(v) => setForm({ ...form, athleticTeamId: v })}
          options={teamOptions}
          required
        />

        <FloatingInput
          id="practice-start"
          label="Start Date/Time"
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          required
        />

        <FloatingInput
          id="practice-end"
          label="End Date/Time"
          type="datetime-local"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          required
        />

        <FloatingInput
          id="practice-location"
          label="Location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />

        <FloatingTextarea
          id="practice-notes"
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked, rrule: e.target.checked ? form.rrule : '' })}
            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus-visible:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Make recurring</span>
        </label>

        {form.recurring && (
          <div className="pl-6 border-l-2 border-primary-200">
            <RRuleBuilder
              value={form.rrule}
              onChange={(rrule) => setForm({ ...form, rrule })}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Create Practice'}
        </button>
      </div>
    </DetailDrawer>
  )
}
