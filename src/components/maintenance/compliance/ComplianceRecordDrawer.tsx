'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Ticket, AlertTriangle, CheckCircle, Loader2, ExternalLink } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import { COMPLIANCE_DOMAIN_DEFAULTS } from '@/lib/types/compliance'
import { ComplianceAttachmentPanel } from './ComplianceAttachmentPanel'
import type { ComplianceDomain, ComplianceOutcome, ComplianceStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceRecord {
  id: string
  domain: ComplianceDomain
  title: string
  dueDate: string
  inspectionDate?: string | null
  outcome: ComplianceOutcome
  status: ComplianceStatus
  inspector?: string | null
  notes?: string | null
  attachments?: string[]
  generatedTicketId?: string | null
  remediationTicketId?: string | null
  school?: { id: string; name: string } | null
  generatedTicket?: { id: string; ticketNumber: string; status: string } | null
  remediationTicket?: { id: string; ticketNumber: string; status: string } | null
}

interface ComplianceRecordDrawerProps {
  record: ComplianceRecord | null
  onClose: () => void
  onUpdated: () => void
}

// ─── Outcome Button Group ─────────────────────────────────────────────────────

const OUTCOME_OPTIONS: { value: ComplianceOutcome; label: string; color: string; selected: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'text-gray-600 border-gray-200 bg-white', selected: 'text-gray-700 border-gray-400 bg-gray-100' },
  { value: 'PASSED', label: 'Passed', color: 'text-green-700 border-green-200 bg-white', selected: 'text-green-700 border-green-500 bg-green-50' },
  { value: 'CONDITIONAL_PASS', label: 'Conditional', color: 'text-amber-700 border-amber-200 bg-white', selected: 'text-amber-700 border-amber-500 bg-amber-50' },
  { value: 'FAILED', label: 'Failed', color: 'text-red-700 border-red-200 bg-white', selected: 'text-red-700 border-red-500 bg-red-50' },
]

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const config: Record<ComplianceStatus, { label: string; className: string }> = {
    CURRENT: { label: 'Current', className: 'bg-green-100 text-green-700' },
    DUE_SOON: { label: 'Due Soon', className: 'bg-amber-100 text-amber-700' },
    OVERDUE: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
    NOT_APPLICABLE: { label: 'N/A', className: 'bg-gray-100 text-gray-500' },
    PENDING: { label: 'Pending', className: 'bg-blue-100 text-blue-700' },
  }
  const { label, className } = config[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─── Ticket Chip ─────────────────────────────────────────────────────────────

function TicketChip({ ticket, label }: { ticket: { ticketNumber: string; status: string }; label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
      <Ticket className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {label && <p className="text-xs text-gray-500 leading-none mb-0.5">{label}</p>}
        <span className="text-sm font-medium text-emerald-700">{ticket.ticketNumber}</span>
        <span className="ml-2 text-xs text-gray-400">{ticket.status}</span>
      </div>
      <ExternalLink className="w-3 h-3 text-gray-400" />
    </div>
  )
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function ComplianceRecordDrawer({ record, onClose, onUpdated }: ComplianceRecordDrawerProps) {
  const queryClient = useQueryClient()

  const [outcome, setOutcome] = useState<ComplianceOutcome>(record?.outcome ?? 'PENDING')
  const [inspectionDate, setInspectionDate] = useState<string>(
    record?.inspectionDate ? new Date(record.inspectionDate).toISOString().split('T')[0] : ''
  )
  const [inspector, setInspector] = useState<string>(record?.inspector ?? '')
  const [notes, setNotes] = useState<string>(record?.notes ?? '')
  const [toast, setToast] = useState<string | null>(null)
  const [generatedTicket, setGeneratedTicket] = useState(record?.generatedTicket ?? null)
  const [remediationTicket, setRemediationTicket] = useState(record?.remediationTicket ?? null)
  const [localAttachments, setLocalAttachments] = useState<string[]>(record?.attachments ?? [] as string[])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Save Mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!record) throw new Error('No record')
      const headers = getAuthHeaders()
      const res = await fetch(`/api/maintenance/compliance/records/${record.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          outcome,
          inspectionDate: inspectionDate ? new Date(inspectionDate).toISOString() : null,
          inspector: inspector || null,
          notes: notes || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error?.message || 'Save failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
      showToast('Changes saved')
      onUpdated()
    },
    onError: (err) => {
      console.error('[ComplianceRecordDrawer] Save error:', err)
    },
  })

  // ─── Generate Ticket Mutation ──────────────────────────────────────────────

  const ticketMutation = useMutation({
    mutationFn: async (type: 'compliance' | 'remediation') => {
      if (!record) throw new Error('No record')
      const headers = getAuthHeaders()
      const res = await fetch(`/api/maintenance/compliance/records/${record.id}/generate-ticket`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.error?.message || 'Failed to generate ticket')
      }
      return res.json()
    },
    onSuccess: (data, type) => {
      const { ticket } = data.data
      if (type === 'remediation') {
        setRemediationTicket(ticket)
        showToast('Remediation ticket created: ' + ticket.ticketNumber)
      } else {
        setGeneratedTicket(ticket)
        showToast('Work order created: ' + ticket.ticketNumber)
      }
      queryClient.invalidateQueries({ queryKey: ['compliance-records'] })
      onUpdated()
    },
    onError: (err) => {
      console.error('[ComplianceRecordDrawer] Ticket generation error:', err)
    },
  })

  if (!record) return null

  const meta = COMPLIANCE_DOMAIN_DEFAULTS[record.domain]
  const dueDate = new Date(record.dueDate)
  const isPending = outcome === 'PENDING'
  const isFailed = outcome === 'FAILED'

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Drawer panel */}
        <motion.div
          key="panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="absolute right-0 top-0 h-full w-full max-w-lg ui-glass-overlay flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-semibold text-gray-900">{meta.label}</h2>
                <StatusBadge status={record.status} />
              </div>
              <p className="text-sm text-gray-500">{record.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Due: {dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {record.school && ` — ${record.school.name}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ── Section 1: Inspection Details ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Inspection Details</h3>

              {/* Outcome button group */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Outcome</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {OUTCOME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setOutcome(opt.value)}
                      className={`px-2 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        outcome === opt.value ? opt.selected : opt.color
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inspection Date */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Inspection Date
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer"
                />
              </div>

              {/* Inspector */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Inspector Name
                </label>
                <input
                  type="text"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                  placeholder="Inspector name or company"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Inspection notes, findings, follow-up actions..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </section>

            {/* ── Section 2: Work Order ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Work Order</h3>

              {/* Compliance ticket */}
              {generatedTicket ? (
                <TicketChip ticket={generatedTicket} label="Linked Work Order" />
              ) : (
                <button
                  onClick={() => ticketMutation.mutate('compliance')}
                  disabled={ticketMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {ticketMutation.isPending && ticketMutation.variables === 'compliance' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ticket className="w-4 h-4" />
                  )}
                  Generate Work Order
                </button>
              )}

              {/* Remediation ticket — only when FAILED */}
              {isFailed && (
                <div className="mt-3">
                  {remediationTicket ? (
                    <TicketChip ticket={remediationTicket} label="Remediation Ticket" />
                  ) : (
                    <button
                      onClick={() => ticketMutation.mutate('remediation')}
                      disabled={ticketMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {ticketMutation.isPending && ticketMutation.variables === 'remediation' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      Generate Remediation Ticket
                    </button>
                  )}
                </div>
              )}

              {ticketMutation.isError && (
                <p className="mt-2 text-xs text-red-500">
                  {ticketMutation.error instanceof Error
                    ? ticketMutation.error.message
                    : 'Failed to generate ticket'}
                </p>
              )}
            </section>

            {/* ── Section 3: Attachments ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
              <ComplianceAttachmentPanel
                record={{ id: record.id, attachments: localAttachments }}
                onAttachmentsUpdated={(updated) => {
                  setLocalAttachments(updated)
                  onUpdated()
                }}
              />
            </section>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200/50 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key="toast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-lg shadow-lg"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
