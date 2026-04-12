'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CalendarDays, Users, Calendar, Clock, Monitor, Wrench,
  Check, ChevronRight, ChevronLeft, Sparkles, ShieldAlert, Trophy,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { useCreateEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import LocationPicker, { defaultLocationData, type LocationData } from '@/components/events/LocationPicker'
import { PeoplePicker } from '@/components/events/PeoplePicker'
import type { CreateEventProjectInput } from '@/lib/types/event-project'

type EventMode = 'single' | 'multiday'
type Step = 1 | 2 | 3

const STEP_LABELS = ['Details', 'Location', 'Team & People'] as const

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateEventProjectModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: EventMode
}

interface FormData {
  title: string
  description: string
  startsAt: string
  startsAtTime: string
  endsAt: string
  endsAtTime: string
  expectedAttendance: string
  requiresAV: boolean
  avNeeds: string[]
  avNotes: string
  requiresFacilities: boolean
  facilityNeeds: string[]
  facilityNotes: string
  requiresCustodial: boolean
  requiresSecurity: boolean
  requiresAthleticDirector: boolean
}

const defaultForm: FormData = {
  title: '',
  description: '',
  startsAt: '',
  startsAtTime: '',
  endsAt: '',
  endsAtTime: '',
  expectedAttendance: '',
  requiresAV: false,
  avNeeds: [],
  avNotes: '',
  requiresFacilities: false,
  facilityNeeds: [],
  facilityNotes: '',
  requiresCustodial: false,
  requiresSecurity: false,
  requiresAthleticDirector: false,
}

const MODE_CONFIG: Record<EventMode, { title: string; placeholder: string }> = {
  single: { title: 'New Single Event', placeholder: 'e.g. Spring Retreat 2026' },
  multiday: { title: 'New Multi-day Event', placeholder: 'e.g. Fall Conference 2026' },
}

// ─── Stepper Header ──────────────────────────────────────────────────────────

