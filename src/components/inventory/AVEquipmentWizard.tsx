'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Settings, Save, ChevronLeft, ChevronRight, X, ClipboardCheck } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import StepEssentials, { type LocationEntry, type StepEssentialsHandle } from './StepEssentials'
import StepDetails, { type DocLink } from './StepDetails'

// ─── Types ─────────────────────────────────────────────────────────────────

interface AVEquipmentFormData {
  // Step 1 — Essentials
  name: string
  description: string
  ownerId: string | null
  locations: LocationEntry[]
  allowCheckout: boolean
  category: string
  // Step 2 — Details
  manufacturer: string
  model: string
  serialNumbers: string[]
  imageUrl: string | null
  documentationLinks: DocLink[]
  tags: string[]
}

interface InventoryItemData extends AVEquipmentFormData {
  id: string
}

interface AVEquipmentWizardProps {
  /** Pass existing item data for edit mode */
  item?: InventoryItemData | null
  onSuccess: () => void
  onCancel: () => void
  /** Form ID for external submit buttons */
  formId?: string
  /** Expose pending state to parent */
  onPendingChange?: (pending: boolean) => void
  /** Default category for new items (set by the department page) */
  defaultCategory?: string
}

// ─── Step Config ───────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Essentials', sublabel: 'Name, location, checkout', icon: Package },
  { label: 'Details', sublabel: 'Product info, media, tags', icon: Settings },
  { label: 'Review', sublabel: 'Confirm & create', icon: ClipboardCheck },
] as const

// ─── Animation Variants ────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

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

const transition = { duration: 0.25, ease: EASE }

// ─── Initial Form Data ─────────────────────────────────────────────────────

function getInitialData(item?: InventoryItemData | null, defaultCategory?: string): AVEquipmentFormData {
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
    ownerId: item?.ownerId ?? null,
    locations: item?.locations ?? [],
    allowCheckout: item?.allowCheckout ?? false,
    category: item?.category ?? defaultCategory ?? '',
    manufacturer: item?.manufacturer ?? '',
    model: item?.model ?? '',
    serialNumbers: item?.serialNumbers ?? [],
    imageUrl: item?.imageUrl ?? null,
    documentationLinks: item?.documentationLinks ?? [],
    tags: item?.tags ?? [],
  }
}

// ─── Step 3: Review & Confirm ─────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-500 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-900 text-right">{value || <span className="text-slate-400 italic">Not set</span>}</span>
    </div>
  )
}

