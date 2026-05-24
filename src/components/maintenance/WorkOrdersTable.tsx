'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Square,
  CheckSquare,
} from 'lucide-react'
import SLABadge from '@/components/shared/SLABadge'
import { Select } from '@/components/ui/Select'

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
  firstResponseAt?: string | null
  slaResponseDue?: string | null
  slaResolveDue?: string | null
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

import {
  PRIORITY_ORDER,
  STATUS_BADGE_COLORS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  ALLOWED_TRANSITIONS,
} from '@/lib/constants/maintenance'

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
  if (sort.field !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sort.dir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-slate-900" />
    : <ChevronDown className="w-3.5 h-3.5 text-slate-900" />
}

// ─── Row action menu ─────────────────────────────────────────────────────────

import RowActionMenu from './RowActionMenu'

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + (i * 17) % 40}%` }} />
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === tickets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tickets.map((t) => t.id)))
    }
  }

  const handleBulkAssign = async (techId: string) => {
    setBulkAssigning(true)
    try {
      const res = await fetch('/api/maintenance/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', ticketIds: [...selectedIds], assignedToId: techId }),
        credentials: 'include',
      })
      if (res.ok) {
        setSelectedIds(new Set())
        // Parent will refetch via query invalidation
      }
    } catch { /* ignore */ }
    finally { setBulkAssigning(false) }
  }

  const handleBulkPriority = async (newPriority: string) => {
    try {
      await fetch('/api/maintenance/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-priority', ticketIds: [...selectedIds], priority: newPriority }),
        credentials: 'include',
      })
      setSelectedIds(new Set())
    } catch { /* ignore */ }
  }

  const handleBulkStatus = async (newStatus: string) => {
    try {
      await fetch('/api/maintenance/tickets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-status', ticketIds: [...selectedIds], status: newStatus }),
        credentials: 'include',
      })
      setSelectedIds(new Set())
    } catch { /* ignore */ }
  }

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
        className="px-3 py-2 text-left text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
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
      {/* Bulk action bar */}
      {selectedIds.size > 0 && canAssign && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-2 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-medium text-blue-900">{selectedIds.size} selected</span>
          <Select
            value=""
            onChange={(next) => {
              if (next) handleBulkAssign(next)
            }}
            disabled={bulkAssigning}
            options={[
              { value: '', label: 'Assign to...' },
              ...technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })),
            ]}
            size="sm"
          />
          <Select
            value=""
            onChange={(next) => {
              if (next) handleBulkPriority(next)
            }}
            options={[
              { value: '', label: 'Set priority...' },
              { value: 'URGENT', label: 'Urgent' },
              { value: 'HIGH', label: 'High' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'LOW', label: 'Low' },
            ]}
            size="sm"
          />
          <Select
            value=""
            onChange={(next) => {
              if (next) handleBulkStatus(next)
            }}
            options={[
              { value: '', label: 'Set status...' },
              { value: 'BACKLOG', label: 'Backlog' },
              { value: 'TODO', label: 'To Do' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'DONE', label: 'Done' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            size="sm"
          />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="ui-glass-table hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100">
            <tr className="text-left">
              {canAssign && (
                <th className="px-2 py-2 w-8">
                  <button onClick={toggleSelectAll} className="cursor-pointer text-slate-400 hover:text-slate-600">
                    {selectedIds.size === tickets.length && tickets.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
              )}
              {renderThSort('Ticket #', 'ticketNumber')}
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Title</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Status</th>
              {renderThSort('Priority', 'priority')}
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Assigned To</th>
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
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">
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
                    className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors ${rowOpacity}`}
                    onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
                  >
                    {canAssign && (
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSelect(ticket.id)}
                          className="cursor-pointer text-slate-400 hover:text-slate-600"
                        >
                          {selectedIds.has(ticket.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-3 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-3 py-3 max-w-[220px]">
                      <p className="font-medium text-slate-800 truncate" title={ticket.title}>{ticket.title}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_COLORS[ticket.status] ?? 'bg-slate-100 text-slate-600'}`}
                      >
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-slate-100 text-slate-500'}`}
                        >
                          {ticket.priority}
                        </span>
                        <SLABadge ticket={ticket} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatCategory(ticket.category)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 max-w-[160px] truncate" title={location || undefined}>
                      {location || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {ticket.assignedTo ? (
                        <span className="text-slate-700">
                          {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 whitespace-nowrap">
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
                <div className="h-4 bg-slate-100 rounded w-20" />
                <div className="h-5 bg-slate-100 rounded-full w-16" />
              </div>
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-1" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        {!isLoading && sorted.length === 0 && (
          <div className="ui-glass rounded-2xl p-8 text-center text-sm text-slate-400">
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
                  <span className="font-mono text-xs text-slate-400">{ticket.ticketNumber}</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_COLORS[ticket.status] ?? 'bg-slate-100 text-slate-600'}`}
                    >
                      {STATUS_LABELS[ticket.status] ?? ticket.status}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[ticket.priority] ?? 'bg-slate-100 text-slate-500'}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>
                <p className="font-medium text-slate-800 mb-1 text-sm">{ticket.title}</p>
                <SLABadge ticket={ticket} />
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mb-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[10px]">
                    {formatCategory(ticket.category)}
                  </span>
                  {(() => {
                    const loc = [ticket.building?.name, ticket.room?.displayName || ticket.room?.roomNumber].filter(Boolean).join(' › ')
                    return loc ? <span title={loc} className="truncate max-w-[160px]">{loc}</span> : null
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${ticket.assignedTo ? 'text-slate-400' : 'text-amber-500 font-medium'}`}>
                    {ticket.assignedTo
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                      : 'Unassigned'}
                  </span>
                  <span className="text-xs text-slate-300">{formatAge(ticket.createdAt)}</span>
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
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Ticket #</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Title</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Category</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Location</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Assigned To</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400">Scheduled Date</th>
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
                  className="border-b border-slate-50 hover:bg-purple-50/30 cursor-pointer transition-colors"
                  onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{ticket.ticketNumber}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[200px] truncate" title={ticket.title}>{ticket.title}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{formatCategory(ticket.category)}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[140px] truncate" title={location || undefined}>{location || '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {ticket.assignedTo
                      ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`
                      : <span className="text-slate-300 italic">Unassigned</span>}
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
              <span className="font-mono text-xs text-slate-400">{ticket.ticketNumber}</span>
              <span className="text-xs text-purple-600 font-medium">
                {ticket.scheduledDate ? formatDate(ticket.scheduledDate) : 'No date'}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-800">{ticket.title}</p>
          </div>
        ))}
      </div>
    </>
  )
}
