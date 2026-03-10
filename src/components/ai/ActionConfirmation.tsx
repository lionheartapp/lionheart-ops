'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { ActionConfirmation as ActionConfirmationType } from '@/lib/types/assistant'

interface ActionConfirmationProps {
  action: ActionConfirmationType
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmation overlay for write operations initiated by the AI assistant.
 * Shows what will happen and requires explicit user confirmation.
 */
export default function ActionConfirmation({
  action,
  onConfirm,
  onCancel,
}: ActionConfirmationProps) {
  const actionLabels: Record<string, string> = {
    create_maintenance_ticket: 'Create Maintenance Ticket',
    assign_ticket: 'Assign Ticket',
    create_event: 'Create Event',
  }

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                {actionLabels[action.type] || 'Confirm Action'}
              </h3>
              <p className="mt-1 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                {action.description}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Check className="h-3.5 w-3.5" />
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
