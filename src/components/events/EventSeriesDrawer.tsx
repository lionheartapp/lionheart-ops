'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { useToast } from '@/components/Toast'
import { Loader2 } from 'lucide-react'
import type { CreateEventSeriesInput } from '@/lib/types/event-project'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventSeries {
  id: string
  title: string
  description: string | null
  rrule: string | null
  defaultStartTime: string | null
  defaultDuration: number | null
  defaultLocationText: string | null
  isActive: boolean
  createdAt: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useCreateEventSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEventSeriesInput) =>
      fetchApi<EventSeries>('/api/events/series', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-series'] })
      queryClient.invalidateQueries({ queryKey: ['event-projects'] })
    },
  })
}

// ─── RRULE builder utilities ──────────────────────────────────────────────────

type FrequencyType = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY'

const DAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
]

const DURATION_PRESETS = [30, 60, 90, 120]

function buildRRule(
  frequency: FrequencyType,
  selectedDays: string[],
  monthDay: string,
  endType: 'count' | 'until',
  endCount: string,
  endUntil: string
): string {
  const parts: string[] = ['RRULE:FREQ=']
  const freqMap: Record<FrequencyType, string> = {
    WEEKLY: 'WEEKLY',
    BIWEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
  }
  parts[0] = `RRULE:FREQ=${freqMap[frequency]}`

  if (frequency === 'BIWEEKLY') {
    parts.push('INTERVAL=2')
  }

  if ((frequency === 'WEEKLY' || frequency === 'BIWEEKLY') && selectedDays.length > 0) {
    parts.push(`BYDAY=${selectedDays.join(',')}`)
  }

  if (frequency === 'MONTHLY' && monthDay) {
    parts.push(`BYMONTHDAY=${monthDay}`)
  }

  if (endType === 'count' && endCount) {
    parts.push(`COUNT=${endCount}`)
  } else if (endType === 'until' && endUntil) {
    // Convert date to RRULE UNTIL format: YYYYMMDD
    const until = endUntil.replace(/-/g, '')
    parts.push(`UNTIL=${until}T000000Z`)
  }

  return parts.join(';')
}

// ─── Form State ───────────────────────────────────────────────────────────────

interface SeriesFormData {
  title: string
  description: string
  frequency: FrequencyType
  selectedDays: string[]
  monthDay: string
  endType: 'count' | 'until'
  endCount: string
  endUntil: string
  defaultStartTime: string
  defaultDuration: number
  defaultLocationText: string
}

const defaultForm: SeriesFormData = {
  title: '',
  description: '',
  frequency: 'WEEKLY',
  selectedDays: ['MO'],
  monthDay: '1',
  endType: 'count',
  endCount: '10',
  endUntil: '',
  defaultStartTime: '09:00',
  defaultDuration: 60,
  defaultLocationText: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EventSeriesDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function EventSeriesDrawer({ isOpen, onClose }: EventSeriesDrawerProps) {
  const { toast } = useToast()
  const createSeries = useCreateEventSeries()
  const [form, setForm] = useState<SeriesFormData>(defaultForm)
  const [errors, setErrors] = useState<Partial<Record<keyof SeriesFormData, string>>>({})

  function update<K extends keyof SeriesFormData>(key: K, value: SeriesFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleDay(day: string) {
    setForm((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day],
    }))
  }

  function handleClose() {
    setForm(defaultForm)
    setErrors({})
    onClose()
  }

  async function handleSubmit() {
    const newErrors: Partial<Record<keyof SeriesFormData, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Title is required'
    if (
      (form.frequency === 'WEEKLY' || form.frequency === 'BIWEEKLY') &&
      form.selectedDays.length === 0
    ) {
      newErrors.selectedDays = 'Select at least one day'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const rrule = buildRRule(
      form.frequency,
      form.selectedDays,
      form.monthDay,
      form.endType,
      form.endCount,
      form.endUntil
    )

    const payload: CreateEventSeriesInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      rrule,
      defaultStartTime: form.defaultStartTime || undefined,
      defaultDuration: form.defaultDuration || undefined,
      defaultLocationText: form.defaultLocationText.trim() || undefined,
    }

    try {
      await createSeries.mutateAsync(payload)
      toast('Event series created', 'success')
      handleClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create series', 'error')
    }
  }

  const footer = (
    <div className="flex gap-3">
      <button
        onClick={handleSubmit}
        disabled={createSeries.isPending}
        className="flex-1 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        {createSeries.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Series
      </button>
      <button
        onClick={handleClose}
        className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
      >
        Cancel
      </button>
    </div>
  )

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="New Event Series"
      width="lg"
      footer={footer}
    >
      <div className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Series Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Weekly Chapel, Monthly Leadership Meeting"
            className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
              errors.title ? 'border-red-300' : 'border-gray-200'
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Optional description..."
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 resize-none"
          />
        </div>

        {/* Recurrence rule builder */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Recurrence</h3>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Frequency</label>
            <div className="flex flex-wrap gap-2">
              {(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'] as FrequencyType[]).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => update('frequency', freq)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    form.frequency === freq
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {freq === 'BIWEEKLY' ? 'Every 2 Weeks' : freq.charAt(0) + freq.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Day of week (weekly/biweekly) */}
          {(form.frequency === 'WEEKLY' || form.frequency === 'BIWEEKLY') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Day(s) of the Week</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      form.selectedDays.includes(day.value)
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {errors.selectedDays && (
                <p className="text-xs text-red-500 mt-1">{errors.selectedDays}</p>
              )}
            </div>
          )}

          {/* Day of month (monthly) */}
          {form.frequency === 'MONTHLY' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Day of Month</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.monthDay}
                onChange={(e) => update('monthDay', e.target.value)}
                className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {/* End condition */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">End Condition</label>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.endType === 'count'}
                  onChange={() => update('endType', 'count')}
                  className="text-indigo-500"
                />
                <span className="text-sm text-gray-700">After N occurrences</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.endType === 'until'}
                  onChange={() => update('endType', 'until')}
                  className="text-indigo-500"
                />
                <span className="text-sm text-gray-700">Until date</span>
              </label>
            </div>
            {form.endType === 'count' ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.endCount}
                  onChange={(e) => update('endCount', e.target.value)}
                  className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                <span className="text-sm text-gray-500">occurrences</span>
              </div>
            ) : (
              <input
                type="date"
                value={form.endUntil}
                onChange={(e) => update('endUntil', e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            )}
          </div>
        </div>

        {/* Default schedule settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Default Schedule</h3>

          {/* Start time + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Default Start Time</label>
              <input
                type="time"
                value={form.defaultStartTime}
                onChange={(e) => update('defaultStartTime', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={form.defaultDuration}
                onChange={(e) => update('defaultDuration', parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
              {/* Duration presets */}
              <div className="flex gap-1.5 mt-1.5">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => update('defaultDuration', d)}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                      form.defaultDuration === d
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Default location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Default Location</label>
            <input
              type="text"
              value={form.defaultLocationText}
              onChange={(e) => update('defaultLocationText', e.target.value)}
              placeholder="e.g. Chapel, Room 201"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* RRULE preview */}
        {form.title && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-1">RRULE Preview</p>
            <p className="text-xs font-mono text-gray-700 break-all">
              {buildRRule(
                form.frequency,
                form.selectedDays,
                form.monthDay,
                form.endType,
                form.endCount,
                form.endUntil
              )}
            </p>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
