'use client'

import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MoreHorizontal, Loader2, UserCheck, UserX, RefreshCw } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { STATUS_LABELS, ALLOWED_TRANSITIONS } from '@/lib/constants/maintenance'
import type { WorkOrderTicket } from './WorkOrdersTable'

interface RowActionMenuProps {
  ticket: WorkOrderTicket
  canClaim: boolean
  canAssign: boolean
  canChangeStatus: boolean
  technicians: { id: string; firstName: string; lastName: string }[]
  onClaim: (id: string) => void
  onAssign: (id: string, techId: string) => void
  onStatusChange: (id: string, status: string, extra?: Record<string, string>) => void
  claimingId?: string | null
}

export default function RowActionMenu({
  ticket,
  canClaim,
  canAssign,
  canChangeStatus,
  technicians,
  onClaim,
  onAssign,
  onStatusChange,
  claimingId,
}: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<null | 'assign' | 'status'>(null)
  const [selectedTech, setSelectedTech] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const isClaiming = claimingId === ticket.id
  const isUnassigned = !ticket.assignedTo
  const showClaim = canClaim && isUnassigned && ticket.matchesSpecialty === true
  const validNextStatuses = ALLOWED_TRANSITIONS[ticket.status] ?? []

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setMode(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleClaim(e: React.MouseEvent) {
    e.stopPropagation()
    setOpen(false)
    onClaim(ticket.id)
  }

  function handleAssignSubmit(e: React.MouseEvent) {
    e.stopPropagation()
    if (!selectedTech) return
    setOpen(false)
    setMode(null)
    onAssign(ticket.id, selectedTech)
  }

  function handleStatusSubmit(e: React.MouseEvent) {
    e.stopPropagation()
    if (!selectedStatus) return
    const extra: Record<string, string> = {}
    if (completionNote) extra.completionNote = completionNote
    if (holdReason) extra.holdReason = holdReason
    if (cancellationReason) extra.cancellationReason = cancellationReason
    setOpen(false)
    setMode(null)
    onStatusChange(ticket.id, selectedStatus, extra)
  }

  if (!showClaim && !canAssign && !canChangeStatus) return null

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
          setMode(null)
        }}
        disabled={isClaiming}
        aria-busy={isClaiming}
        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        aria-label="Row actions"
      >
        {isClaiming ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
        ) : (
          <MoreHorizontal className="w-4 h-4" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="ui-glass-dropdown absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1"
          >
            {mode === null && (
              <>
                {showClaim && (
                  <button
                    onClick={handleClaim}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-primary-500" />
                    Claim
                  </button>
                )}
                {canAssign && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode('assign') }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <UserX className="w-4 h-4 text-blue-500" />
                    Assign
                  </button>
                )}
                {canChangeStatus && validNextStatuses.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode('status') }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-purple-500" />
                    Change Status
                  </button>
                )}
              </>
            )}

            {mode === 'assign' && (
              <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-slate-500 mb-1">Assign to</p>
                <FloatingDropdown
                  label="Technician"
                  value={selectedTech}
                  onChange={(value) => setSelectedTech(value)}
                  placeholder="Select technician..."
                  options={technicians.map((t) => ({
                    value: t.id,
                    label: `${t.firstName} ${t.lastName}`,
                  }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAssignSubmit}
                    disabled={!selectedTech}
                    className="ui-btn-sm ui-btn-primary flex-1"
                  >
                    Assign
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode(null) }}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === 'status' && (
              <div className="px-3 py-2 space-y-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-slate-500 mb-1">Change to</p>
                <FloatingDropdown
                  label="Status"
                  value={selectedStatus}
                  onChange={(value) => setSelectedStatus(value)}
                  placeholder="Select status..."
                  options={validNextStatuses.map((s) => ({
                    value: s,
                    label: STATUS_LABELS[s] ?? s,
                  }))}
                />
                {selectedStatus === 'DONE' && (
                  <input
                    type="text"
                    placeholder="Completion note (optional)"
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    className="ui-input"
                  />
                )}
                {selectedStatus === 'ON_HOLD' && (
                  <FloatingDropdown
                    label="Hold Reason"
                    value={holdReason}
                    onChange={(value) => setHoldReason(value)}
                    placeholder="Hold reason (optional)"
                    options={[
                      { value: '', label: 'None' },
                      { value: 'AWAITING_PARTS', label: 'Awaiting Parts' },
                      { value: 'AWAITING_VENDOR', label: 'Awaiting Vendor' },
                      { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
                      { value: 'SCHEDULED_MAINTENANCE', label: 'Scheduled Maintenance' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                )}
                {selectedStatus === 'CANCELLED' && (
                  <input
                    type="text"
                    placeholder="Reason for cancellation (required)"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="ui-input"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleStatusSubmit}
                    disabled={!selectedStatus || (selectedStatus === 'CANCELLED' && !cancellationReason.trim())}
                    className="ui-btn-sm ui-btn-primary flex-1"
                  >
                    Update
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode(null) }}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
