'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  X,
  Shield,
  Search,
  SendHorizonal,
  Loader2,
  Users,
  BarChart2,
} from 'lucide-react'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useDocumentMatrix,
  useToggleCompletion,
  useSendReminders,
  type DocumentRequirement,
  type MatrixParticipant,
} from '@/lib/hooks/useEventDocuments'
import { useToast } from '@/components/Toast'

// ─── Types ─────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'incomplete' | 'complete'

interface DocumentMatrixProps {
  eventProjectId: string
  canReadMedical?: boolean
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-slate-100 rounded-xl w-full" />
      <div className="h-8 bg-slate-100 rounded-xl w-64" />
      <div className="ui-glass-table">
        <div className="h-10 bg-slate-50" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
            <div className="h-4 bg-slate-200 rounded w-32" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="h-8 w-16 bg-slate-100 rounded-lg mx-auto" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────

function MatrixEmpty({ eventProjectId }: { eventProjectId: string }) {
  void eventProjectId
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="text-center py-16"
    >
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
        <BarChart2 className="w-7 h-7 text-indigo-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No document requirements yet</h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto">
        Add document requirements from the Requirements tab to see the completion matrix.
      </p>
    </motion.div>
  )
}

// ─── Cell ───────────────────────────────────────────────────────────────

interface CellProps {
  registrationId: string
  requirementId: string
  isComplete: boolean
  isPending: boolean
  onToggle: () => void
}

