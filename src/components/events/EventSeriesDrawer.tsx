'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOptimisticMutation } from '@/lib/hooks/useOptimisticMutation'
import { fetchApi } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { useToast } from '@/components/Toast'
import { Loader2, Monitor, Wrench } from 'lucide-react'
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
  return useOptimisticMutation<EventSeries, CreateEventSeriesInput, unknown>({
    queryKey: ['event-series'],
    mutationFn: (data) =>
      fetchApi<EventSeries>('/api/events/series', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    invalidateKeys: [['event-projects']],
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

const AV_OPTIONS = [
  'Projector & Screen',
  'Wireless Microphone(s)',
  'Podium Mic',
  'Livestream / Recording',
  'Sound System / Speakers',
  'Stage Lighting',
  'Laptop / Presentation Clicker',
]

const FACILITIES_OPTIONS = [
  'Extra Seating / Chairs',
  'Table Arrangement',
  'Stage or Podium Setup',
  'Outdoor Setup',
  'Cleaning Before Event',
  'Cleaning After Event',
  'Signage / Wayfinding',
]

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
  requiresAV: boolean
  avNeeds: string[]
  avNotes: string
  requiresFacilities: boolean
  facilityNeeds: string[]
  facilityNotes: string
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
  requiresAV: false,
  avNeeds: [],
  avNotes: '',
  requiresFacilities: false,
  facilityNeeds: [],
  facilityNotes: '',
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
      resourceNeeds: {
        requiresAV: form.requiresAV,
        requiresFacilities: form.requiresFacilities,
        ...(form.requiresAV ? { avNeeds: form.avNeeds, avNotes: form.avNotes.trim() } : {}),
        ...(form.requiresFacilities ? { facilityNeeds: form.facilityNeeds, facilityNotes: form.facilityNotes.trim() } : {}),
      },
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
        className="flex-1 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        {createSeries.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Series
      </button>
      <button
        onClick={handleClose}
        className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
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
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Series Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Weekly Staff Meeting, Monthly Leadership Roundtable"
            className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
              errors.title ? 'border-red-300' : 'border-slate-200'
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Optional description..."
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 resize-none"
          />
        </div>

        {/* Recurrence rule builder */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Recurrence</h3>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Frequency</label>
            <div className="flex flex-wrap gap-2">
              {(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'] as FrequencyType[]).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => update('frequency', freq)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    form.frequency === freq
                      ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
              <label className="block text-xs font-medium text-slate-600 mb-2">Day(s) of the Week</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`w-10 h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      form.selectedDays.includes(day.value)
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
              <label className="block text-xs font-medium text-slate-600 mb-2">Day of Month</label>
              <input
                type="number"
                min="1"
                max="28"
                value={form.monthDay}
                onChange={(e) => update('monthDay', e.target.value)}
                className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {/* End condition */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">End Condition</label>
            <div className="flex gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.endType === 'count'}
                  onChange={() => update('endType', 'count')}
                  className="text-indigo-500"
                />
                <span className="text-sm text-slate-700">After N occurrences</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={form.endType === 'until'}
                  onChange={() => update('endType', 'until')}
                  className="text-indigo-500"
                />
                <span className="text-sm text-slate-700">Until date</span>
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
                  className="w-24 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                />
                <span className="text-sm text-slate-500">occurrences</span>
              </div>
            ) : (
              <input
                type="date"
                value={form.endUntil}
                onChange={(e) => update('endUntil', e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            )}
          </div>
        </div>

        {/* Default schedule settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Default Schedule</h3>

          {/* Start time + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Start Time</label>
              <input
                type="time"
                value={form.defaultStartTime}
                onChange={(e) => update('defaultStartTime', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                value={form.defaultDuration}
                onChange={(e) => update('defaultDuration', parseInt(e.target.value) || 60)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
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
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Location</label>
            <input
              type="text"
              value={form.defaultLocationText}
              onChange={(e) => update('defaultLocationText', e.target.value)}
              placeholder="e.g. Main Hall, Room 201"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Requirements</h3>
          <p className="text-xs text-slate-500 -mt-2">Tell each team what you need — they&apos;ll review and approve each event in the series.</p>

          {/* A/V Section */}
          <div className={`rounded-xl border transition-colors ${form.requiresAV ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
            <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
              <div className={`p-1.5 rounded-lg transition-colors ${form.requiresAV ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Monitor className={`w-4 h-4 transition-colors ${form.requiresAV ? 'text-blue-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">A/V Production</p>
                <p className="text-xs text-slate-500">Projectors, mics, livestream, sound</p>
              </div>
              <div
                role="switch"
                aria-checked={form.requiresAV}
                onClick={() => update('requiresAV', !form.requiresAV)}
                className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.requiresAV ? 'bg-blue-500' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresAV ? 'translate-x-4' : ''}`} />
              </div>
            </label>
            {form.requiresAV && (
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-blue-100 pt-3">
                <p className="text-xs font-medium text-slate-700">What do you need?</p>
                <div className="flex flex-wrap gap-1.5">
                  {AV_OPTIONS.map((opt) => {
                    const selected = form.avNeeds.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            avNeeds: selected
                              ? prev.avNeeds.filter((n) => n !== opt)
                              : [...prev.avNeeds, opt],
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={form.avNotes}
                  onChange={(e) => update('avNotes', e.target.value)}
                  rows={2}
                  placeholder="Any other A/V details — specific equipment, setup timing, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none bg-white"
                />
              </div>
            )}
          </div>

          {/* Facilities Section */}
          <div className={`rounded-xl border transition-colors ${form.requiresFacilities ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
            <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
              <div className={`p-1.5 rounded-lg transition-colors ${form.requiresFacilities ? 'bg-amber-100' : 'bg-slate-100'}`}>
                <Wrench className={`w-4 h-4 transition-colors ${form.requiresFacilities ? 'text-amber-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">Facilities</p>
                <p className="text-xs text-slate-500">Room setup, cleaning, staging, outdoor needs</p>
              </div>
              <div
                role="switch"
                aria-checked={form.requiresFacilities}
                onClick={() => update('requiresFacilities', !form.requiresFacilities)}
                className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.requiresFacilities ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresFacilities ? 'translate-x-4' : ''}`} />
              </div>
            </label>
            {form.requiresFacilities && (
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-amber-100 pt-3">
                <p className="text-xs font-medium text-slate-700">What do you need?</p>
                <div className="flex flex-wrap gap-1.5">
                  {FACILITIES_OPTIONS.map((opt) => {
                    const selected = form.facilityNeeds.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            facilityNeeds: selected
                              ? prev.facilityNeeds.filter((n) => n !== opt)
                              : [...prev.facilityNeeds, opt],
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                <textarea
                  value={form.facilityNotes}
                  onChange={(e) => update('facilityNotes', e.target.value)}
                  rows={2}
                  placeholder="Any other details — seating layout, special equipment, timing, etc."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* RRULE preview */}
        {form.title && (
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-1">RRULE Preview</p>
            <p className="text-xs font-mono text-slate-700 break-all">
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
