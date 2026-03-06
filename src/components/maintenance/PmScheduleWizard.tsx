'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ClipboardList,
  RepeatIcon,
  CheckSquare,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  AlertCircle,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useCampusLocations } from '@/lib/hooks/useCampusLocations'
import { PM_RECURRENCE_TYPES, PM_RECURRENCE_LABELS } from '@/lib/types/pm-schedule'
import type { CampusLocationOption } from '@/lib/hooks/useCampusLocations'
import { FloatingDropdown } from '@/components/ui/FloatingInput'

// ─── Types ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Name', icon: ClipboardList },
  { label: 'Recurrence', icon: RepeatIcon },
  { label: 'Checklist', icon: CheckSquare },
  { label: 'Asset/Location', icon: MapPin },
  { label: 'Technician', icon: User },
]

const MONTHS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
]

interface WizardFormData {
  // Step 1
  name: string
  description: string
  // Step 2
  recurrenceType: string
  intervalDays: string
  months: number[]
  advanceNoticeDays: string
  avoidSchoolYear: boolean
  // Step 3
  checklistItems: string[]
  // Step 4
  assetId: string | null
  assetName: string
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  locationLabel: string
  schoolId: string | null
  // Step 5
  defaultTechnicianId: string | null
  technicianName: string
}

interface PmScheduleWizardProps {
  onComplete?: () => void
  onCancel?: () => void
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

const EASE = [0.25, 0.1, 0.25, 1] as [number, number, number, number]

const stepVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: EASE },
  },
  exit: (direction: 'forward' | 'backward') => ({
    x: direction === 'forward' ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.2, ease: EASE },
  }),
}

// ─── Wizard Component ─────────────────────────────────────────────────────────

