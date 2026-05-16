'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { useToast } from '@/components/Toast'
import { Loader2, Monitor, Wrench, Check, ChevronRight, ChevronLeft, Repeat } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Radio, RadioGroup } from '@/components/ui/Radio'
import LocationPicker, { defaultLocationData, type LocationData } from '@/components/events/LocationPicker'
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
  requiresAV: false,
  avNeeds: [],
  avNotes: '',
  requiresFacilities: false,
  facilityNeeds: [],
  facilityNotes: '',
}

// ─── Step types ──────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3
const STEP_LABELS = ['Details', 'Location', 'Team & People'] as const

function SeriesStepperHeader({ currentStep, onStepClick }: { currentStep: Step; onStepClick: (s: Step) => void }) {
  const ACTIVE_BG = '#1a1915'
  const ACTIVE_TEXT = '#ffffff'
  const COMPLETED_BG = '#ede9e0'
  const COMPLETED_TEXT = '#1a1915'
  const PENDING_BG = '#f6f4f0'
  const PENDING_TEXT = '#a8a49d'

  return (
    <div className="flex items-center gap-1 mb-6">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const isActive = step === currentStep
        const isCompleted = step < currentStep
        const isClickable = step < currentStep

        const bg = isActive ? ACTIVE_BG : isCompleted ? COMPLETED_BG : PENDING_BG
        const text = isActive ? ACTIVE_TEXT : isCompleted ? COMPLETED_TEXT : PENDING_TEXT

        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable && !isActive}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-[11.5px] font-semibold transition-all w-full"
              style={{ backgroundColor: bg, color: text, cursor: isClickable ? 'pointer' : 'default', border: 'none', letterSpacing: '-0.005em' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : isCompleted ? '#1a1915' : 'rgba(17,15,10,0.08)',
                  color: isCompleted ? '#ffffff' : text,
                }}
              >
                {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : step}
              </span>
              <span className="truncate">{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#a8a49d' }} />
            )}
          </div>
        )
      })}
    </div>
  )
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
  const [location, setLocation] = useState<LocationData>(defaultLocationData())
  const [errors, setErrors] = useState<Partial<Record<keyof SeriesFormData | 'location', string>>>({})
  const [step, setStep] = useState<Step>(1)

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
    setLocation(defaultLocationData())
    setErrors({})
    setStep(1)
    onClose()
  }

  function validateStep(s: Step): boolean {
    const newErrors: Partial<Record<keyof SeriesFormData, string>> = {}
    if (s === 1) {
      if (!form.title.trim()) newErrors.title = 'Title is required'
      if ((form.frequency === 'WEEKLY' || form.frequency === 'BIWEEKLY') && form.selectedDays.length === 0) {
        newErrors.selectedDays = 'Select at least one day'
      }
    }
    // Step 2 and 3 have no required fields
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }

  function goNext() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 3) as Step)
    }
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1) as Step)
  }

  async function handleSubmit() {
    if (!validateStep(1)) {
      setStep(1)
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
      defaultLocationText: location.locationText || location.venueName || undefined,
      defaultBuildingId: location.isOffCampus ? undefined : (location.buildingId || undefined),
      defaultRoomId: location.isOffCampus ? undefined : (location.roomId || undefined),
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
      {step > 1 && (
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>
      )}
      <div className="flex-1" />
      {step < 3 ? (
        <button
          type="button"
          onClick={goNext}
          className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer flex items-center gap-1.5"
        >
          Continue
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createSeries.isPending}
          className="flex-1 max-w-xs py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {createSeries.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Series
        </button>
      )}
      <button
        type="button"
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
      <div>
        {/* Event type badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-slate-100">
            <Repeat className="w-4 h-4 text-slate-500" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
            Recurring Series
          </span>
        </div>

        <SeriesStepperHeader currentStep={step} onStepClick={(s) => setStep(s)} />

        {/* ═══════════════════════ Step 1: Details ═══════════════════════ */}
        {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Series Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Weekly Staff Meeting, Monthly Leadership Roundtable"
            hasError={!!errors.title}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Optional description..."
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
              <div className="w-24">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={form.monthDay}
                  onChange={(e) => update('monthDay', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">End Condition</label>
            <div className="mb-3">
              <RadioGroup
                value={form.endType}
                onChange={(v) => update('endType', v as 'count' | 'until')}
                className="flex flex-row gap-4"
              >
                <Radio value="count" label="After N occurrences" />
                <Radio value="until" label="Until date" />
              </RadioGroup>
            </div>
            {form.endType === 'count' ? (
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={form.endCount}
                    onChange={(e) => update('endCount', e.target.value)}
                  />
                </div>
                <span className="text-sm text-slate-500">occurrences</span>
              </div>
            ) : (
              <div className="w-48">
                <Input
                  type="date"
                  value={form.endUntil}
                  onChange={(e) => update('endUntil', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        </div>
        )}

        {/* ═══════════════════ Step 2: Location & Schedule ═══════════════════ */}
        {step === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
        {/* Default schedule settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Default Schedule</h3>

          {/* Start time + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Default Start Time</label>
              <Input
                type="time"
                value={form.defaultStartTime}
                onChange={(e) => update('defaultStartTime', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Duration (minutes)</label>
              <Input
                type="number"
                min={1}
                value={form.defaultDuration}
                onChange={(e) => update('defaultDuration', parseInt(e.target.value) || 60)}
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

          {/* Location picker */}
          <LocationPicker
            value={location}
            onChange={(loc) => {
              setLocation(loc)
              setErrors((prev) => ({ ...prev, location: undefined }))
            }}
            error={errors.location}
          />
        </div>
        </div>
        )}

        {/* ═══════════════════ Step 3: Team & People ═══════════════════ */}
        {step === 3 && (
        <div className="space-y-4 animate-in fade-in duration-200">
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
                <Textarea
                  value={form.avNotes}
                  onChange={(e) => update('avNotes', e.target.value)}
                  rows={2}
                  placeholder="Any other A/V details — specific equipment, setup timing, etc."
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
                <Textarea
                  value={form.facilityNotes}
                  onChange={(e) => update('facilityNotes', e.target.value)}
                  rows={2}
                  placeholder="Any other details — seating layout, special equipment, timing, etc."
                />
              </div>
            )}
          </div>
        </div>

        </div>
        )}
      </div>
    </DetailDrawer>
  )
}
