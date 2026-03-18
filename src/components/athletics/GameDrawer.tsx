'use client'

import { useState, useEffect } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingSelect, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import { handleAuthResponse } from '@/lib/client-auth'

interface Team {
  id: string
  name: string
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface Calendar {
  id: string
  name: string
  calendarType: string
}

interface Game {
  id: string
  athleticTeamId: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  calendarEventId?: string | null
}

interface GameDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingGame: Game | null
  teams: Team[]
  calendars: Calendar[]
  preselectedTeamId?: string
}

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function GameDrawer({
  isOpen,
  onClose,
  onSaved,
  editingGame,
  teams,
  calendars,
  preselectedTeamId,
}: GameDrawerProps) {
  const [form, setForm] = useState({
    athleticTeamId: '',
    opponentName: '',
    homeAway: 'HOME',
    startTime: '',
    endTime: '',
    venue: '',
    calendarId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (editingGame) {
      setForm({
        athleticTeamId: editingGame.athleticTeamId,
        opponentName: editingGame.opponentName,
        homeAway: editingGame.homeAway,
        startTime: toLocalDatetime(editingGame.startTime),
        endTime: toLocalDatetime(editingGame.endTime),
        venue: editingGame.venue || '',
        calendarId: '',
      })
    } else {
      setForm({
        athleticTeamId: preselectedTeamId || '',
        opponentName: '',
        homeAway: 'HOME',
        startTime: '',
        endTime: '',
        venue: '',
        calendarId: '',
      })
    }
    setError('')
  }, [isOpen, editingGame, preselectedTeamId])

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.sport.name})`,
    color: t.sport.color,
  }))

  const athleticsCalendars = calendars.filter((c) => c.calendarType === 'ATHLETICS')
  const calendarOptions: DropdownOption[] = [
    { value: '', label: 'None' },
    ...athleticsCalendars.map((c) => ({ value: c.id, label: c.name })),
  ]

  const handleSave = async () => {
    if (!form.athleticTeamId) { setError('Team is required'); return }
    if (!form.opponentName.trim()) { setError('Opponent name is required'); return }
    if (!form.startTime) { setError('Start time is required'); return }
    if (!form.endTime) { setError('End time is required'); return }

    setSaving(true)
    setError('')

    try {
      const token = localStorage.getItem('auth-token')
      const payload: Record<string, any> = {
        opponentName: form.opponentName.trim(),
        homeAway: form.homeAway,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        venue: form.venue.trim() || undefined,
      }

      let res: Response
      if (editingGame) {
        res = await fetch(`/api/athletics/games/${editingGame.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      } else {
        payload.athleticTeamId = form.athleticTeamId
        if (form.calendarId) payload.calendarId = form.calendarId
        res = await fetch('/api/athletics/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      }

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to save game'); return }

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
      title={editingGame ? 'Edit Game' : 'New Game'}
      width="lg"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : editingGame ? 'Update Game' : 'Create Game'}
        </button>
      }
    >
      <div className="space-y-5">
        <FloatingDropdown
          id="game-team"
          label="Team"
          value={form.athleticTeamId}
          onChange={(v) => setForm({ ...form, athleticTeamId: v })}
          options={teamOptions}
          required
          disabled={!!editingGame}
        />

        <FloatingInput
          id="game-opponent"
          label="Opponent Name"
          value={form.opponentName}
          onChange={(e) => setForm({ ...form, opponentName: e.target.value })}
          required
        />

        <FloatingSelect
          id="game-homeaway"
          label="Home / Away"
          value={form.homeAway}
          onChange={(e) => setForm({ ...form, homeAway: e.target.value })}
        >
          <option value="HOME">Home</option>
          <option value="AWAY">Away</option>
          <option value="NEUTRAL">Neutral</option>
        </FloatingSelect>

        <FloatingInput
          id="game-start"
          label="Start Date/Time"
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          required
        />

        <FloatingInput
          id="game-end"
          label="End Date/Time"
          type="datetime-local"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          required
        />

        <FloatingInput
          id="game-venue"
          label="Venue"
          value={form.venue}
          onChange={(e) => setForm({ ...form, venue: e.target.value })}
        />

        {!editingGame && athleticsCalendars.length > 0 && (
          <FloatingDropdown
            id="game-calendar"
            label="Link to Calendar"
            value={form.calendarId}
            onChange={(v) => setForm({ ...form, calendarId: v })}
            options={calendarOptions}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </DetailDrawer>
  )
}
