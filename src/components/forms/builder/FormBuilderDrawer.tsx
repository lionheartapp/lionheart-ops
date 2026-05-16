'use client'

import { useState, useEffect } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'
import FormBuilder from './FormBuilder'
import { useEventForm, useResetEventForm } from '@/lib/hooks/useEventForm'
import { useToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormBuilderDrawerProps {
  eventId: string
  eventTitle: string
  isOpen: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen bottom drawer that opens the three-panel FormBuilder
 * scoped to a specific event's form copy. Auto-fetches (and auto-clones
 * from the system template if needed) the per-event form on open.
 */
export default function FormBuilderDrawer({
  eventId,
  eventTitle,
  isOpen,
  onClose,
}: FormBuilderDrawerProps) {
  const { toast } = useToast()
  const { data: eventForm, isLoading, error } = useEventForm(isOpen ? eventId : null)
  const resetForm = useResetEventForm(eventId)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Close reset confirm dialog when drawer closes
  useEffect(() => {
    if (!isOpen) setShowResetConfirm(false)
  }, [isOpen])

  async function handleReset() {
    try {
      await resetForm.mutateAsync()
      toast('Form reset to template', 'success')
      setShowResetConfirm(false)
    } catch {
      toast('Failed to reset form', 'error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer — slides up from bottom */}
      <div className="relative mt-12 flex-1 flex flex-col bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4.5 h-4.5 text-slate-500" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {eventTitle} — Form
              </h2>
              <p className="text-xs text-slate-500">
                Changes only affect this event
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Reset to template */}
            {eventForm?.parentTemplateId && !showResetConfirm && (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to template
              </button>
            )}

            {showResetConfirm && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
                <span className="text-xs text-amber-800">
                  Replace custom fields with defaults?
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetForm.isPending}
                  className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
                >
                  {resetForm.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Reset'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Builder content */}
        <div className="flex-1 overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Loading form...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">Failed to load form</p>
                <p className="text-xs text-slate-500">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {eventForm && !isLoading && (
            <FormBuilder formId={eventForm.id} />
          )}
        </div>
      </div>
    </div>
  )
}
