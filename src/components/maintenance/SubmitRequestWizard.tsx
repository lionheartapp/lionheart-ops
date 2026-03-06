'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, MapPin, Camera, ClipboardList, ClipboardCheck, Check, ExternalLink } from 'lucide-react'
import StepLocation from './SubmitRequestWizard/StepLocation'
import StepPhotos, { type UploadedPhoto } from './SubmitRequestWizard/StepPhotos'
import StepDetails from './SubmitRequestWizard/StepDetails'
import StepReview from './SubmitRequestWizard/StepReview'
import type { CampusLocationOption } from '@/lib/hooks/useCampusLocations'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 0 | 1 | 2 | 3

interface WizardFormData {
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  locationLabel: string
  photos: UploadedPhoto[]
  title: string
  description: string
  category: string
  priority: string
  availabilityNote: string
  scheduledDate: string
  aiSuggestedCategory: string | null
}

interface SuccessData {
  ticketNumber: string
  ticketId: string
}

interface SubmitRequestWizardProps {
  onComplete: () => void
  onCancel: () => void
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Location', icon: MapPin },
  { label: 'Photos', icon: Camera },
  { label: 'Details', icon: ClipboardList },
  { label: 'Review', icon: ClipboardCheck },
]

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

// ─── Wizard Component ─────────────────────────────────────────────────────────

