'use client'

import { useState, useEffect } from 'react'
import { FileText, Tag, AlignLeft, Calendar, ToggleLeft } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import {
  useCreateDocumentRequirement,
  useUpdateDocumentRequirement,
  type DocumentRequirement,
} from '@/lib/hooks/useEventDocuments'

// ─── Types ─────────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'PERMISSION_SLIP', label: 'Permission Slip' },
  { value: 'WAIVER', label: 'Waiver' },
  { value: 'MEDICAL_RELEASE', label: 'Medical Release' },
  { value: 'PHOTO_RELEASE', label: 'Photo Release' },
  { value: 'CUSTOM', label: 'Custom' },
] as const

interface DocumentRequirementDrawerProps {
  eventProjectId: string
  isOpen: boolean
  onClose: () => void
  /** If provided, drawer is in edit mode. */
  requirement?: DocumentRequirement | null
}

interface FormState {
  label: string
  documentType: string
  description: string
  dueDate: string
  isRequired: boolean
}

const defaultForm: FormState = {
  label: '',
  documentType: 'PERMISSION_SLIP',
  description: '',
  dueDate: '',
  isRequired: true,
}

// ─── Component ─────────────────────────────────────────────────────────

export function DocumentRequirementDrawer({
  eventProjectId,
  isOpen,
  onClose,
  requirement,
}: DocumentRequirementDrawerProps) {
  const isEditing = !!requirement

  const [form, setForm] = useState<FormState>(defaultForm)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreateDocumentRequirement(eventProjectId)
  const updateMutation = useUpdateDocumentRequirement(eventProjectId)
  const isPending = createMutation.isPending || updateMutation.isPending

  // Populate form when editing
  useEffect(() => {
    if (requirement) {
      setForm({
        label: requirement.label,
        documentType: requirement.documentType,
        description: requirement.description ?? '',
        dueDate: requirement.dueDate ? requirement.dueDate.split('T')[0] : '',
        isRequired: requirement.isRequired,
      })
    } else {
      setForm(defaultForm)
    }
    setError(null)
  }, [requirement, isOpen])

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.label.trim()) {
      setError('Label is required.')
      return
    }
    setError(null)

    try {
      if (isEditing && requirement) {
        await updateMutation.mutateAsync({
          requirementId: requirement.id,
          data: {
            label: form.label.trim(),
            documentType: form.documentType,
            description: form.description.trim() || null,
            dueDate: form.dueDate || null,
            isRequired: form.isRequired,
          },
        })
      } else {
        await createMutation.mutateAsync({
          label: form.label.trim(),
          documentType: form.documentType,
          description: form.description.trim() || undefined,
          dueDate: form.dueDate || null,
          isRequired: form.isRequired,
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    }
  }

  const footer = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="flex-1 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="flex-1 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
      >
        {isPending ? 'Saving…' : isEditing ? 'Update' : 'Add Requirement'}
      </button>
    </div>
  )

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Document Requirement' : 'New Document Requirement'}
      footer={footer}
      width="md"
    >
      <div className="space-y-5">
        {/* Label */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <FileText className="w-3.5 h-3.5" />
            Label <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="e.g. Signed Permission Slip"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors"
          />
        </div>

        {/* Document Type */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Tag className="w-3.5 h-3.5" />
            Document Type
          </label>
          <select
            value={form.documentType}
            onChange={(e) => handleChange('documentType', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors cursor-pointer bg-white"
          >
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <AlignLeft className="w-3.5 h-3.5" />
            Description <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Brief instructions for families…"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors resize-none"
          />
        </div>

        {/* Due Date */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Due Date <span className="text-gray-300 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors cursor-pointer"
          />
        </div>

        {/* Required Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2.5">
            <ToggleLeft className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900">Required</p>
              <p className="text-xs text-gray-500">Reminders will only be sent for required documents</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.isRequired}
            onClick={() => handleChange('isRequired', !form.isRequired)}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
              form.isRequired ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                form.isRequired ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            {error}
          </p>
        )}
      </div>
    </DetailDrawer>
  )
}
