'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { StatusBadge, PriorityBadge, TypeBadge } from './ITStatusBadge'
import { TicketsListSkeleton } from './ITSkeleton'
import { Plus } from 'lucide-react'
import ITSearchFilterBar from './ITSearchFilterBar'
import type { FilterField } from './ITSearchFilterBar'

interface ITTicketsListProps {
  onViewTicket: (ticketId: string) => void
  onCreateTicket: () => void
  canManage: boolean
}

interface Ticket {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  issueType: string
  createdAt: string
  submittedBy?: { id: string; firstName: string; lastName: string; avatar?: string | null } | null
  assignedTo?: { id: string; firstName: string; lastName: string; avatar?: string | null } | null
  building?: { id: string; name: string } | null
  room?: { id: string; roomNumber?: string; displayName?: string | null } | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'DISPLAY_AV', label: 'Display / A/V' },
  { value: 'OTHER', label: 'Other' },
]

export default function ITTicketsList({ onViewTicket, onCreateTicket, canManage }: ITTicketsListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (search) f.search = search
    if (statusFilter) f.status = statusFilter
    if (priorityFilter) f.priority = priorityFilter
    if (typeFilter) f.issueType = typeFilter
    return f
  }, [search, statusFilter, priorityFilter, typeFilter])

  const { data, isLoading } = useQuery(queryOptions.itTickets(filters))

  if (isLoading) return <TicketsListSkeleton />

  const tickets = ((data as { tickets?: Ticket[] })?.tickets ?? []) as Ticket[]
  const total = (data as { total?: number })?.total ?? 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <ITSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tickets..."
        filters={[
          { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
          { label: 'Priority', value: priorityFilter, onChange: setPriorityFilter, options: PRIORITY_OPTIONS },
          { label: 'Type', value: typeFilter, onChange: setTypeFilter, options: TYPE_OPTIONS },
        ]}
        trailing={
          <button
            onClick={onCreateTicket}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        }
      />

      {/* Results */}
      {tickets.length === 0 ? (
        <div className="ui-glass p-12 text-center">
          <p className="text-sm text-gray-500">No tickets found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or create a new request</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">{total} ticket{total !== 1 ? 's' : ''}</p>

          {/* Desktop table */}
          <div className="hidden sm:block ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                  <th className="px-4 py-3 font-medium">Ticket</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  {canManage && <th className="px-4 py-3 font-medium">Assignee</th>}
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onViewTicket(t.id)}
                    className="border-b border-gray-100/50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.ticketNumber}</td>
                    <td className="px-4 py-3 text-gray-900 max-w-[250px] truncate">{t.title}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3"><TypeBadge type={t.issueType} /></td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {t.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                              {t.assignedTo.firstName[0]}{t.assignedTo.lastName[0]}
                            </div>
                            <span className="text-xs text-gray-600">
                              {t.assignedTo.firstName} {t.assignedTo.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => onViewTicket(t.id)}
                className="w-full text-left ui-glass-hover p-4"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-gray-500">{t.ticketNumber}</span>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mb-2">{t.title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={t.priority} />
                  <TypeBadge type={t.issueType} />
                  {t.assignedTo && (
                    <span className="text-xs text-gray-500">
                      {t.assignedTo.firstName} {t.assignedTo.lastName}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