function StepReview({ formData, isEditing }: { formData: AVEquipmentFormData; isEditing: boolean }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-1">
          {isEditing ? 'Review your changes' : 'Review before creating'}
        </p>
        <p className="text-xs text-slate-500">
          Confirm the details below, then click {isEditing ? '"Save Changes"' : '"Create Equipment"'} to finish.
        </p>
      </div>

      {/* Essentials */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Essentials</p>
        <ReviewRow label="Name" value={formData.name} />
        <ReviewRow label="Description" value={formData.description} />
        <ReviewRow label="Category" value={formData.category} />
        <ReviewRow
          label="Checkout"
          value={formData.allowCheckout ? 'Allowed' : 'Not allowed'}
        />
        <ReviewRow
          label="Locations"
          value={
            formData.locations.length > 0
              ? formData.locations.map((l) => `${l.locationName} (x${l.quantity})`).join(', ')
              : null
          }
        />
      </div>

      {/* Details */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Details</p>
        <ReviewRow label="Manufacturer" value={formData.manufacturer} />
        <ReviewRow label="Model" value={formData.model} />
        <ReviewRow
          label="Serial Numbers"
          value={
            formData.serialNumbers.length > 0
              ? formData.serialNumbers.join(', ')
              : null
          }
        />
        <ReviewRow
          label="Tags"
          value={
            formData.tags.length > 0
              ? (
                <span className="flex flex-wrap gap-1 justify-end">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )
              : null
          }
        />
        <ReviewRow
          label="Documentation"
          value={
            formData.documentationLinks.length > 0
              ? `${formData.documentationLinks.length} link${formData.documentationLinks.length === 1 ? '' : 's'}`
              : null
          }
        />
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function AVEquipmentWizard({
  item,
  onSuccess,
  onCancel,
  onPendingChange,
  defaultCategory,
}: AVEquipmentWizardProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [formData, setFormData] = useState<AVEquipmentFormData>(() => getInitialData(item, defaultCategory))
  const [nameError, setNameError] = useState('')
  const essentialsRef = useRef<StepEssentialsHandle>(null)

  const isEditing = Boolean(item?.id)
  const lastStep = STEPS.length - 1

  // ── Validation per step ──

  const stepValid = [
    Boolean(formData.name.trim()), // Step 0: name required
    true, // Step 1: all optional
    true, // Step 2: review — always valid
  ]

  const canAdvance = stepValid[currentStep]

  // ── Navigation ──

  const goNext = () => {
    if (currentStep === 0 && !formData.name.trim()) {
      setNameError('Name is required')
      return
    }
    setNameError('')
    if (!canAdvance) return
    // Auto-commit any pending location entry before leaving step 0
    if (currentStep === 0) {
      essentialsRef.current?.flushPendingLocation()
    }
    setDirection('forward')
    setCurrentStep((s) => Math.min(s + 1, lastStep))
  }

  const goBack = () => {
    setDirection('backward')
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  // ── Form data updater ──

  const update = (patch: Partial<AVEquipmentFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  // ── Mutation ──

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        isAVEquipment: true,
        name: formData.name,
        description: formData.description || undefined,
        ownerId: formData.ownerId,
        locations: formData.locations,
        allowCheckout: formData.allowCheckout,
        category: formData.category || undefined,
        manufacturer: formData.manufacturer || undefined,
        model: formData.model || undefined,
        serialNumbers: formData.serialNumbers,
        imageUrl: formData.imageUrl,
        documentationLinks: formData.documentationLinks,
        tags: formData.tags,
      }

      if (isEditing) {
        return fetchApi(`/api/inventory/${item!.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      }
      return fetchApi('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess()
    },
    onError: (err: Error) => {
      const msg = err.message || 'Something went wrong'
      if (msg.toLowerCase().includes('name')) {
        setCurrentStep(0)
        setNameError(msg)
      }
    },
  })

  // Expose pending state to parent
  useEffect(() => {
    onPendingChange?.(mutation.isPending)
  }, [mutation.isPending, onPendingChange])

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setCurrentStep(0)
      setNameError('Name is required')
      return
    }
    mutation.mutate()
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Step Progress Indicator ── */}
      <div className="px-6 pt-2 pb-6">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            const isActive = i === currentStep
            const isComplete = i < currentStep
            return (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <button
                  type="button"
                  onClick={() => {
                    if (i < currentStep) {
                      setDirection('backward')
                      setCurrentStep(i)
                    }
                  }}
                  disabled={i > currentStep}
                  className={`flex items-center gap-2.5 cursor-pointer disabled:cursor-default transition-all ${
                    isActive || isComplete ? '' : 'opacity-50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : isComplete
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <div className="hidden sm:block">
                    <p
                      className={`text-xs font-semibold ${
                        isActive ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-400">{step.sublabel}</p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${
                      isComplete ? 'bg-indigo-400' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Form Error ── */}
      {mutation.isError && (
        <div className="mx-6 mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {mutation.error?.message || 'Something went wrong. Please try again.'}
        </div>
      )}

      {/* ── Step Content ── */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
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
              <StepEssentials
                ref={essentialsRef}
                name={formData.name}
                description={formData.description}
                ownerId={formData.ownerId}
                locations={formData.locations}
                allowCheckout={formData.allowCheckout}
                category={formData.category}
                onNameChange={(v) => {
                  update({ name: v })
                  if (nameError) setNameError('')
                }}
                onDescriptionChange={(v) => update({ description: v })}
                onOwnerChange={(v) => update({ ownerId: v })}
                onLocationsChange={(v) => update({ locations: v })}
                onCheckoutChange={(v) => update({ allowCheckout: v })}
                onCategoryChange={(v) => update({ category: v })}
                nameError={nameError}
              />
            )}
            {currentStep === 1 && (
              <StepDetails
                manufacturer={formData.manufacturer}
                model={formData.model}
                serialNumbers={formData.serialNumbers}
                imageUrl={formData.imageUrl}
                documentationLinks={formData.documentationLinks}
                tags={formData.tags}
                onManufacturerChange={(v) => update({ manufacturer: v })}
                onModelChange={(v) => update({ model: v })}
                onSerialNumbersChange={(v) => update({ serialNumbers: v })}
                onImageChange={(v) => update({ imageUrl: v })}
                onDocumentationLinksChange={(v) => update({ documentationLinks: v })}
                onTagsChange={(v) => update({ tags: v })}
              />
            )}
            {currentStep === 2 && (
              <StepReview formData={formData} isEditing={isEditing} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer Navigation ── */}
      <div className="border-t border-slate-200 px-6 py-4 bg-white">
        <div className="flex gap-3">
          {/* Save / Submit */}
          {currentStep === lastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {mutation.isPending
                ? 'Saving…'
                : isEditing
                ? 'Save Changes'
                : 'Create Equipment'}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance}
              className="flex-1 px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Back */}
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={mutation.isPending}
              className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={mutation.isPending}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
