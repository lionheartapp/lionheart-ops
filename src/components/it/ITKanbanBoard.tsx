'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import ITKanbanColumn from './ITKanbanColumn'
import ITKanbanCard, { type KanbanTicket } from './ITKanbanCard'
import { BoardSkeleton } from './ITSkeleton'
import HoldReasonDialog from './HoldReasonDialog'
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import ITErrorState from './ITErrorState'
import ITSearchFilterBar from './ITSearchFilterBar'

interface ITKanbanBoardProps {
  onTicketClick: (id: string) => void
  /** 'mine' = my tickets + unassigned, 'all' = everything */
  scope?: 'mine' | 'all'
  /** Current user's ID — used for "mine" scope filtering */
  currentUserId?: string
  /** School-scoped viewpoint. null = "All Schools". */
  activeSchoolId?: string | null
}

const BOARD_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD'] as const
const COMPLETED_STATUSES = ['DONE', 'CANCELLED'] as const

const ISSUE_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ACCOUNT_PASSWORD', label: 'Account / Password' },
  { value: 'NETWORK', label: 'Network' },
  { value: 'DISPLAY_AV', label: 'Display / A/V' },
  { value: 'OTHER', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

export default function ITKanbanBoard({ onTicketClick, scope = 'mine', currentUserId, activeSchoolId }: ITKanbanBoardProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTicket, setActiveTicket] = useState<KanbanTicket | null>(null)
  const [holdPending, setHoldPending] = useState<{ ticketId: string; title: string } | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  // Filter state
  const [filterIssueType, setFilterIssueType] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterUnassigned, setFilterUnassigned] = useState(false)

  const { data: boardData, isLoading, isError, refetch } = useQuery(queryOptions.itBoard(activeSchoolId ?? undefined))

  // Fetch recently completed tickets (last 7 days) when toggled on
  const sevenDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }, [])

  const { data: completedDone } = useQuery({
    queryKey: ['it-tickets-completed', 'DONE', activeSchoolId ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'DONE', limit: '50' })
      if (activeSchoolId) params.set('schoolId', activeSchoolId)
      const res = await fetch(`/api/it/tickets?${params.toString()}`, {
        headers: getAuthHeaders() as HeadersInit,
      })
      if (!res.ok) return { tickets: [] }
      const body = await res.json() as { data?: { tickets: KanbanTicket[] } }
      return body.data ?? { tickets: [] }
    },
    enabled: showCompleted,
    staleTime: 30_000,
  })

  const { data: completedCancelled } = useQuery({
    queryKey: ['it-tickets-completed', 'CANCELLED', activeSchoolId ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'CANCELLED', limit: '50' })
      if (activeSchoolId) params.set('schoolId', activeSchoolId)
      const res = await fetch(`/api/it/tickets?${params.toString()}`, {
        headers: getAuthHeaders() as HeadersInit,
      })
      if (!res.ok) return { tickets: [] }
      const body = await res.json() as { data?: { tickets: KanbanTicket[] } }
      return body.data ?? { tickets: [] }
    },
    enabled: showCompleted,
    staleTime: 30_000,
  })

  const completedTickets = useMemo(() => {
    const doneTickets = (completedDone as { tickets: KanbanTicket[] } | undefined)?.tickets ?? []
    const cancelledTickets = (completedCancelled as { tickets: KanbanTicket[] } | undefined)?.tickets ?? []
    const all = [...doneTickets, ...cancelledTickets]
    return all.filter((t) => {
      if (new Date(t.createdAt) < new Date(sevenDaysAgo)) return false
      if (scope === 'mine' && currentUserId && t.assignedTo) {
        if (t.assignedTo.id !== currentUserId) return false
      }
      return true
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [completedDone, completedCancelled, scope, currentUserId, sevenDaysAgo])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Apply client-side filters (scope + manual filters)
  const filteredBoardData = useMemo(() => {
    const raw = (boardData ?? {}) as Record<string, KanbanTicket[]>

    const filtered: Record<string, KanbanTicket[]> = {}
    for (const [col, tickets] of Object.entries(raw)) {
      filtered[col] = (tickets as KanbanTicket[]).filter((t) => {
        // Scope filter: "mine" shows my tickets + unassigned
        if (scope === 'mine' && currentUserId && t.assignedTo) {
          if (t.assignedTo.id !== currentUserId) return false
        }
        if (filterIssueType && t.issueType !== filterIssueType) return false
        if (filterPriority && t.priority !== filterPriority) return false
        if (filterUnassigned && t.assignedTo) return false
        return true
      })
    }
    return filtered
  }, [boardData, scope, currentUserId, filterIssueType, filterPriority, filterUnassigned])

  // Count urgent tickets across all columns (from raw data, not filtered)
  const urgentCount = useMemo(() => {
    const raw = (boardData ?? {}) as Record<string, KanbanTicket[]>
    return Object.values(raw).flat().filter((t) => t.priority === 'URGENT').length
  }, [boardData])

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status, holdReason }: { ticketId: string; status: string; holdReason?: string }) =>
      fetch(`/api/it/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          ...(holdReason ? { holdReason } : {}),
        }),
      }).then((r) => {
        if (!r.ok) throw new Error('Status transition failed')
        return r.json()
      }),
    onMutate: async ({ ticketId, status }) => {
      // Optimistic update — scope cache mutations to the current school viewpoint
      const boardKey = queryKeys.itBoard.filtered(activeSchoolId ?? undefined)
      await queryClient.cancelQueries({ queryKey: queryKeys.itBoard.all })
      const prev = queryClient.getQueryData(boardKey)

      queryClient.setQueryData(boardKey, (old: Record<string, KanbanTicket[]> | undefined) => {
        if (!old) return old
        const updated: Record<string, KanbanTicket[]> = {}
        for (const [col, tickets] of Object.entries(old)) {
          updated[col] = (tickets as KanbanTicket[]).filter((t) => t.id !== ticketId)
        }
        const ticket = Object.values(old).flat().find((t: unknown) => (t as KanbanTicket).id === ticketId) as KanbanTicket | undefined
        if (ticket && updated[status]) {
          updated[status] = [...updated[status], { ...ticket, status }]
        }
        return updated
      })

      return { prev, boardKey }
    },
    onError: (err, _vars, context) => {
      if (context?.prev && context?.boardKey) {
        queryClient.setQueryData(context.boardKey, context.prev)
      }
      const msg = err instanceof Error && err.message.includes('permission')
        ? "You don't have permission to change ticket status."
        : 'Failed to update ticket status.'
      toast(msg, 'error')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
    },
  })

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    const columns = boardData as Record<string, KanbanTicket[]> | undefined
    if (!columns) return
    const ticket = Object.values(columns).flat().find((t) => t.id === id)
    if (ticket) setActiveTicket(ticket)
  }, [boardData])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTicket(null)
    const { active, over } = event
    if (!over) return

    const ticketId = active.id as string
    const targetColumn = over.id as string

    // Only handle drops onto columns (not onto other cards)
    if (!BOARD_COLUMNS.includes(targetColumn as typeof BOARD_COLUMNS[number])) return

    // Find the ticket's current status
    const columns = boardData as Record<string, KanbanTicket[]> | undefined
    if (!columns) return
    const ticket = Object.values(columns).flat().find((t) => t.id === ticketId)
    if (!ticket || ticket.status === targetColumn) return

    // Handle ON_HOLD requiring a reason — show dialog instead of window.prompt
    if (targetColumn === 'ON_HOLD') {
      setHoldPending({ ticketId, title: ticket.title ?? 'Untitled' })
      return
    } else {
      statusMutation.mutate({ ticketId, status: targetColumn })
    }
  }, [boardData])

  const handleHoldConfirm = useCallback((holdReason: string) => {
    if (!holdPending) return
    statusMutation.mutate({ ticketId: holdPending.ticketId, status: 'ON_HOLD', holdReason })
    setHoldPending(null)
  }, [holdPending, statusMutation])

  const handleUrgentClick = useCallback(() => {
    setFilterPriority('URGENT')
  }, [])

  if (isError) return <ITErrorState onRetry={refetch} />
  if (isLoading) return <BoardSkeleton />

  const hasActiveFilters = filterIssueType || filterPriority || filterUnassigned

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Urgent banner */}
      {urgentCount > 0 && (
        <button
          onClick={handleUrgentClick}
          className="w-full mb-4 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl cursor-pointer hover:from-red-600 hover:to-red-700 transition-all active:scale-[0.99]"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            {urgentCount} urgent ticket{urgentCount !== 1 ? 's' : ''} require{urgentCount === 1 ? 's' : ''} attention
          </span>
        </button>
      )}

      {/* Filter toolbar */}
      <div className="mb-4">
        <ITSearchFilterBar
          search=""
          onSearchChange={() => {}}
          searchPlaceholder="Search board..."
          filters={[
            { label: 'Issue Type', value: filterIssueType, onChange: setFilterIssueType, options: ISSUE_TYPE_OPTIONS },
            { label: 'Priority', value: filterPriority, onChange: setFilterPriority, options: PRIORITY_OPTIONS },
          ]}
        />
        <div className="flex items-center gap-3 mt-2 px-1">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterUnassigned}
              onChange={(e) => setFilterUnassigned(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            Unassigned only
          </label>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterIssueType('')
                setFilterPriority('')
                setFilterUnassigned(false)
              }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((status) => (
          <ITKanbanColumn
            key={status}
            status={status}
            tickets={filteredBoardData[status] ?? []}
            onTicketClick={onTicketClick}
          />
        ))}
      </div>

      {/* Completed tickets toggle */}
      <div className="mt-6">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          {showCompleted ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Completed (last 7 days)
          {showCompleted && completedTickets.length > 0 && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
              {completedTickets.length}
            </span>
          )}
        </button>

        {showCompleted && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            {completedTickets.length === 0 ? (
              <p className="text-sm text-slate-400 col-span-full py-4 text-center">
                No completed or cancelled tickets in the last 7 days
              </p>
            ) : (
              completedTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => onTicketClick(ticket.id)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-left cursor-pointer opacity-75 hover:opacity-100"
                >
                  <div className="flex-shrink-0">
                    {ticket.status === 'DONE' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{ticket.ticketNumber}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        ticket.status === 'DONE'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {ticket.status === 'DONE' ? 'Resolved' : 'Cancelled'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 truncate mt-0.5">{ticket.title}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeTicket ? (
          <div className="rotate-2 scale-105">
            <ITKanbanCard ticket={activeTicket} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>

      <HoldReasonDialog
        isOpen={!!holdPending}
        ticketTitle={holdPending?.title ?? ''}
        onConfirm={handleHoldConfirm}
        onCancel={() => setHoldPending(null)}
      />
    </DndContext>
  )
}
