'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, CalendarDays, CalendarRange, Users, Monitor, Wrench,
  Check, ChevronRight, ChevronLeft, Sparkles, ShieldAlert,
  School as SchoolIcon,
} from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { TimePicker } from '@/components/calendar/TimePicker'
import { useCreateEventProject } from '@/lib/hooks/useEventProject'
import { useCreateSubmission, useSubmitSubmission } from '@/lib/hooks/usePlanningSeason'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { useToast } from '@/components/Toast'
import LocationPicker, { defaultLocationData, type LocationData } from '@/components/events/LocationPicker'
import { PeoplePicker } from '@/components/events/PeoplePicker'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import FormFieldRenderer, { type FormFieldData } from '@/components/forms/FormFieldRenderer'
import { useSystemForm, getDynamicFields } from '@/lib/hooks/useSystemForm'
import type { CreateEventProjectInput } from '@/lib/types/event-project'

type EventMode = 'single' | 'multiday'
type Step = 1 | 2 | 3

const STEP_LABELS = ['Details', 'Location', 'Team & People'] as const

// ─── Constants ───────────────────────────────────────────────────────────────

// AV_OPTIONS and FACILITIES_OPTIONS moved to system form definitions.
// They are now loaded dynamically from the form template (see system-form-seeds.ts).

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreateEventProjectModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: EventMode
  /** When set, creates a planning submission instead of a live event project */
  planningSeasonId?: string | null
}

interface FormData {
  title: string
  description: string
  schoolId: string | null
  startsAt: string
  startsAtTime: string
  endsAt: string
  endsAtTime: string
  expectedAttendance: string
}

/** Dynamic field values keyed by field.key — populated from system form template */
type DynamicFieldValues = Record<string, unknown>

const defaultForm: FormData = {
  title: '',
  description: '',
  schoolId: null,
  startsAt: '',
  startsAtTime: '',
  endsAt: '',
  endsAtTime: '',
  expectedAttendance: '',
}

const ALL_SCHOOLS_VALUE = '__ALL_SCHOOLS__'

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Pick a date'
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
  const monthName = date.toLocaleDateString('en-US', { month: 'short' })
  return `${dayName}, ${monthName} ${day}`
}

function safePick(ref: React.RefObject<HTMLInputElement | null>) {
  const el = ref.current
  if (!el) return
  if (typeof el.showPicker === 'function') {
    try { el.showPicker() } catch { el.click() }
  } else {
    el.click()
  }
}