function StepperHeader({ currentStep, onStepClick }: { currentStep: Step; onStepClick: (s: Step) => void }) {
  // Warm editorial stepper — near-black active, warm chip completed, muted pending.
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
        // Allow clicking any completed step to jump back
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
              style={{
                backgroundColor: bg,
                color: text,
                cursor: isClickable ? 'pointer' : 'default',
                border: 'none',
                letterSpacing: '-0.005em',
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.2)'
                    : isCompleted
                    ? '#1a1915'
                    : 'rgba(17,15,10,0.08)',
                  color: isCompleted ? '#ffffff' : text,
                }}
              >
                {isCompleted ? <Check className="w-3 h-3" strokeWidth={3} /> : step}
              </span>
              <span className="truncate">{label}</span>
            </button>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: '#a8a49d' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function CreateEventProjectModal({ isOpen, onClose, initialMode = 'single' }: CreateEventProjectModalProps) {
  const router = useRouter()
  const createProject = useCreateEventProject()
  const { toast } = useToast()
  const [form, setForm] = useState<FormData>(defaultForm)
  const [location, setLocation] = useState<LocationData>(defaultLocationData())
  const [requestedAttendees, setRequestedAttendees] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'location', string>>>({})
  const [mode, setMode] = useState<EventMode>(initialMode)
  const [step, setStep] = useState<Step>(1)

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setStep(1)
    }
  }, [isOpen, initialMode])

  const config = MODE_CONFIG[mode]
  const isMultiDay = mode === 'multiday'

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Clear location error whenever the picker changes — otherwise "Please
  // select a building" lingers after the user toggles Off Campus.
  function handleLocationChange(newLocation: LocationData) {
    setLocation(newLocation)
    setErrors((prev) => ({ ...prev, location: undefined }))
  }

  function handleClose() {
    setForm(defaultForm)
    setLocation(defaultLocationData())
    setRequestedAttendees([])
    setErrors({})
    setStep(1)
    onClose()
  }

  // ── Per-step validation ────────────────────────────────────────────────────

  function validateStep(s: Step): boolean {
    const newErrors: Partial<Record<keyof FormData | 'location', string>> = {}

    if (s === 1) {
      if (!form.title.trim()) newErrors.title = 'Title is required'
      if (!form.startsAt) newErrors.startsAt = 'Start date is required'
      if (isMultiDay && !form.endsAt) newErrors.endsAt = 'End date is required'
    }

    if (s === 2) {
      if (location.isOffCampus) {
        if (!location.venueAddress && !location.venueName) {
          newErrors.location = 'Please search for or enter an off-campus location'
        }
      } else {
        if (!location.buildingId) {
          newErrors.location = 'Please select a building'
        }
      }
    }

    // Step 3 has no required fields — team/people are optional

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

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Validate all steps
    if (!validateStep(1) || !validateStep(2)) {
      // Jump to first invalid step
      if (!form.title.trim() || !form.startsAt || (isMultiDay && !form.endsAt)) {
        setStep(1)
      } else {
        setStep(2)
      }
      return
    }

    const startDateTime = form.startsAtTime
      ? `${form.startsAt}T${form.startsAtTime}:00`
      : `${form.startsAt}T00:00:00`

    let endDateTime: string
    if (isMultiDay) {
      endDateTime = `${form.endsAt}T23:59:59`
    } else {
      endDateTime = form.endsAtTime
        ? `${form.startsAt}T${form.endsAtTime}:00`
        : `${form.startsAt}T${form.startsAtTime || '23:59'}:59`
    }

    const payload: CreateEventProjectInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      startsAt: new Date(startDateTime),
      endsAt: new Date(endDateTime),
      isMultiDay,
      requiresAV: form.requiresAV,
      requiresFacilities: form.requiresFacilities,
      requiresCustodial: form.requiresCustodial,
      requiresSecurity: form.requiresSecurity,
      requiresAthleticDirector: form.requiresAthleticDirector,
      isOffCampus: location.isOffCampus,
      locationText: location.locationText || undefined,
      buildingId: location.isOffCampus ? undefined : (location.buildingId || undefined),
      areaId: location.isOffCampus ? undefined : (location.areaId || undefined),
      roomId: location.isOffCampus ? undefined : (location.roomId || undefined),
      venueName: location.isOffCampus ? (location.venueName || undefined) : undefined,
      venueAddress: location.isOffCampus ? (location.venueAddress || undefined) : undefined,
      venuePlaceId: location.isOffCampus ? (location.venuePlaceId || undefined) : undefined,
      expectedAttendance: form.expectedAttendance
        ? parseInt(form.expectedAttendance, 10)
        : undefined,
      metadata: {
        ...(form.requiresAV ? { avNeeds: form.avNeeds, avNotes: form.avNotes.trim() } : {}),
        ...(form.requiresFacilities ? { facilityNeeds: form.facilityNeeds, facilityNotes: form.facilityNotes.trim() } : {}),
        ...(requestedAttendees.length > 0 ? { requestedAttendees } : {}),
      },
    }

    try {
      const project = await createProject.mutateAsync(payload)
      toast('Event project created', 'success')
      handleClose()
      router.push(`/events/${project.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create event', 'error')
    }
  }

  // ── Footer with stepper nav ────────────────────────────────────────────────

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
          disabled={createProject.isPending}
          className="flex-1 max-w-xs py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {createProject.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Create {isMultiDay ? 'Multi-day ' : ''}Event
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={config.title}
      width="xl"
      footer={footer}
    >
      <div>
        <StepperHeader currentStep={step} onStepClick={(s) => setStep(s)} />

        {/* ═══════════════════════ Step 1: Event Details ═══════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder={config.placeholder}
                autoFocus
                className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 ${
                  errors.title ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                placeholder="Brief overview of this event..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none"
              />
            </div>

            {/* Single-day: Date + Start/End times */}
            {!isMultiDay && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Calendar className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => {
                      update('startsAt', e.target.value)
                      update('endsAt', e.target.value)
                    }}
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 ${
                      errors.startsAt ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                  {errors.startsAt && <p className="text-xs text-red-500 mt-1">{errors.startsAt}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      <Clock className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={form.startsAtTime}
                      onChange={(e) => update('startsAtTime', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={form.endsAtTime}
                      onChange={(e) => update('endsAtTime', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Multi-day: Start Date → End Date */}
            {isMultiDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <CalendarDays className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(e) => update('startsAt', e.target.value)}
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 ${
                      errors.startsAt ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                  {errors.startsAt && <p className="text-xs text-red-500 mt-1">{errors.startsAt}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endsAt}
                    onChange={(e) => update('endsAt', e.target.value)}
                    min={form.startsAt}
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:border-indigo-400 ${
                      errors.endsAt ? 'border-red-300' : 'border-slate-200'
                    }`}
                  />
                  {errors.endsAt && <p className="text-xs text-red-500 mt-1">{errors.endsAt}</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════ Step 2: Location & Attendance ═══════════════════ */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <LocationPicker value={location} onChange={handleLocationChange} error={errors.location} />

            {/* Expected Attendance */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Users className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                Expected Attendance
              </label>
              <input
                type="number"
                min="1"
                value={form.expectedAttendance}
                onChange={(e) => update('expectedAttendance', e.target.value)}
                placeholder="e.g. 120"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════ Step 3: Team & People ══════════════════════════ */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── Requirements ── */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">Requirements</p>
              <p className="text-xs text-slate-500 -mt-2">Tell each team what you need — they&apos;ll review and approve before the event is confirmed.</p>

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

            {/* ── Additional Resource Toggles ── */}
            <div className="space-y-2">
              {/* Custodial */}
              <div className={`rounded-xl border transition-colors ${form.requiresCustodial ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <div className={`p-1.5 rounded-lg transition-colors ${form.requiresCustodial ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Sparkles className={`w-4 h-4 transition-colors ${form.requiresCustodial ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">Custodial</p>
                    <p className="text-[11px] text-slate-500">Cleaning and setup coordination</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={form.requiresCustodial}
                    onClick={() => update('requiresCustodial', !form.requiresCustodial)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.requiresCustodial ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresCustodial ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>

              {/* Security */}
              <div className={`rounded-xl border transition-colors ${form.requiresSecurity ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <div className={`p-1.5 rounded-lg transition-colors ${form.requiresSecurity ? 'bg-red-100' : 'bg-slate-100'}`}>
                    <ShieldAlert className={`w-4 h-4 transition-colors ${form.requiresSecurity ? 'text-red-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">Security</p>
                    <p className="text-[11px] text-slate-500">Security presence and parking management</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={form.requiresSecurity}
                    onClick={() => update('requiresSecurity', !form.requiresSecurity)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.requiresSecurity ? 'bg-red-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresSecurity ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>

              {/* Athletic Director */}
              <div className={`rounded-xl border transition-colors ${form.requiresAthleticDirector ? 'border-purple-200 bg-purple-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <div className={`p-1.5 rounded-lg transition-colors ${form.requiresAthleticDirector ? 'bg-purple-100' : 'bg-slate-100'}`}>
                    <Trophy className={`w-4 h-4 transition-colors ${form.requiresAthleticDirector ? 'text-purple-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">Athletic Director</p>
                    <p className="text-[11px] text-slate-500">Athletic facility and schedule approval</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={form.requiresAthleticDirector}
                    onClick={() => update('requiresAthleticDirector', !form.requiresAthleticDirector)}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${form.requiresAthleticDirector ? 'bg-purple-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requiresAthleticDirector ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="border-t border-slate-100" />

            {/* ── Request Specific People ── */}
            <PeoplePicker
              selectedUserIds={requestedAttendees}
              onChange={setRequestedAttendees}
            />
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
