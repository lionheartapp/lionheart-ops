'use client'

import { ReactNode, FormEvent, useEffect, useCallback } from 'react'
import DetailDrawer from '@/components/DetailDrawer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean
  /** Close callback */
  onClose: () => void
  /** Form submit handler — receives the form event */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  /** Drawer title */
  title: string
  /** Form fields as children */
  children: ReactNode
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Submit button label (default: "Save") */
  submitLabel?: string
  /** Whether the form has unsaved changes */
  isDirty?: boolean
  /** Drawer width */
  width?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional: extra footer content (placed before the submit button) */
  footerExtra?: ReactNode
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FormDrawer({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  isSubmitting = false,
  submitLabel = 'Save',
  isDirty = false,
  width = 'md',
  footerExtra,
}: FormDrawerProps) {
  // Warn before closing with unsaved changes
  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Discard them?')
      if (!confirmed) return
    }
    onClose()
  }, [isDirty, onClose])

  // Warn before page unload with unsaved changes
  useEffect(() => {
    if (!isDirty || !isOpen) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, isOpen])

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      width={width}
      footer={
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          {footerExtra}
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 py-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-3 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </form>
      }
    >
      <form onSubmit={onSubmit} id="form-drawer-form">
        <div className="space-y-4">
          {children}
        </div>
      </form>
    </DetailDrawer>
  )
}
