'use client'

import { useEffect, useState } from 'react'
import { Plus, Calendar, Trophy } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { IllustrationAthletics } from '@/components/illustrations'

type Season = {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
  _count: { teams: number }
}

interface SeasonsPanelProps {
  sportId: string
  sportName: string
}

export default function SeasonsPanel({ sportId, sportName }: SeasonsPanelProps) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const fetchSeasons = async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/athletics/seasons?sportId=${sportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setSeasons(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSeasons()
  }, [sportId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      setError('Name, start date, and end date are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/athletics/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sportId,
          name: form.name,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          isCurrent: form.isCurrent,
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to create season')
        return
      }
      setForm({ name: '', startDate: '', endDate: '', isCurrent: false })
      setShowForm(false)
      fetchSeasons()
    } catch {
      setError('Failed to create season')
    } finally {
      setSaving(false)
    }
  }

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
        <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Seasons</h3>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Season
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
          <FloatingInput
            id="season-name"
            label="Season Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <FloatingInput
              id="season-start"
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
            <FloatingInput
              id="season-end"
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
              className="rounded border-gray-300 text-primary-500 focus-visible:ring-primary-500"
            />
            Mark as current season
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {saving ? 'Creating...' : 'Create Season'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError('') }}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Seasons list */}
      {seasons.length === 0 ? (
        <div className="text-center py-6">
          <IllustrationAthletics className="w-32 h-24 mx-auto mb-1" />
          <p className="text-sm text-gray-400">No seasons yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {seasons.map((season) => (
            <div
              key={season.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{season.name}</span>
                  {season.isCurrent && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-green-100 text-green-700 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatDateRange(season.startDate, season.endDate)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0 ml-3">
                <Trophy className="w-3 h-3" />
                {season._count.teams} team{season._count.teams !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
