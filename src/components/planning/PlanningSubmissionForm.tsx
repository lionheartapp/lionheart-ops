'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

interface PlanningSubmissionFormProps {
  seasonId: string
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
  isSubmitting?: boolean
}

interface DraftFormState {
  title: string
  description: string
  preferredDate: string
  alternateDate1: string
  alternateDate2: string
  duration: number
  isOutdoor: boolean
  expectedAttendance: string
  targetAudience: string
  priority: string
  estimatedBudget: string
  resourceNeeds: Array<{ resourceType: string; details: string }>
}

function getDraftKey(seasonId: string): string {
  return `planning-draft-${seasonId}`
}

function loadDraft(seasonId: string): DraftFormState | null {
  try {
    const raw = localStorage.getItem(getDraftKey(seasonId))
    if (!raw) return null
    return JSON.parse(raw) as DraftFormState
  } catch {
    return null
  }
}

function clearDraft(seasonId: string): void {
  localStorage.removeItem(getDraftKey(seasonId))
}

const RESOURCE_TYPES = [
  { value: 'FACILITY', label: 'Facility Setup' },
  { value: 'AV_EQUIPMENT', label: 'A/V Equipment' },
  { value: 'CUSTODIAL', label: 'Custodial' },
  { value: 'VIP_ATTENDANCE', label: 'VIP Attendance' },
]

export default function PlanningSubmissionForm({ seasonId, onSubmit, onCancel, isSubmitting }: PlanningSubmissionFormProps) {
  const draft = loadDraft(seasonId)

  const [title, setTitle] = useState(draft?.title ?? '')
  const [description, setDescription] = useState(draft?.description ?? '')
  const [preferredDate, setPreferredDate] = useState(draft?.preferredDate ?? '')
  const [alternateDate1, setAlternateDate1] = useState(draft?.alternateDate1 ?? '')
  const [alternateDate2, setAlternateDate2] = useState(draft?.alternateDate2 ?? '')
  const [duration, setDuration] = useState(draft?.duration ?? 60)
  const [isOutdoor, setIsOutdoor] = useState(draft?.isOutdoor ?? false)
  const [expectedAttendance, setExpectedAttendance] = useState(draft?.expectedAttendance ?? '')
  const [targetAudience, setTargetAudience] = useState(draft?.targetAudience ?? '')
  const [priority, setPriority] = useState(draft?.priority ?? 'IMPORTANT')
  const [estimatedBudget, setEstimatedBudget] = useState(draft?.estimatedBudget ?? '')
  const [resourceNeeds, setResourceNeeds] = useState<Array<{ resourceType: string; details: string }>>(draft?.resourceNeeds ?? [])
  const [draftRestored, setDraftRestored] = useState(draft !== null)

  // Debounced auto-save to localStorage every 2 seconds
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveDraft = useCallback(() => {
    const state: DraftFormState = {
      title, description, preferredDate, alternateDate1, alternateDate2,
      duration, isOutdoor, expectedAttendance, targetAudience, priority,
      estimatedBudget, resourceNeeds,
    }
    localStorage.setItem(getDraftKey(seasonId), JSON.stringify(state))
  }, [title, description, preferredDate, alternateDate1, alternateDate2, duration, isOutdoor, expectedAttendance, targetAudience, priority, estimatedBudget, resourceNeeds, seasonId])

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveDraft, 2000)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [saveDraft])

  const addResource = (type: string) => {
    if (!resourceNeeds.find((r) => r.resourceType === type)) {
      setResourceNeeds((prev) => [...prev, { resourceType: type, details: '' }])
    }
  }

  const removeResource = (type: string) => {
    setResourceNeeds((prev) => prev.filter((r) => r.resourceType !== type))
  }

  const updateResourceDetails = (type: string, details: string) => {
    setResourceNeeds((prev) => prev.map((r) => (r.resourceType === type ? { ...r, details } : r)))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    clearDraft(seasonId)
    setDraftRestored(false)
    onSubmit({
      title,
      description: description || undefined,
      preferredDate,
      alternateDate1: alternateDate1 || undefined,
      alternateDate2: alternateDate2 || undefined,
      duration,
      isOutdoor,
      expectedAttendance: expectedAttendance ? parseInt(expectedAttendance) : undefined,
      targetAudience: targetAudience || undefined,
      priority,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
      resourceNeeds: resourceNeeds.length > 0 ? resourceNeeds : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {draftRestored && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700">Draft restored from your previous session</p>
          <button
            type="button"
            onClick={() => {
              clearDraft(seasonId)
              setDraftRestored(false)
              setTitle(''); setDescription(''); setPreferredDate('')
              setAlternateDate1(''); setAlternateDate2('')
              setDuration(60); setIsOutdoor(false); setExpectedAttendance('')
              setTargetAudience(''); setPriority('IMPORTANT')
              setEstimatedBudget(''); setResourceNeeds([])
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            Discard Draft
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
        <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Spring Concert" />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the event..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Date</label>
          <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Alternate Date 1</label>
          <Input type="date" value={alternateDate1} onChange={(e) => setAlternateDate1(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Alternate Date 2</label>
          <Input type="date" value={alternateDate2} onChange={(e) => setAlternateDate2(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
          <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 60)} min={15} max={1440} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Expected Attendance</label>
          <Input type="number" value={expectedAttendance} onChange={(e) => setExpectedAttendance(e.target.value)} placeholder="100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Budget ($)</label>
          <Input type="number" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} step="0.01" placeholder="500.00" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target Audience</label>
          <Input type="text" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Students, Parents" />
        </div>
        <div>
          <FloatingDropdown
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'MUST_HAVE', label: 'Must Have' },
              { value: 'IMPORTANT', label: 'Important' },
              { value: 'NICE_TO_HAVE', label: 'Nice to Have' },
            ]}
          />
        </div>
        <div className="flex items-end">
          <Checkbox checked={isOutdoor} onChange={(e) => setIsOutdoor(e.target.checked)} label="Outdoor event" className="pb-2" />
        </div>
      </div>

      {/* Resource Needs */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Resource Needs</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {RESOURCE_TYPES.map((rt) => {
            const isSelected = resourceNeeds.some((r) => r.resourceType === rt.value)
            return (
              <button
                key={rt.value}
                type="button"
                onClick={() => isSelected ? removeResource(rt.value) : addResource(rt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                  isSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}{rt.label}
              </button>
            )
          })}
        </div>
        {resourceNeeds.map((r) => (
          <div key={r.resourceType} className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-600 w-24">{RESOURCE_TYPES.find((t) => t.value === r.resourceType)?.label}</span>
            <Input
              type="text"
              value={r.details}
              onChange={(e) => updateResourceDetails(r.resourceType, e.target.value)}
              placeholder="Details..."
              className="flex-1"
              size="sm"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={isSubmitting || !title || !preferredDate} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 transition">
          {isSubmitting ? 'Saving...' : 'Save Draft'}
        </button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm text-slate-600 hover:text-slate-900 transition">Cancel</button>
      </div>
    </form>
  )
}