export default function SubmitRequestWizard({ onComplete, onCancel }: SubmitRequestWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [success, setSuccess] = useState<SuccessData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [formData, setFormData] = useState<WizardFormData>({
    buildingId: null,
    areaId: null,
    roomId: null,
    locationLabel: '',
    photos: [],
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM',
    availabilityNote: '',
    scheduledDate: '',
    aiSuggestedCategory: null,
  })

  // ─── Validation per step
  const stepValid = [
    // Step 0 (Location): roomId required OR buildingId/areaId as fallback
    !!(formData.buildingId || formData.areaId || formData.roomId),
    // Step 1 (Photos): always valid (optional)
    true,
    // Step 2 (Details): title + category required
    !!(formData.title.trim() && formData.category),
    // Step 3 (Review): always valid
    true,
  ]

  const canAdvance = stepValid[currentStep]

  // ─── Navigation
  const goNext = () => {
    if (!canAdvance) return
    setDirection('forward')
    setCurrentStep((s) => Math.min(s + 1, 3) as WizardStep)
  }

  const goBack = () => {
    setDirection('backward')
    setCurrentStep((s) => Math.max(s - 1, 0) as WizardStep)
  }

  // ─── Form updates
  const update = (patch: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  const handleLocationSelect = (opt: CampusLocationOption) => {
    update({
      buildingId: opt.buildingId,
      areaId: opt.areaId,
      roomId: opt.roomId,
      locationLabel: opt.hierarchy ? opt.hierarchy.join(' › ') : opt.label,
    })
  }

  const handleLocationClear = () => {
    update({ buildingId: null, areaId: null, roomId: null, locationLabel: '' })
  }

  // ─── Submit
  const handleSubmit = async () => {
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const body = {
        title: formData.title,
        description: formData.description || undefined,
        category: formData.category,
        priority: formData.priority,
        photos: formData.photos.map((p) => p.url),
        buildingId: formData.buildingId || undefined,
        areaId: formData.areaId || undefined,
        roomId: formData.roomId || undefined,
        availabilityNote: formData.availabilityNote || undefined,
        scheduledDate: formData.scheduledDate || undefined,
      }

      const res = await fetch('/api/maintenance/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to submit ticket')
      }

      setSuccess({ ticketNumber: data.data.ticketNumber, ticketId: data.data.id })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Split submit: submit current ticket, then reset wizard with second issue pre-filled
  const handleSplitSubmit = async () => {
    const body = {
      title: formData.title,
      description: formData.description || undefined,
      category: formData.category,
      priority: formData.priority,
      photos: formData.photos.map((p) => p.url),
      buildingId: formData.buildingId || undefined,
      areaId: formData.areaId || undefined,
      roomId: formData.roomId || undefined,
      availabilityNote: formData.availabilityNote || undefined,
      scheduledDate: formData.scheduledDate || undefined,
    }

    const res = await fetch('/api/maintenance/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      throw new Error(data?.error?.message || 'Failed to submit first ticket')
    }

    return { ticketNumber: data.data.ticketNumber }
  }

  // ─── Preload second ticket data (from AI split suggestion)
  const handlePreloadSecondTicket = (data: { title: string; category: string }) => {
    // Store for after split — don't update yet
    ;(handlePreloadSecondTicket as any)._pending = data
  }

  const handleAfterSplit = (ticketNumber: string) => {
    const pending = (handlePreloadSecondTicket as any)._pending
    // Reset wizard for second ticket, keep same location
    setFormData((prev) => ({
      buildingId: prev.buildingId,
      areaId: prev.areaId,
      roomId: prev.roomId,
      locationLabel: prev.locationLabel,
      photos: [],
      title: pending?.title || '',
      description: '',
      category: pending?.category || '',
      priority: 'MEDIUM',
      availabilityNote: '',
      scheduledDate: '',
      aiSuggestedCategory: pending?.category || null,
    }))
    setCurrentStep(2) // Go to Details step
  }

  // ─── Slide variants
  const slideVariants = {
    enter: (dir: 'forward' | 'backward') => ({
      x: dir === 'forward' ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'forward' | 'backward') => ({
      x: dir === 'forward' ? -40 : 40,
      opacity: 0,
    }),
  }

  const transition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }

  // ─── Success state
  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition}
        className="flex flex-col items-center justify-center py-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Request Submitted!</h3>
        <p className="text-sm text-gray-500 mb-2">Your ticket has been created successfully</p>
        <div className="px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100 mb-6">
          <p className="text-emerald-700 font-bold text-lg tracking-wide">{success.ticketNumber}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <a
            href={`/maintenance/tickets/${success.ticketId}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            View Ticket
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onComplete}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Back to My Requests
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(null)
            setFormData({
              buildingId: null,
              areaId: null,
              roomId: null,
              locationLabel: '',
              photos: [],
              title: '',
              description: '',
              category: '',
              priority: 'MEDIUM',
              availabilityNote: '',
              scheduledDate: '',
              aiSuggestedCategory: null,
            })
            setCurrentStep(0)
          }}
          className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
        >
          Submit Another Request
        </button>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStep
            const isCurrent = i === currentStep
            const StepIcon = step.icon
            return (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${isCompleted ? 'bg-emerald-500 text-white' :
                        isCurrent ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                        'bg-gray-100 text-gray-400'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isCurrent ? 'text-emerald-700' : isCompleted ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors ${i < currentStep ? 'bg-emerald-400' : 'bg-gray-100'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transition}
          >
            {currentStep === 0 && (
              <StepLocation
                buildingId={formData.buildingId}
                areaId={formData.areaId}
                roomId={formData.roomId}
                locationLabel={formData.locationLabel}
                onSelect={handleLocationSelect}
                onClear={handleLocationClear}
              />
            )}
            {currentStep === 1 && (
              <StepPhotos
                photos={formData.photos}
                onPhotosChange={(photos) => update({ photos })}
                onAiCategoryDetected={(cat) => {
                  if (cat) {
                    update({ aiSuggestedCategory: cat, category: cat })
                  }
                }}
              />
            )}
            {currentStep === 2 && (
              <StepDetails
                title={formData.title}
                description={formData.description}
                category={formData.category}
                priority={formData.priority}
                availabilityNote={formData.availabilityNote}
                scheduledDate={formData.scheduledDate}
                aiSuggestedCategory={formData.aiSuggestedCategory}
                onTitleChange={(v) => update({ title: v })}
                onDescriptionChange={(v) => update({ description: v })}
                onCategoryChange={(v) => update({ category: v })}
                onPriorityChange={(v) => update({ priority: v })}
                onAvailabilityNoteChange={(v) => update({ availabilityNote: v })}
                onScheduledDateChange={(v) => update({ scheduledDate: v })}
              />
            )}
            {currentStep === 3 && (
              <StepReview
                formData={formData}
                onSubmit={handleSubmit}
                onSplitSubmit={handleSplitSubmit}
                onPreloadSecondTicket={handlePreloadSecondTicket}
                isSubmitting={isSubmitting}
                submitError={submitError}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      {currentStep < 3 && (
        <div className="mt-6 pt-4 border-t border-gray-100/50 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {currentStep > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance}
            className="ml-auto px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-200"
          >
            {currentStep === 1 ? (formData.photos.length > 0 ? 'Next' : 'Skip') : 'Next'}
          </button>
        </div>
      )}

      {currentStep === 3 && (
        <div className="mt-4 pt-4 border-t border-gray-100/50 flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
