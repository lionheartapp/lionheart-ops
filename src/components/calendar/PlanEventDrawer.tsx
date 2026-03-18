'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingTextarea } from '@/components/ui/FloatingInput'
import {
  Calendar, Video, Building2, CheckCircle,
  Loader2, ArrowLeft, ChevronRight, Zap, Check,
} from 'lucide-react'
import AttendeePicker, { type AttendeeSelection } from '@/components/calendar/AttendeePicker'

// ─── helpers ────────────────────────────────────────────────────────────────

const toLocalDatetime = (d: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const defaultStart = (): Date => {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

const defaultEnd = (start: Date): Date => new Date(start.getTime() + 60 * 60 * 1000)

// ─── types ───────────────────────────────────────────────────────────────────

interface StepperForm {
  title: string
  description: string
  room: string
  startsAt: string
  endsAt: string
  attendees: AttendeeSelection[]
  requiresAV: boolean
  avRequirements: string
  requiresFacilitySetup: boolean
  facilityNotes: string
  setupNeeds: string[]
}

const emptyForm = (start?: Date, end?: Date): StepperForm => {
  const s = start ?? defaultStart()
  const e = end ?? defaultEnd(s)
  return {
    title: '', description: '', room: '',
    startsAt: toLocalDatetime(s),
    endsAt: toLocalDatetime(e),
    attendees: [],
    requiresAV: false, avRequirements: '',
    requiresFacilitySetup: false, facilityNotes: '', setupNeeds: [],
  }
}

// ─── props ───────────────────────────────────────────────────────────────────

export interface PlanEventDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  /** Pre-fill start time from a calendar slot click */
  initialStart?: Date
  /** Pre-fill end time from a calendar slot click */
  initialEnd?: Date
}

const SETUP_OPTIONS = [
  'Extra seating / chairs',
  'Stage or podium setup',
  'Table arrangement',
  'Cleaning before event',
  'Outdoor setup required',
]

const STEP_LABELS = ['Details', 'A/V Needs', 'Facility', 'Review']
const STEP_ICONS = [Calendar, Video, Building2, CheckCircle]

// ─── component ───────────────────────────────────────────────────────────────

export default function PlanEventDrawer({
  isOpen,
  onClose,
  onSuccess,
  initialStart,
  initialEnd,
}: PlanEventDrawerProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<StepperForm>(() => emptyForm(initialStart, initialEnd))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset form when drawer opens
  const handleOpen = useCallback(() => {
    setStep(1)
    setError('')
    setForm(emptyForm(initialStart, initialEnd))
  }, [initialStart, initialEnd])

  // Re-initialise whenever isOpen flips to true
  const [prevOpen, setPrevOpen] = useState(false)
  if (isOpen && !prevOpen) {
    handleOpen()
    setPrevOpen(true)
  }
  if (!isOpen && prevOpen) {
    setPrevOpen(false)
  }

  const toggleSetupNeed = (need: string) => {
    setForm(f => ({
      ...f,
      setupNeeds: f.setupNeeds.includes(need)
        ? f.setupNeeds.filter(n => n !== need)
        : [...f.setupNeeds, need],
    }))
  }

  const canAdvance = () => {
    if (step === 1) return form.title.trim().length > 0 && !!form.startsAt && !!form.endsAt
    return true
  }

  const handleSubmit = useCallback(async () => {
    if (!form.title.trim() || !form.startsAt || !form.endsAt) {
      setError('Title, start time, and end time are required.')
      return
    }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError('End time must be after start time.')
      return
    }
    setSaving(true)
    setError('')

    let fullDescription = form.description.trim()
    const facilityParts: string[] = []
    if (form.requiresFacilitySetup) {
      if (form.setupNeeds.length > 0) facilityParts.push(`Setup needed: ${form.setupNeeds.join(', ')}`)
      if (form.facilityNotes.trim()) facilityParts.push(`Notes: ${form.facilityNotes.trim()}`)
    }
    if (facilityParts.length > 0) {
      fullDescription = fullDescription
        ? `${fullDescription}\n\n[Facility] ${facilityParts.join('. ')}`
        : `[Facility] ${facilityParts.join('. ')}`
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: fullDescription || null,
          room: form.room.trim() || null,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          requiresAV: form.requiresAV,
          avRequirements: form.avRequirements.trim() || null,
          attendeeIds: form.attendees.map(a => a.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        onClose()
        onSuccess?.()
        return
      }
      setError(data.error?.message || 'Failed to create event.')
    } catch {
      setError('Failed to create event. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, onClose, onSuccess])

  // ── Approval chain ─────────────────────────────────────────────────────────
  const approvalChain: {
    label: string; color: string; bgColor: string; borderColor: string
    icon: ReactNode; always: boolean
  }[] = [
    { label: 'Events Coordinator', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: <Calendar className="w-4 h-4 text-blue-500" />, always: true },
    ...(form.requiresAV ? [{ label: 'A/V Production Team', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', icon: <Video className="w-4 h-4 text-purple-500" />, always: false }] : []),
    ...(form.requiresFacilitySetup ? [{ label: 'Facilities Team', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: <Building2 className="w-4 h-4 text-amber-500" />, always: false }] : []),
  ]

  const drawerTitle = `Plan Event${step < 4 ? ` — Step ${step} of 3` : ' — Review'}`

  const footer = (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      <div className="flex items-center gap-3">
        {step > 1 ? (
          <button
            onClick={() => { setStep(s => s - 1); setError('') }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Cancel
          </button>
        )}
        {step === 4 ? (
          <button
            onClick={handleSubmit}
            disabled={saving || !canAdvance()}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit for Approval
          </button>
        ) : (
          <button
            onClick={() => {
              if (canAdvance()) { setStep(s => s + 1); setError('') }
              else { setError('Please fill in the required fields.') }
            }}
            disabled={!canAdvance()}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 flex items-center justify-center gap-1.5"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title={drawerTitle} width="lg" footer={footer}>
      <div className="space-y-6">
        {/* Step Progress Indicator */}
        <div className="flex items-center gap-0">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1
            const isComplete = step > stepNum
            const isCurrent = step === stepNum
            const StepIcon = STEP_ICONS[i]
            return (
              <div key={label} className={`flex items-center ${i < STEP_LABELS.length - 1 ? 'flex-1' : ''}`}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete ? 'bg-green-500 shadow-sm' : isCurrent ? 'bg-slate-900 shadow-md ring-4 ring-slate-900/10' : 'bg-slate-100'}`}>
                    {isComplete ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? 'text-slate-900' : isComplete ? 'text-green-600' : 'text-slate-400'}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors duration-300 ${step > stepNum ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Step 1: Event Details ── */}
        {step === 1 && (
          <AnimatePresence mode="wait">
            <motion.div key="step-1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              <FloatingInput id="stepper-title" label="Event Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              <FloatingInput id="stepper-room" label="Room / Location" placeholder="e.g. Main Auditorium, Gym, Room 204" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="stepper-starts" className="block text-xs font-medium text-slate-600 mb-1">Start Time <span className="text-red-500">*</span></label>
                  <input id="stepper-starts" type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900" />
                </div>
                <div>
                  <label htmlFor="stepper-ends" className="block text-xs font-medium text-slate-600 mb-1">End Time <span className="text-red-500">*</span></label>
                  <input id="stepper-ends" type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent text-slate-900" />
                </div>
              </div>
              <FloatingTextarea id="stepper-description" label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              <AttendeePicker value={form.attendees} onChange={attendees => setForm(f => ({ ...f, attendees }))} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Step 2: A/V Needs ── */}
        {step === 2 && (
          <AnimatePresence mode="wait">
            <motion.div key="step-2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 flex items-start gap-2.5">
                <Video className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-purple-800">Does this event need audio/visual support from the A/V Production team?</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition">
                <div className="relative flex-shrink-0">
                  <input type="checkbox" checked={form.requiresAV} onChange={e => setForm(f => ({ ...f, requiresAV: e.target.checked, avRequirements: e.target.checked ? f.avRequirements : '' }))} className="sr-only peer" id="stepper-requires-av" />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-purple-600 transition-colors" />
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">This event requires A/V support</p>
                  <p className="text-xs text-slate-500">Projectors, microphones, livestream, recording, etc.</p>
                </div>
              </label>
              {form.requiresAV && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <label htmlFor="stepper-av-req" className="block text-sm font-medium text-slate-700">Describe your A/V needs</label>
                  <textarea id="stepper-av-req" value={form.avRequirements} onChange={e => setForm(f => ({ ...f, avRequirements: e.target.value }))} placeholder="e.g. 1 projector, 2 wireless mics, livestream to YouTube, recording equipment…" rows={4} className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900" />
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-purple-400" />
                    AI will automatically parse your description into a structured equipment list.
                  </p>
                </motion.div>
              )}
              {!form.requiresAV && <p className="text-sm text-slate-400 text-center py-4">No A/V support needed — you can skip this step.</p>}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Step 3: Facility Needs ── */}
        {step === 3 && (
          <AnimatePresence mode="wait">
            <motion.div key="step-3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">Does this event require any physical setup or facility support from the Maintenance team?</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition">
                <div className="relative flex-shrink-0">
                  <input type="checkbox" checked={form.requiresFacilitySetup} onChange={e => setForm(f => ({ ...f, requiresFacilitySetup: e.target.checked, setupNeeds: e.target.checked ? f.setupNeeds : [], facilityNotes: e.target.checked ? f.facilityNotes : '' }))} className="sr-only peer" id="stepper-requires-facility" />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-amber-500 transition-colors" />
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">This event needs facility setup</p>
                  <p className="text-xs text-slate-500">Seating, staging, cleaning, room arrangement, etc.</p>
                </div>
              </label>
              {form.requiresFacilitySetup && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">What setup is needed? <span className="text-slate-400 font-normal">(select all that apply)</span></p>
                  <div className="grid grid-cols-2 gap-2">
                    {SETUP_OPTIONS.map(opt => (
                      <label key={opt} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-sm font-medium select-none ${form.setupNeeds.includes(opt) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={form.setupNeeds.includes(opt)} onChange={() => toggleSetupNeed(opt)} className="sr-only" />
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition ${form.setupNeeds.includes(opt) ? 'bg-amber-500' : 'border border-slate-300 bg-white'}`}>
                          {form.setupNeeds.includes(opt) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        {opt}
                      </label>
                    ))}
                  </div>
                  <FloatingTextarea id="stepper-facility-notes" label="Additional facility notes" value={form.facilityNotes} onChange={e => setForm(f => ({ ...f, facilityNotes: e.target.value }))} rows={2} />
                </motion.div>
              )}
              {!form.requiresFacilitySetup && <p className="text-sm text-slate-400 text-center py-4">No facility setup needed — you can skip this step.</p>}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Step 4: Review & Approval ── */}
        {step === 4 && (
          <AnimatePresence mode="wait">
            <motion.div key="step-4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Event Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Title</span>
                    <span className="font-medium text-slate-900 max-w-[60%] text-right">{form.title || '—'}</span>
                  </div>
                  {form.room && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location</span>
                      <span className="font-medium text-slate-900">{form.room}</span>
                    </div>
                  )}
                  {form.startsAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Date & Time</span>
                      <span className="font-medium text-slate-900">
                        {new Date(form.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                        {new Date(form.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {form.endsAt ? ` – ${new Date(form.endsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                      </span>
                    </div>
                  )}
                  {form.attendees.length > 0 && (
                    <div className="flex justify-between items-start">
                      <span className="text-slate-500">Attendees</span>
                      <span className="font-medium text-slate-900 text-right max-w-[60%]">
                        {form.attendees.map(a => a.firstName || a.email.split('@')[0]).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">A/V Support</span>
                    <span className={`font-medium ${form.requiresAV ? 'text-purple-700' : 'text-slate-400'}`}>{form.requiresAV ? 'Required' : 'Not needed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Facility Setup</span>
                    <span className={`font-medium ${form.requiresFacilitySetup ? 'text-amber-700' : 'text-slate-400'}`}>{form.requiresFacilitySetup ? 'Required' : 'Not needed'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-slate-600" />
                  Approval Required Before Publishing
                </h3>
                <p className="text-xs text-slate-500 mb-3">Your event will go through the following review before it appears on the main calendar:</p>
                <div className="space-y-2">
                  {approvalChain.map((approver, i) => (
                    <div key={approver.label} className={`flex items-center gap-3 p-3 rounded-xl border ${approver.bgColor} ${approver.borderColor}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${approver.bgColor} border ${approver.borderColor} flex-shrink-0`}>
                        {approver.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${approver.color}`}>{approver.label}</p>
                        {approver.always && <p className="text-xs text-slate-500">Always required for all events</p>}
                        {!approver.always && approver.label.includes('A/V') && <p className="text-xs text-slate-500">Required because A/V support was requested</p>}
                        {!approver.always && approver.label.includes('Facilities') && <p className="text-xs text-slate-500">Required because facility setup was requested</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {i < approvalChain.length - 1 ? (
                          <span className="text-xs text-slate-400 font-medium">Step {i + 1}</span>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold">→ Published</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3" />
                  Approval usually takes 1–2 business days.
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </DetailDrawer>
  )
}