const MODE_CONFIG: Record<EventMode, { title: string; placeholder: string; icon: typeof CalendarDays; badge: string; badgeColor: string }> = {
  single: { title: 'New Single Event', placeholder: 'e.g. Spring Retreat 2026', icon: CalendarDays, badge: 'Single Event', badgeColor: 'bg-blue-50 text-blue-700' },
  multiday: { title: 'New Multi-day Event', placeholder: 'e.g. Fall Conference 2026', icon: CalendarRange, badge: 'Multi-day', badgeColor: 'bg-indigo-50 text-indigo-700' },
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

// ─── Date & Time Block (Cal.com-style) ──────────────────────────────────────

function DateTimeBlock({
  form,
  update,
  errors,
  isMultiDay,
}: {
  form: FormData
  update: <K extends keyof FormData>(key: K, value: FormData[K]) => void
  errors: Partial<Record<keyof FormData | 'location', string>>
  isMultiDay: boolean
}) {
  const startDateRef = useRef<HTMLInputElement>(null)
  const endDateRef = useRef<HTMLInputElement>(null)

  // When start time changes, auto-advance end time to maintain 1-hour gap
  const handleStartTimeChange = useCallback((time: string) => {
    update('startsAtTime', time)
    // Auto-set end time to 1 hour later
    const [h, m] = time.split(':').map(Number)
    const endH = (h + 1) % 24
    const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    update('endsAtTime', endTime)
  }, [update])

  const handleEndTimeChange = useCallback((time: string) => {
    update('endsAtTime', time)
  }, [update])

  // Smart default: if no date set, default to today when clicking
  const ensureDate = () => {
    if (!form.startsAt) {
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`
      update('startsAt', dateStr)
      update('endsAt', dateStr)
    }
  }

  if (isMultiDay) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <button
              type="button"
              onClick={() => { ensureDate(); safePick(startDateRef) }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                form.startsAt
                  ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-dashed border-slate-300'
              } ${errors.startsAt ? 'ring-1 ring-red-300' : ''}`}
            >
              <span className="text-[10px] uppercase tracking-wide text-slate-500 block mb-0.5">From</span>
              {form.startsAt ? formatDateDisplay(form.startsAt) : 'Pick start date'}
            </button>
            {/* eslint-disable-next-line no-restricted-syntax -- sr-only date input is the
                native picker target for the styled button above; <Input> would render a
                visible field and break this UX */}
            <input
              ref={startDateRef}
              type="date"
              value={form.startsAt}
              onChange={(e) => update('startsAt', e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
          <span className="text-slate-300 text-sm mt-4">&rarr;</span>
          <div className="flex-1">
            <button
              type="button"
              onClick={() => { ensureDate(); safePick(endDateRef) }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                form.endsAt
                  ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-dashed border-slate-300'
              } ${errors.endsAt ? 'ring-1 ring-red-300' : ''}`}
            >
              <span className="text-[10px] uppercase tracking-wide text-slate-500 block mb-0.5">To</span>
              {form.endsAt ? formatDateDisplay(form.endsAt) : 'Pick end date'}
            </button>
            {/* eslint-disable-next-line no-restricted-syntax -- sr-only native picker target */}
            <input
              ref={endDateRef}
              type="date"
              value={form.endsAt}
              onChange={(e) => update('endsAt', e.target.value)}
              min={form.startsAt}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </div>
        {errors.startsAt && <p className="text-xs text-red-500">{errors.startsAt}</p>}
        {errors.endsAt && <p className="text-xs text-red-500">{errors.endsAt}</p>}
      </div>
    )
  }

  // Single-day: unified "when" block
  return (
    <div className="space-y-3">
      {/* Date as clickable chip */}
      <div>
        <button
          type="button"
          onClick={() => { ensureDate(); safePick(startDateRef) }}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
            form.startsAt
              ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-dashed border-slate-300'
          } ${errors.startsAt ? 'ring-1 ring-red-300' : ''}`}
        >
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          {form.startsAt ? formatDateDisplay(form.startsAt) : 'Pick a date'}
        </button>
        {/* eslint-disable-next-line no-restricted-syntax -- sr-only native picker target */}
        <input
          ref={startDateRef}
          type="date"
          value={form.startsAt}
          onChange={(e) => {
            update('startsAt', e.target.value)
            update('endsAt', e.target.value)
          }}
          className="sr-only"
          tabIndex={-1}
        />
        {errors.startsAt && <p className="text-xs text-red-500 mt-1">{errors.startsAt}</p>}
      </div>

      {/* Time pickers as pill dropdowns */}
      <div className="flex items-center gap-2">
        <TimePicker
          value={form.startsAtTime || '09:00'}
          onChange={handleStartTimeChange}
        />
        <span className="text-slate-300 text-sm">&ndash;</span>
        <TimePicker
          value={form.endsAtTime || '10:00'}
          onChange={handleEndTimeChange}
        />
      </div>
    </div>
  )
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function CreateEventProjectModal({ isOpen, onClose, initialMode = 'single', planningSeasonId }: CreateEventProjectModalProps) {
  const router = useRouter()
  const createProject = useCreateEventProject()
  const createSubmission = useCreateSubmission()
  const submitSubmission = useSubmitSubmission()
  const { toast } = useToast()
  const isPlanning = !!planningSeasonId
  const { activeSchoolId, schools, isMultiSchool } = useActiveSchool()
  const [form, setForm] = useState<FormData>(defaultForm)
  const [dynamicValues, setDynamicValues] = useState<DynamicFieldValues>({})
  const [location, setLocation] = useState<LocationData>(defaultLocationData())
  const [requestedAttendees, setRequestedAttendees] = useState<string[]>([])
  const [showPeoplePicker, setShowPeoplePicker] = useState(false)
  const [peopleNote, setPeopleNote] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'location', string>>>({})
  const [mode, setMode] = useState<EventMode>(initialMode)
  const [step, setStep] = useState<Step>(1)

  // Fetch the system form definition for the current event type
  const systemKey = mode === 'multiday' ? 'multiday_event' : 'single_event'
  const { data: systemForm } = useSystemForm(systemKey)

  // Dynamic fields from the form template (DEFAULT + CUSTOM, excludes LOCKED)
  const step3DynamicFields = useMemo(
    () => getDynamicFields(systemForm, 'Team & People'),
    [systemForm]
  )

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode)
      setStep(1)
      // Default the school to whichever school the user currently has selected
      // in the global SchoolSelector. They can change it (or pick "All Schools"
      // for district-wide events) on Step 1 if they have access to multiple.
      setForm((prev) => ({ ...prev, schoolId: activeSchoolId }))
    }
  }, [isOpen, initialMode, activeSchoolId])

  const baseConfig = MODE_CONFIG[mode]
  const config = isPlanning
    ? { ...baseConfig, title: `Submit ${baseConfig.title.replace('New ', '')} to Year Plan` }
    : baseConfig
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
    setDynamicValues({})
    setLocation(defaultLocationData())
    setRequestedAttendees([])
    setShowPeoplePicker(false)
    setPeopleNote('')
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

    // Map dynamic field values back to legacy payload fields for backward compatibility
    const avNeeds = dynamicValues.av_needs as string[] | undefined
    const facilityNeeds = dynamicValues.facility_needs as string[] | undefined
    const requiresCustodial = !!dynamicValues.requires_custodial
    const requiresSecurity = !!dynamicValues.requires_security

    // Collect any non-standard dynamic fields (custom fields admins added)
    const knownDynamicKeys = new Set(['av_needs', 'facility_needs', 'requires_custodial', 'requires_security'])
    const customFields: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(dynamicValues)) {
      if (!knownDynamicKeys.has(k) && v != null && v !== '' && v !== false) {
        customFields[k] = v
      }
    }

    const payload: CreateEventProjectInput = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      schoolId: form.schoolId ?? undefined,
      startsAt: new Date(startDateTime),
      endsAt: new Date(endDateTime),
      isMultiDay,
      requiresAV: !!(avNeeds && avNeeds.length > 0),
      requiresFacilities: !!(facilityNeeds && facilityNeeds.length > 0),
      requiresCustodial,
      requiresSecurity,
      requiresAthleticDirector: false,
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
        ...(avNeeds && avNeeds.length > 0 ? { avNeeds } : {}),
        ...(facilityNeeds && facilityNeeds.length > 0 ? { facilityNeeds } : {}),
        ...(requestedAttendees.length > 0 ? { requestedAttendees, peopleNote: peopleNote.trim() || undefined } : {}),
        // Include the system form ID so per-event cloning can reference the template
        ...(systemForm ? { systemFormId: systemForm.id } : {}),
        // Include any custom fields the admin added to the template
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      },
    }

    try {
      if (isPlanning && planningSeasonId) {
        // Create as planning submission
        const duration = Math.round(
          (new Date(endDateTime).getTime() - new Date(startDateTime).getTime()) / 60000
        )
        const resourceNeeds: Array<{ resourceType: string; details?: string }> = []
        if (avNeeds && avNeeds.length > 0) resourceNeeds.push({ resourceType: 'AV_EQUIPMENT', details: avNeeds.join(', ') })
        if (facilityNeeds && facilityNeeds.length > 0) resourceNeeds.push({ resourceType: 'FACILITY', details: facilityNeeds.join(', ') })
        if (requiresCustodial) resourceNeeds.push({ resourceType: 'CUSTODIAL' })

        const sub = (await createSubmission.mutateAsync({
          seasonId: planningSeasonId,
          data: {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            preferredDate: form.startsAt,
            duration: Math.max(15, duration || 60),
            expectedAttendance: form.expectedAttendance ? parseInt(form.expectedAttendance, 10) : undefined,
            isOutdoor: location.isOffCampus,
            resourceNeeds: resourceNeeds.length > 0 ? resourceNeeds : undefined,
          },
        })) as { id: string }
        // Auto-submit the draft
        await submitSubmission.mutateAsync({ seasonId: planningSeasonId, subId: sub.id })
        toast('Event submitted to year plan', 'success')
        handleClose()
      } else {
        const project = await createProject.mutateAsync(payload)
        toast('Event project created', 'success')
        handleClose()
        router.push(`/events/${project.id}`)
      }
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
          disabled={createProject.isPending || createSubmission.isPending}
          className="flex-1 max-w-xs py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {(createProject.isPending || createSubmission.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
          {isPlanning ? 'Submit to Year Plan' : `Create ${isMultiDay ? 'Multi-day ' : ''}Event`}
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
        {/* Event type badge */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-slate-100">
            <config.icon className="w-4 h-4 text-slate-500" />
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
            {config.badge}
          </span>
        </div>

        <StepperHeader currentStep={step} onStepClick={(s) => setStep(s)} />

        {/* ═══════════════════════ Step 1: Event Details ═══════════════════════ */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder={config.placeholder}
                autoFocus
                hasError={!!errors.title}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Description
              </label>
              <Textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                placeholder="Brief overview of this event..."
              />
            </div>

            {/* School — only shown when the org has more than one school. Single-school
                orgs skip this entirely; the event simply lives at the org level. */}
            {isMultiSchool && schools.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <SchoolIcon className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                  School
                </label>
                <Select
                  value={form.schoolId ?? ALL_SCHOOLS_VALUE}
                  onChange={(value) =>
                    update('schoolId', value === ALL_SCHOOLS_VALUE ? null : value)
                  }
                  options={[
                    { value: ALL_SCHOOLS_VALUE, label: 'All Schools (district-wide)' },
                    ...schools.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {form.schoolId
                    ? 'Visible only when this school is selected.'
                    : 'Visible from every school view.'}
                </p>
              </div>
            )}

            {/* ── When block (Cal.com-style) ── */}
            <DateTimeBlock
              form={form}
              update={update}
              errors={errors}
              isMultiDay={isMultiDay}
            />
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
              <Input
                type="number"
                min={1}
                value={form.expectedAttendance}
                onChange={(e) => update('expectedAttendance', e.target.value)}
                placeholder="e.g. 120"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════ Step 3: Team & People ══════════════════════════ */}
        {step === 3 && (() => {
          // Read options from the system form template (falls back to empty arrays)
          const avField = step3DynamicFields.find((f) => f.key === 'av_needs')
          const facilityField = step3DynamicFields.find((f) => f.key === 'facility_needs')
          const custodialField = step3DynamicFields.find((f) => f.key === 'requires_custodial')
          const securityField = step3DynamicFields.find((f) => f.key === 'requires_security')
          const customFields = step3DynamicFields.filter(
            (f) => !['av_needs', 'facility_needs', 'requires_custodial', 'requires_security'].includes(f.key)
          )

          const avOptions = avField?.options ?? []
          const facilityOptions = facilityField?.options ?? []
          const avNeeds = Array.isArray(dynamicValues.av_needs) ? dynamicValues.av_needs as string[] : []
          const facilityNeeds = Array.isArray(dynamicValues.facility_needs) ? dynamicValues.facility_needs as string[] : []
          const requiresCustodial = !!dynamicValues.requires_custodial
          const requiresSecurity = !!dynamicValues.requires_security

          return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* ── Loading skeleton ── */}
            {step3DynamicFields.length === 0 && !systemForm && (
              <div className="space-y-3">
                <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            )}

            {/* ── Requirements ── */}
            {(avField || facilityField) && (
            <div className="space-y-2.5">
              <p className="text-sm font-medium text-slate-700">Requirements</p>
              <p className="text-xs text-slate-500 -mt-1.5">Tell each team what you need — they&apos;ll review and approve before the event is confirmed.</p>

              {/* A/V Section */}
              {avField && (
              <div className={`rounded-xl border transition-colors ${avNeeds.length > 0 ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <div className={`p-1.5 rounded-lg transition-colors ${avNeeds.length > 0 ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <Monitor className={`w-4 h-4 transition-colors ${avNeeds.length > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{avField.label}</p>
                    <p className="text-xs text-slate-500">Projectors, mics, livestream, sound</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={avNeeds.length > 0}
                    onClick={() => setDynamicValues((prev) => ({ ...prev, av_needs: avNeeds.length > 0 ? [] : [avOptions[0] ?? ''] }))}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${avNeeds.length > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${avNeeds.length > 0 ? 'translate-x-4' : ''}`} />
                  </div>
                </label>

                {avNeeds.length > 0 && (
                  <div className="px-3.5 pb-3.5 space-y-3 border-t border-blue-100 pt-3">
                    <p className="text-xs font-medium text-slate-700">What do you need?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {avOptions.map((opt) => {
                        const selected = avNeeds.includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = selected ? avNeeds.filter((n) => n !== opt) : [...avNeeds, opt]
                              setDynamicValues((prev) => ({ ...prev, av_needs: next }))
                            }}
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
                  </div>
                )}
              </div>
              )}

              {/* Facilities Section */}
              {facilityField && (
              <div className={`rounded-xl border transition-colors ${facilityNeeds.length > 0 ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-3 px-3.5 py-3 cursor-pointer">
                  <div className={`p-1.5 rounded-lg transition-colors ${facilityNeeds.length > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
                    <Wrench className={`w-4 h-4 transition-colors ${facilityNeeds.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{facilityField.label}</p>
                    <p className="text-xs text-slate-500">Room setup, cleaning, staging, outdoor needs</p>
                  </div>
                  <div
                    role="switch"
                    aria-checked={facilityNeeds.length > 0}
                    onClick={() => setDynamicValues((prev) => ({ ...prev, facility_needs: facilityNeeds.length > 0 ? [] : [facilityOptions[0] ?? ''] }))}
                    className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${facilityNeeds.length > 0 ? 'bg-amber-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${facilityNeeds.length > 0 ? 'translate-x-4' : ''}`} />
                  </div>
                </label>

                {facilityNeeds.length > 0 && (
                  <div className="px-3.5 pb-3.5 space-y-3 border-t border-amber-100 pt-3">
                    <p className="text-xs font-medium text-slate-700">What do you need?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {facilityOptions.map((opt) => {
                        const selected = facilityNeeds.includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const next = selected ? facilityNeeds.filter((n) => n !== opt) : [...facilityNeeds, opt]
                              setDynamicValues((prev) => ({ ...prev, facility_needs: next }))
                            }}
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
                  </div>
                )}
              </div>
              )}
            </div>
            )}

            {/* ── Compact toggle row: Custodial + Security ── */}
            {(custodialField || securityField) && (
            <div className="grid grid-cols-2 gap-2">
              {custodialField && (
              <div className={`rounded-xl border transition-colors ${requiresCustodial ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                  <div className={`p-1 rounded-lg transition-colors ${requiresCustodial ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Sparkles className={`w-3.5 h-3.5 transition-colors ${requiresCustodial ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-900 flex-1">{custodialField.label}</p>
                  <div
                    role="switch"
                    aria-checked={requiresCustodial}
                    onClick={() => setDynamicValues((prev) => ({ ...prev, requires_custodial: !requiresCustodial }))}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${requiresCustodial ? 'bg-emerald-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requiresCustodial ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>
              )}
              {securityField && (
              <div className={`rounded-xl border transition-colors ${requiresSecurity ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                  <div className={`p-1 rounded-lg transition-colors ${requiresSecurity ? 'bg-red-100' : 'bg-slate-100'}`}>
                    <ShieldAlert className={`w-3.5 h-3.5 transition-colors ${requiresSecurity ? 'text-red-600' : 'text-slate-400'}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-900 flex-1">{securityField.label}</p>
                  <div
                    role="switch"
                    aria-checked={requiresSecurity}
                    onClick={() => setDynamicValues((prev) => ({ ...prev, requires_security: !requiresSecurity }))}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${requiresSecurity ? 'bg-red-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${requiresSecurity ? 'translate-x-4' : ''}`} />
                  </div>
                </label>
              </div>
              )}
            </div>
            )}

            {/* ── Custom fields added by admin (rendered generically) ── */}
            {customFields.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <FormFieldRenderer
                      field={{
                        key: field.key,
                        label: field.label,
                        type: field.type as FormFieldData['type'],
                        required: field.required,
                        placeholder: field.placeholder,
                        helpText: field.helpText,
                        options: field.options,
                      }}
                      value={dynamicValues[field.key]}
                      onChange={(v) => setDynamicValues((prev) => ({ ...prev, [field.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ── Request Specific People (always present, not from form template) ── */}
            <div className={`rounded-xl border transition-colors ${requestedAttendees.length > 0 || showPeoplePicker ? 'border-stone-300 bg-stone-50/50' : 'border-slate-200'}`}>
              <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer">
                <div className={`p-1 rounded-lg transition-colors ${showPeoplePicker ? 'bg-stone-200' : 'bg-slate-100'}`}>
                  <Users className={`w-3.5 h-3.5 transition-colors ${showPeoplePicker ? 'text-stone-700' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Request Specific People</p>
                  <p className="text-[11px] text-slate-500">Notify specific staff after approval</p>
                </div>
                <div
                  role="switch"
                  aria-checked={showPeoplePicker}
                  onClick={() => setShowPeoplePicker((p) => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${showPeoplePicker ? 'bg-slate-900' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showPeoplePicker ? 'translate-x-4' : ''}`} />
                </div>
              </label>

              {showPeoplePicker && (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-stone-200 pt-3">
                  <PeoplePicker
                    selectedUserIds={requestedAttendees}
                    onChange={setRequestedAttendees}
                    hideHeader
                  />
                  <Textarea
                    value={peopleNote}
                    onChange={(e) => setPeopleNote(e.target.value)}
                    rows={2}
                    placeholder="Note for requested people — role, instructions, etc."
                  />
                </div>
              )}
            </div>
          </div>
          )
        })()}
      </div>
    </DetailDrawer>
  )
}
