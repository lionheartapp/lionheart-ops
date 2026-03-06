'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SortField = 'ticketNumber' | 'priority' | 'age'
export type SortDir = 'asc' | 'desc'

export interface SortState {
  field: SortField
  dir: SortDir
}

export interface WorkOrderTicket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  category: string
  scheduledDate?: string | null
  createdAt: string
  assignedTo?: { id: string; firstName: string; lastName: string } | null
  submittedBy?: { id: string; firstName: string; lastName: string } | null
  building?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
  matchesSpecialty?: boolean
  photos?: string[]
  aiAnalysis?: unknown
}

interface WorkOrdersTableProps {
  tickets: WorkOrderTicket[]
  isLoading: boolean
  sort: SortState
  onSort: (field: SortField) => void
  currentUserId?: string
  canClaim: boolean
  canAssign: boolean
  canChangeStatus: boolean
  showSpecialtyHighlight: boolean
  technicians: { id: string; firstName: string; lastName: string }[]
  onClaim: (ticketId: string) => void
  onAssign: (ticketId: string, techId: string) => void
  onStatusChange: (ticketId: string, status: string, extra?: Record<string, string>) => void
  claimingId?: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-100 text-gray-600',
  TODO: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  ON_HOLD: 'bg-red-100 text-red-700',
  SCHEDULED: 'bg-purple-100 text-purple-700',
  QA: 'bg-pink-100 text-pink-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 font-semibold',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
  SCHEDULED: 'Scheduled',
  QA: 'QA Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}

// Valid next-status transitions (client-side mirror of server state machine)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  BACKLOG: ['TODO', 'SCHEDULED', 'CANCELLED'],
  TODO: ['IN_PROGRESS', 'BACKLOG', 'SCHEDULED', 'ON_HOLD', 'CANCELLED'],
  IN_PROGRESS: ['QA', 'DONE', 'ON_HOLD', 'TODO', 'CANCELLED'],
  ON_HOLD: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  SCHEDULED: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  QA: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: [],
  CANCELLED: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(ms / 3600000)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(ms / 86400000)
  return `${days}d`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    ELECTRICAL: 'Electrical',
    PLUMBING: 'Plumbing',
    HVAC: 'HVAC',
    CARPENTRY: 'Carpentry',
    PAINTING: 'Painting',
    GROUNDS: 'Grounds',
    CLEANING: 'Cleaning',
    OTHER: 'Other',
  }
  return map[cat] ?? cat
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ field, sort }: { field: SortField; sort: SortState }) {
  if (sort.field !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-gray-900" />
    : <ChevronDown className="w-3.5 h-3.5 text-gray-900" />
}

// ─── Row action menu ─────────────────────────────────────────────────────────

function RowActionMenu({
  ticket,
  canClaim,
  canAssign,
  canChangeStatus,
  technicians,
  onClaim,
  onAssign,
  onStatusChange,
  claimingId,
}: {
  ticket: WorkOrderTicket
  canClaim: boolean
  canAssign: boolean
  canChangeStatus: boolean
  technicians: { id: string; firstName: string; lastName: string }[]
  onClaim: (id: string) => void
  onAssign: (id: string, techId: string) => void
  onStatusChange: (id: string, status: string, extra?: Record<string, string>) => void
  claimingId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<null | 'assign' | 'status'>(null)
  const [selectedTech, setSelectedTech] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [completionNote, setCompletionNote] = useState('')
  const [holdReason, setHoldReason] = useState('')
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
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        aria-label="Row actions"
      >
        {isClaiming ? (
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
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
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    Claim
                  </button>
                )}
                {canAssign && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode('assign') }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <UserX className="w-4 h-4 text-blue-500" />
                    Assign
                  </button>
                )}
                {canChangeStatus && validNextStatuses.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode('status') }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-purple-500" />
                    Change Status
                  </button>
                )}
              </>
            )}

            {mode === 'assign' && (
              <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-gray-500 mb-1">Assign to</p>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="ui-select cursor-pointer"
                  autoFocus
                >
                  <option value="">Select technician...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
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
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mode === 'status' && (
              <div className="px-3 py-2 space-y-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-gray-500 mb-1">Change to</p>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="ui-select cursor-pointer"
                  autoFocus
                >
                  <option value="">Select status...</option>
                  {validNextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
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
                  <select
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    className="ui-select cursor-pointer"
                  >
                    <option value="">Hold reason (optional)</option>
                    <option value="AWAITING_PARTS">Awaiting Parts</option>
                    <option value="AWAITING_VENDOR">Awaiting Vendor</option>
                    <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                    <option value="SCHEDULED_MAINTENANCE">Scheduled Maintenance</option>
                    <option value="OTHER">Other</option>
                  </select>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleStatusSubmit}
                    disabled={!selectedStatus}
                    className="ui-btn-sm ui-btn-primary flex-1"
                  >
                    Update
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMode(null) }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
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

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-100">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i * 17) % 40}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Main table component ─────────────────────────────────────────────────────

export default function WorkOrdersTable({
  tickets,
  isLoading,
  sort,
  onSort,
  canClaim,
  canAssign,
  canChangeStatus,
  showSpecialtyHighlight,
  technicians,
  onClaim,
  onAssign,
  onStatusChange,
  claimingId,
}: WorkOrdersTableProps) {
  const router = useRouter()

  const sortedTickets = useCallback(() => {
    const priorityVal = (p: string) => PRIORITY_ORDER[p] ?? 0
    return [...tickets].sort((a, b) => {
      if (sort.field === 'priority') {
        const diff = priorityVal(b.priority) - priorityVal(a.priority)
        if (diff !== 0) return sort.dir === 'desc' ? diff : -diff
        // Secondary: age asc (oldest first = smaller createdAt first)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      if (sort.field === 'age') {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        return sort.dir === 'asc' ? diff : -diff
      }
      if (sort.field === 'ticketNumber') {
        const diff = a.ticketNumber.localeCompare(b.ticketNumber)
        return sort.dir === 'asc' ? diff : -diff
      }
      return 0
    })
  }, [tickets, sort])

  function renderThSort(label: string, field: SortField) {
    return (
      <th
        className="px-3 py-2 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
        onClick={() => onSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon field={field} sort={sort} />
        </span>
      </th>
    )
  }

  function getRowOpacity(ticket: WorkOrderTicket): string {
    if (!showSpecialtyHighlight) return ''
    if (ticket.matchesSpecialty === false) return 'opacity-50'
    return ''
  }

  const sorted = sortedTickets()

  return (
    <>
      {/* Desktop table */}
      <div className="ui-glass-table hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100">
            <tr className="text-left">
              {renderThSort('Ticket #', 'ticketNumber')}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Title</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
              {renderThSort('Priority', 'priority')}
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Assigned To</th>
              {renderThSort('Age', 'age')}
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {!isLoading && sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-gray-400">
                  No work orders match your filters.{' '}
                  <span className="text-primary-600 cursor-pointer hover:underline">
                    Clear filters
                  </span>{' '}
                  to see all tickets.
                </td>
              </tr>
            )}
            {!isLoading &&
              sorted.map((ticket) => {
                const rowOpacity = getRowOpacity(ticket)
                const locationParts: string[] = []
                if (ticket.building) locationParts.push(ticket.building.name)
                if (ticket.room) {
                  const roomLabel = ticket.room.displayName || ticket.room.roomNumber
                  locationParts.push(roomLabel)
                }
                const location = locationParts.join(' › ')

                return (
                  <tr
                    key={ticket.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors ${rowOpacity}`}
                    onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
                  >
                    <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      <p className="font-medium text-gray-800 truncate">{ticket.title}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatCategory(ticket.category)}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                      {location || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {ticket.assignedTo ? (
                        <span className="text-gray-700">
                          {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                        </span>
                      ) : (
                        <span className="text-gray-300 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatAge(ticket.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <RowActionMenu
                        ticket={ticket}
                        canClaim={canClaim}
                        canAssign={canAssign}
                        canChangeStatus={canChangeStatus}
                        technicians={technicians}
                        onClaim={onClaim}
                        onAssign={onAssign}
                        onStatusChange={onStatusChange}
                        claimingId={claimingId}
                      />
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {isLoading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="ui-glass p-4 rounded-2xl animate-pulse">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="h-4 bg-gray-100 rounded w-20" />
                <div className="h-5 bg-gray-100 rounded-full w-16" />
              </div>
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        {!isLoading && sorted.length === 0 && (
          <div className="ui-glass rounded-2xl p-8 text-center text-sm text-gray-400">
            No work orders match your filters.
          </div>
        )}
        {!isLoading &&
          sorted.map((ticket) => {
            const rowOpacity = getRowOpacity(ticket)
            return (
              <div
                key={ticket.id}
                className={`ui-glass-hover p-4 rounded-2xl cursor-pointer ${rowOpacity}`}
                onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs text-gray-400">{ticket.ticketNumber}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-gray-100 text-gray-500'}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <p className="font-medium text-gray-800 mb-1 text-sm">{ticket.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {ticket.assignedTo
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                      : 'Unassigned'}
                  </span>
                  <span className="text-xs text-gray-300">{formatAge(ticket.createdAt)}</span>
                </div>
              </div>
            )
          })}
      </div>
    </>
  )
}

// ─── Scheduled section sub-table ──────────────────────────────────────────────

interface ScheduledTableProps {
  tickets: WorkOrderTicket[]
}

export function ScheduledTicketsTable({ tickets }: ScheduledTableProps) {
  const router = useRouter()

  const sorted = [...tickets].sort((a, b) => {
    const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity
    const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity
    return aDate - bDate
  })

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Ticket #</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Title</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Assigned To</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Scheduled Date</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ticket) => {
              const locationParts: string[] = []
              if (ticket.building) locationParts.push(ticket.building.name)
              if (ticket.room) locationParts.push(ticket.room.displayName || ticket.room.roomNumber)
              const location = locationParts.join(' › ')

              return (
                <tr
                  key={ticket.id}
                  className="border-b border-gray-50 hover:bg-purple-50/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{ticket.ticketNumber}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[200px] truncate">{ticket.title}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">{formatCategory(ticket.category)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[140px] truncate">{location || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500">
                    {ticket.assignedTo
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                      : <span className="text-gray-300 italic">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-purple-600 font-medium whitespace-nowrap">
                    {ticket.scheduledDate ? formatDate(ticket.scheduledDate) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden space-y-2">
        {sorted.map((ticket) => (
          <div
            key={ticket.id}
            className="ui-glass-hover p-3 rounded-xl cursor-pointer"
            onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-gray-400">{ticket.ticketNumber}</span>
              <span className="text-xs text-purple-600 font-medium">
                {ticket.scheduledDate ? formatDate(ticket.scheduledDate) : 'No date'}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-800">{ticket.title}</p>
          </div>
        ))}
      </div>
    </>
  )
}
