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
  const isRed = action.riskTier === 'RED'

  const actionLabels: Record<string, string> = {
    create_maintenance_ticket: 'Create Maintenance Ticket',
    create_event: 'Create Event',
    create_it_ticket: 'Create IT Ticket',
    update_maintenance_ticket_status: 'Update Ticket Status',
    assign_maintenance_ticket: 'Assign Ticket',
    update_maintenance_ticket: 'Update Ticket',
    delete_maintenance_ticket: 'Delete Ticket',
    update_event: 'Update Event',
    cancel_event: 'Cancel Event',
    submit_event_for_approval: 'Submit for Approval',
    approve_event: 'Approve Event',
    reject_event: 'Reject Event',
    update_it_ticket_status: 'Update IT Ticket Status',
    assign_it_ticket: 'Assign IT Ticket',
    invite_user: 'Invite User',
    update_user_role: 'Change User Role',
    deactivate_user: 'Deactivate User',
    create_inventory_item: 'Create Inventory Item',
    update_inventory_item: 'Update Inventory Item',
    create_building: 'Create Building',
    update_building: 'Update Building',
    create_room: 'Create Room',
    update_room: 'Update Room',
    send_email: 'Send Email',
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
          {/* Red tier warning banner */}
          {isRed && action.riskWarning && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs font-medium text-red-700">{action.riskWarning}</p>
            </div>
          )}

          {/* Header */}
          <div className="flex items-start gap-3 mb-3">
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${isRed ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle className={`h-4.5 w-4.5 ${isRed ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">
                {actionLabels[action.type] || 'Confirm Action'}
              </h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {action.description}
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              onClick={() => onConfirm()}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${isRed ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
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