function CompletionCell({ isComplete, isPending, onToggle }: CellProps) {
  return (
    <td className="px-2 py-2 text-center">
      <button
        onClick={onToggle}
        disabled={isPending}
        title={isComplete ? 'Mark incomplete' : 'Mark complete'}
        className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all cursor-pointer active:scale-[0.92] disabled:opacity-60 ${
          isComplete
            ? 'bg-green-100 hover:bg-green-200'
            : 'bg-red-50 hover:bg-red-100'
        }`}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : isComplete ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <X className="w-4 h-4 text-slate-300" />
        )}
      </button>
    </td>
  )
}

// ─── Participant Row ────────────────────────────────────────────────────

interface ParticipantRowProps {
  participant: MatrixParticipant
  requirements: DocumentRequirement[]
  pendingCells: Set<string>
  canReadMedical: boolean
  onToggle: (registrationId: string, requirementId: string, newValue: boolean) => void
}

function ParticipantRow({
  participant,
  requirements,
  pendingCells,
  canReadMedical,
  onToggle,
}: ParticipantRowProps) {
  const fullName = `${participant.firstName} ${participant.lastName}`
  const initials = `${participant.firstName[0] ?? ''}${participant.lastName[0] ?? ''}`.toUpperCase()

  return (
    <motion.tr
      variants={listItem}
      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
    >
      {/* Participant identity */}
      <td className="px-4 py-2.5 sticky left-0 bg-white z-10 min-w-[160px]">
        <div className="flex items-center gap-2.5">
          {participant.photoUrl ? (
            <img
              src={participant.photoUrl}
              alt={fullName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-indigo-700">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate max-w-[100px]">{fullName}</p>
            {canReadMedical && participant.completedCount < participant.totalCount && (
              <div className="flex items-center gap-1 mt-0.5">
                <Shield className="w-3 h-3 text-red-400 flex-shrink-0" aria-label="Has medical flags" />
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Completion cells */}
      {requirements.map((req) => {
        const completion = participant.completions.find((c) => c.requirementId === req.id)
        const cellKey = `${participant.registrationId}:${req.id}`
        return (
          <CompletionCell
            key={req.id}
            registrationId={participant.registrationId}
            requirementId={req.id}
            isComplete={completion?.isComplete ?? false}
            isPending={pendingCells.has(cellKey)}
            onToggle={() =>
              onToggle(participant.registrationId, req.id, !(completion?.isComplete ?? false))
            }
          />
        )
      })}

      {/* Status column */}
      <td className="px-3 py-2 text-center">
        <span
          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
            participant.isFullyComplete
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {participant.completedCount}/{participant.totalCount}
        </span>
      </td>
    </motion.tr>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

export function DocumentMatrix({ eventProjectId, canReadMedical = false }: DocumentMatrixProps) {
  const { data, isLoading } = useDocumentMatrix(eventProjectId)
  const toggleMutation = useToggleCompletion(eventProjectId)
  const reminderMutation = useSendReminders(eventProjectId)
  const { toast } = useToast()

  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set())

  const requirements = data?.requirements ?? []
  const allParticipants = data?.participants ?? []

  const filteredParticipants = useMemo(() => {
    let list = allParticipants

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q),
      )
    }

    // Completion filter
    switch (filter) {
      case 'complete':
        list = list.filter((p) => p.isFullyComplete)
        break
      case 'incomplete':
        list = list.filter((p) => !p.isFullyComplete)
        break
    }

    return list
  }, [allParticipants, filter, search])

  const completeCount = allParticipants.filter((p) => p.isFullyComplete).length
  const incompleteCount = allParticipants.length - completeCount

  async function handleToggle(registrationId: string, requirementId: string, newValue: boolean) {
    const cellKey = `${registrationId}:${requirementId}`
    setPendingCells((prev) => new Set(prev).add(cellKey))
    try {
      await toggleMutation.mutateAsync({ registrationId, requirementId, isComplete: newValue })
    } finally {
      setPendingCells((prev) => {
        const next = new Set(prev)
        next.delete(cellKey)
        return next
      })
    }
  }

  async function handleSendReminders() {
    try {
      const result = await reminderMutation.mutateAsync({})
      toast(`Reminders sent to ${(result as { sent: number }).sent ?? 0} families`, 'success')
    } catch {
      toast('Failed to send reminders', 'error')
    }
  }

  if (isLoading) return <MatrixSkeleton />
  if (requirements.length === 0) return <MatrixEmpty eventProjectId={eventProjectId} />

  return (
    <div className="space-y-4">
      {/* Stats bar + send reminders */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">
              <strong className="text-slate-900">{completeCount}</strong> of{' '}
              <strong className="text-slate-900">{allParticipants.length}</strong> fully complete
            </span>
          </div>
          {allParticipants.length > 0 && (
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all duration-500"
                  style={{ width: `${Math.round((completeCount / allParticipants.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {allParticipants.length > 0
                  ? Math.round((completeCount / allParticipants.length) * 100)
                  : 0}
                %
              </span>
            </div>
          )}
        </div>

        {incompleteCount > 0 && (
          <button
            onClick={handleSendReminders}
            disabled={reminderMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60"
          >
            {reminderMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <SendHorizonal className="w-4 h-4" />
            )}
            Send Reminders ({incompleteCount})
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors"
          />
        </div>

        <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
          {(['all', 'incomplete', 'complete'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix table */}
      <div className="ui-glass-table overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide sticky left-0 bg-slate-50/80 z-10 min-w-[160px]">
                Participant
              </th>
              {requirements.map((req) => (
                <th
                  key={req.id}
                  className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide max-w-[100px]"
                  title={req.label}
                >
                  <span className="block truncate max-w-[88px] mx-auto">{req.label}</span>
                  {req.dueDate && (
                    <span className="block text-[10px] font-normal text-slate-400 normal-case mt-0.5">
                      Due {new Date(req.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
                Status
              </th>
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer(0.03)}
            initial="hidden"
            animate="visible"
          >
            {filteredParticipants.length === 0 ? (
              <tr>
                <td
                  colSpan={requirements.length + 2}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  No participants match this filter.
                </td>
              </tr>
            ) : (
              filteredParticipants.map((participant) => (
                <ParticipantRow
                  key={participant.registrationId}
                  participant={participant}
                  requirements={requirements}
                  pendingCells={pendingCells}
                  canReadMedical={canReadMedical}
                  onToggle={handleToggle}
                />
              ))
            )}
          </motion.tbody>
        </table>
      </div>
    </div>
  )
}
