'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, CalendarOff, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'

interface BlackoutDate {
  id: string
  date: string
  reason: string | null
  appliesToAll: boolean
  spaceId: string | null
  space: { id: string; name: string } | null
  createdAt: string
}

interface ApiResponse<T> {
  ok: boolean
  data: T
  error?: { code: string; message: string }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

export default function BlackoutDatesTab() {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')

  const { data: dates = [], isLoading } = useQuery<BlackoutDate[]>({
    queryKey: ['blackout-dates'],
    queryFn: async () => {
      const res = await fetch('/api/facilities/blackout-dates')
      const json: ApiResponse<BlackoutDate[]> = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to load')
      return json.data
    },
  })

  const addMutation = useMutation({
    mutationFn: async (body: { date: string; reason?: string }) => {
      const res = await fetch('/api/facilities/blackout-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date(body.date).toISOString(),
          reason: body.reason || undefined,
          appliesToAll: true,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to add')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates'] })
      setShowAdd(false)
      setNewDate('')
      setNewReason('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/facilities/blackout-dates?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Failed to delete')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blackout-dates'] })
    },
  })

  // Split into upcoming and past
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const upcoming = dates.filter((d) => new Date(d.date) >= now)
  const past = dates.filter((d) => new Date(d.date) < now)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Blackout Dates</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            School closures and holidays. Facility bookings are blocked on these dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Date
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="ui-glass p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Reason (optional)</label>
              <Input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. Winter Break, Teacher In-Service"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!newDate) return
                addMutation.mutate({ date: newDate, reason: newReason })
              }}
              disabled={!newDate || addMutation.isPending}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              {addMutation.isPending ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setNewDate(''); setNewReason('') }}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Upcoming dates */}
      {!isLoading && upcoming.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Upcoming</h3>
          <div className="space-y-1.5">
            {upcoming.map((d) => (
              <div key={d.id} className="ui-glass-hover flex items-center gap-3 px-4 py-3 rounded-xl">
                <CalendarOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{formatDate(d.date)}</p>
                  {d.reason && <p className="text-xs text-slate-500">{d.reason}</p>}
                </div>
                {d.space && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Building2 className="w-3 h-3" />
                    {d.space.name}
                  </div>
                )}
                {d.appliesToAll && (
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    All spaces
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(d.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past dates */}
      {!isLoading && past.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Past</h3>
          <div className="space-y-1.5 opacity-60">
            {past.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl">
                <CalendarOff className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">{formatDate(d.date)}</p>
                  {d.reason && <p className="text-xs text-slate-400">{d.reason}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(d.id)}
                  className="p-1.5 text-slate-200 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && dates.length === 0 && !showAdd && (
        <div className="text-center py-12">
          <CalendarOff className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No blackout dates</p>
          <p className="text-xs text-slate-400 mt-1">Add school holidays and closure dates to block facility bookings.</p>
        </div>
      )}
    </div>
  )
}
