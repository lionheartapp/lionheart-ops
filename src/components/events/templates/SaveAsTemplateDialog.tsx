'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Check, Calendar, ClipboardList, DollarSign, FileText, Users, Bell } from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useTemplateMutations } from '@/lib/hooks/useEventTemplates'
import { useToast } from '@/components/Toast'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaveAsTemplateDialogProps {
  eventProjectId: string
  eventTitle: string
  eventType?: string | null
  isOpen: boolean
  onClose: () => void
}

// ─── What's Included Items ────────────────────────────────────────────────────

const INCLUDED_ITEMS = [
  { icon: Calendar, label: 'Schedule structure' },
  { icon: ClipboardList, label: 'Task templates' },
  { icon: DollarSign, label: 'Budget categories' },
  { icon: FileText, label: 'Document requirements' },
  { icon: Users, label: 'Group structure' },
  { icon: Bell, label: 'Notification rules' },
]

const EVENT_TYPES = [
  { value: '', label: 'Select event type (optional)' },
  { value: 'camp', label: 'Camp' },
  { value: 'field_trip', label: 'Field Trip' },
  { value: 'retreat', label: 'Retreat' },
  { value: 'conference', label: 'Conference' },
  { value: 'performance', label: 'Performance' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'sports_event', label: 'Sports Event' },
  { value: 'other', label: 'Other' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SaveAsTemplateDialog({
  eventProjectId,
  eventTitle,
  eventType,
  isOpen,
  onClose,
}: SaveAsTemplateDialogProps) {
  const focusTrapRef = useFocusTrap(isOpen)
  const { toast } = useToast()
  const { saveAsTemplate } = useTemplateMutations()

  const [name, setName] = useState(`${eventTitle} Template`)
  const [description, setDescription] = useState('')
  const [selectedType, setSelectedType] = useState(eventType ?? '')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(`${eventTitle} Template`)
      setDescription('')
      setSelectedType(eventType ?? '')
      setErrorMsg(null)
    }
  }, [isOpen, eventTitle, eventType])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  async function handleSave() {
    if (!name.trim()) {
      setErrorMsg('Template name is required.')
      return
    }
    setErrorMsg(null)

    try {
      await saveAsTemplate.mutateAsync({
        eventProjectId,
        name: name.trim(),
        description: description.trim() || undefined,
        eventType: selectedType || undefined,
      })
      toast('Template saved! Use it to create similar events faster.', 'success')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template'
      setErrorMsg(message)
    }
  }

  const isSaving = saveAsTemplate.isPending

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-template-title"
          className="relative w-full max-w-lg transform overflow-hidden rounded-2xl ui-glass-overlay"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-400" aria-hidden="true" />
          </button>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <h3 id="save-template-title" className="text-xl font-semibold text-gray-900 mb-1">
              Save as Template
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Capture the structure of this event for future reuse.
            </p>

            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  id="template-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Camp Big Bear Template"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
                />
              </div>

              {/* Event Type */}
              <div>
                <label htmlFor="template-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  id="template-type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 cursor-pointer"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="template-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="template-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe when to use this template..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 resize-none"
                />
              </div>

              {/* What's Included */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  What gets captured
                </p>
                <ul className="space-y-2">
                  {INCLUDED_ITEMS.map(({ icon: Icon, label }) => (
                    <li key={label} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
                      </div>
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error */}
              {errorMsg && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="flex-1 px-5 py-2.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="flex-1 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