export default function PmScheduleWizard({ onComplete, onCancel }: PmScheduleWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')

  const [formData, setFormData] = useState<WizardFormData>({
    name: '',
    description: '',
    recurrenceType: 'MONTHLY',
    intervalDays: '30',
    months: [],
    advanceNoticeDays: '7',
    avoidSchoolYear: false,
    checklistItems: [],
    assetId: null,
    assetName: '',
    buildingId: null,
    areaId: null,
    roomId: null,
    locationLabel: '',
    schoolId: null,
    defaultTechnicianId: null,
    technicianName: '',
  })

  const update = (patch: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  // ─── Data Fetches

  const { data: campusLocations = [] } = useCampusLocations()

  const { data: assetsData } = useQuery({
    queryKey: ['maintenance-assets-search'],
    queryFn: async () => {
      const res = await fetch('/api/maintenance/assets?limit=200', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return { assets: [] }
      const json = await res.json()
      return json.data || { assets: [] }
    },
    staleTime: 60_000,
  })

  const { data: techniciansData } = useQuery({
    queryKey: ['maintenance-technicians'],
    queryFn: async () => {
      const res = await fetch('/api/settings/users', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return { users: [] }
      const json = await res.json()
      return json.data || { users: [] }
    },
    staleTime: 300_000,
  })

  const assets = assetsData?.assets || []
  const technicians = techniciansData?.users || []

  // ─── Step Validation

  const stepValid = [
    !!formData.name.trim(), // Step 0: name required
    !!formData.recurrenceType, // Step 1: recurrence type required
    true, // Step 2: checklist optional
    true, // Step 3: asset/location optional
    true, // Step 4: technician optional
  ]

  const canAdvance = stepValid[currentStep]

  const goNext = () => {
    if (!canAdvance) return
    setDirection('forward')
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setDirection('backward')
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  // ─── Checklist management

  const addChecklistItem = () => {
    const item = newChecklistItem.trim()
    if (!item) return
    update({ checklistItems: [...formData.checklistItems, item] })
    setNewChecklistItem('')
  }

  const removeChecklistItem = (idx: number) => {
    update({ checklistItems: formData.checklistItems.filter((_, i) => i !== idx) })
  }

  const moveChecklistItem = (idx: number, direction: 'up' | 'down') => {
    const items = [...formData.checklistItems]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length) return
    ;[items[idx], items[targetIdx]] = [items[targetIdx], items[idx]]
    update({ checklistItems: items })
  }

  const toggleMonth = (month: number) => {
    const months = formData.months.includes(month)
      ? formData.months.filter((m) => m !== month)
      : [...formData.months, month]
    update({ months })
  }

  const handleLocationSelect = (opt: CampusLocationOption) => {
    update({
      buildingId: opt.buildingId,
      areaId: opt.areaId,
      roomId: opt.roomId,
      locationLabel: opt.hierarchy ? opt.hierarchy.join(' › ') : opt.label,
    })
  }

  // ─── Submit

  const handleSubmit = async () => {
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const body = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        recurrenceType: formData.recurrenceType,
        intervalDays: formData.recurrenceType === 'CUSTOM' ? parseInt(formData.intervalDays, 10) : undefined,
        months: formData.months,
        advanceNoticeDays: parseInt(formData.advanceNoticeDays, 10) || 7,
        checklistItems: formData.checklistItems,
        assetId: formData.assetId || undefined,
        buildingId: formData.buildingId || undefined,
        areaId: formData.areaId || undefined,
        roomId: formData.roomId || undefined,
        schoolId: formData.schoolId || undefined,
        defaultTechnicianId: formData.defaultTechnicianId || undefined,
        avoidSchoolYear: formData.avoidSchoolYear,
      }

      const res = await fetch('/api/maintenance/pm-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to create PM schedule')
      }

      if (onComplete) {
        onComplete()
      } else {
        router.push('/maintenance/pm-calendar')
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Recurrence label

  const getRecurrenceLabel = (type: string) => {
    return PM_RECURRENCE_LABELS[type as keyof typeof PM_RECURRENCE_LABELS] || type
  }

  // ─── Render steps

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Schedule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. HVAC Filter Replacement"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Optional — describe what this PM task involves"
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors"
              />
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-4">
            <FloatingDropdown
              label="Recurrence Type"
              value={formData.recurrenceType}
              onChange={(v) => update({ recurrenceType: v })}
              options={PM_RECURRENCE_TYPES.map((type) => ({
                value: type,
                label: PM_RECURRENCE_LABELS[type],
              }))}
              required
            />

            {formData.recurrenceType === 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Interval (days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.intervalDays}
                  onChange={(e) => update({ intervalDays: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors"
                />
              </div>
            )}

            {formData.recurrenceType === 'MONTHLY' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specific Months (optional — leave blank for every month)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {MONTHS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => toggleMonth(m.value)}
                      className={`py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        formData.months.includes(m.value)
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Advance Notice (days)
              </label>
              <input
                type="number"
                min="0"
                value={formData.advanceNoticeDays}
                onChange={(e) => update({ advanceNoticeDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                How many days before the due date to show this task as upcoming
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.avoidSchoolYear}
                onChange={(e) => update({ avoidSchoolYear: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900 focus-visible:ring-gray-400"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Avoid School Year</span>
                <p className="text-xs text-gray-500">
                  Skip scheduling during active school periods{' '}
                  <span className="text-amber-600">(enforcement coming soon)</span>
                </p>
              </div>
            </label>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add checklist items that technicians must complete for this PM task. Optional.
            </p>

            {/* Add item input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addChecklistItem()
                  }
                }}
                placeholder="e.g. Replace air filter, Check belt tension"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                disabled={!newChecklistItem.trim()}
                className="ui-btn-sm ui-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>

            {/* Checklist items */}
            {formData.checklistItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">
                No checklist items yet. Add items above.
              </div>
            ) : (
              <ul className="space-y-2">
                {formData.checklistItems.map((item, idx) => (
                  <motion.li
                    key={`${item}-${idx}`}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <CheckSquare className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">{item}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveChecklistItem(idx, 'down')}
                        disabled={idx === formData.checklistItems.length - 1}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(idx)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              Optionally link this PM schedule to a specific asset or location.
            </p>

            {/* Asset link */}
            <FloatingDropdown
              label="Link to Asset"
              value={formData.assetId || ''}
              onChange={(v) => {
                const selected = assets.find((a: { id: string; name: string; assetNumber: string }) => a.id === v)
                update({
                  assetId: v || null,
                  assetName: selected ? `${selected.assetNumber} — ${selected.name}` : '',
                })
              }}
              options={[
                { value: '', label: 'No asset' },
                ...assets.map((a: { id: string; assetNumber: string; name: string }) => ({
                  value: a.id,
                  label: `${a.assetNumber} — ${a.name}`,
                })),
              ]}
            />

            {/* Location link */}
            <FloatingDropdown
              label="Link to Location"
              value={
                formData.roomId
                  ? `room-${formData.roomId}`
                  : formData.areaId
                  ? `area-${formData.areaId}`
                  : formData.buildingId
                  ? `building-${formData.buildingId}`
                  : ''
              }
              onChange={(v) => {
                if (!v) {
                  update({ buildingId: null, areaId: null, roomId: null, locationLabel: '' })
                  return
                }
                const dashIdx = v.indexOf('-')
                const typePrefix = v.slice(0, dashIdx)
                const locationId = v.slice(dashIdx + 1)
                const opt = campusLocations.find((loc) => {
                  if (typePrefix === 'room') return loc.roomId === locationId
                  if (typePrefix === 'area') return loc.areaId === locationId && !loc.roomId
                  if (typePrefix === 'building') return loc.buildingId === locationId && !loc.areaId && !loc.roomId
                  return false
                })
                if (opt) handleLocationSelect(opt)
              }}
              options={[
                { value: '', label: 'No location' },
                ...campusLocations.map((loc, idx) => {
                  const key = loc.roomId
                    ? `room-${loc.roomId}`
                    : loc.areaId
                    ? `area-${loc.areaId}`
                    : `building-${loc.buildingId}`
                  return {
                    value: key,
                    label: loc.hierarchy ? loc.hierarchy.join(' › ') : loc.label,
                  }
                }),
              ]}
            />
          </div>
        )

      case 4:
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <FloatingDropdown
                label="Default Technician"
                value={formData.defaultTechnicianId || ''}
                onChange={(v) => {
                  const selected = technicians.find((t: { id: string; name: string }) => t.id === v)
                  update({
                    defaultTechnicianId: v || null,
                    technicianName: selected?.name || '',
                  })
                }}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...technicians.map((t: { id: string; name: string; email?: string }) => ({
                    value: t.id,
                    label: `${t.name}${t.email ? ` (${t.email})` : ''}`,
                  })),
                ]}
              />
              <p className="text-xs text-gray-500">
                This technician will be assigned when PM tickets are generated
              </p>
            </div>

            {/* Review summary */}
            <div className="ui-glass p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">Review</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500">Name</span>
                <span className="text-gray-800 font-medium truncate">{formData.name}</span>
                <span className="text-gray-500">Recurrence</span>
                <span className="text-gray-800">{getRecurrenceLabel(formData.recurrenceType)}</span>
                {formData.recurrenceType === 'CUSTOM' && (
                  <>
                    <span className="text-gray-500">Interval</span>
                    <span className="text-gray-800">{formData.intervalDays} days</span>
                  </>
                )}
                {formData.recurrenceType === 'MONTHLY' && formData.months.length > 0 && (
                  <>
                    <span className="text-gray-500">Months</span>
                    <span className="text-gray-800">
                      {formData.months
                        .sort((a, b) => a - b)
                        .map((m) => MONTHS.find((mo) => mo.value === m)?.label)
                        .join(', ')}
                    </span>
                  </>
                )}
                <span className="text-gray-500">Checklist Items</span>
                <span className="text-gray-800">{formData.checklistItems.length} items</span>
                {formData.assetName && (
                  <>
                    <span className="text-gray-500">Asset</span>
                    <span className="text-gray-800 truncate">{formData.assetName}</span>
                  </>
                )}
                {formData.locationLabel && (
                  <>
                    <span className="text-gray-500">Location</span>
                    <span className="text-gray-800 truncate">{formData.locationLabel}</span>
                  </>
                )}
                {formData.technicianName && (
                  <>
                    <span className="text-gray-500">Technician</span>
                    <span className="text-gray-800">{formData.technicianName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  // ─── Render

  return (
    <div className="ui-glass p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, idx) => {
          const Icon = step.icon
          const isCompleted = idx < currentStep
          const isActive = idx === currentStep
          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-gray-900 text-white'
                      : isActive
                      ? 'bg-primary-100 text-primary-700 border-2 border-gray-900'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-gray-700' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 mx-2 mb-5 transition-colors ${
                    idx < currentStep ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                  style={{ minWidth: '20px' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step title */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">
          Step {currentStep + 1}: {STEPS[currentStep].label}
        </h3>
      </div>

      {/* Step content with animation */}
      <div className="overflow-hidden" style={{ minHeight: 200 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error message */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
        </div>

        {currentStep < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="ui-btn-md ui-btn-primary"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="ui-btn-md ui-btn-primary"
          >
            {isSubmitting ? 'Creating...' : 'Create Schedule'}
            {!isSubmitting && <Check className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  )
}
