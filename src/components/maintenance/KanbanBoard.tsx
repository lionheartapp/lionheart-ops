'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/Toast'
import KanbanColumn from './KanbanColumn'
import KanbanCard from './KanbanCard'
import TechnicianAssignPanel from './TechnicianAssignPanel'
import HoldReasonInlineForm from './HoldReasonInlineForm'
import QACompletionModal from './QACompletionModal'
import WorkOrdersFilters, { type WorkOrdersFilterState } from './WorkOrdersFilters'
import { isBoardTransitionAllowed } from '@/lib/maintenance-transitions'
import type { WorkOrderTicket } from './WorkOrdersTable'
import { fetchApi } from '@/lib/api-client'

// ─── Constants ────────────────────────────────────────────────────────────────

export const BOARD_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD', 'QA', 'DONE'] as const
type BoardColumn = (typeof BOARD_COLUMNS)[number]

type BoardViewTab = 'my-board' | 'team-board'

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface KanbanBoardProps {
  tickets: WorkOrderTicket[]
  isLoading: boolean
  filters: WorkOrdersFilterState
  onFilterChange: (f: WorkOrdersFilterState) => void
  technicians: Technician[]
  currentUserId: string
  canManage: boolean
  /** Called after a successful optimistic status change so parent can invalidate */
  queryKeys: unknown[][]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidTransition(fromStatus: string, toStatus: string): boolean {
  return isBoardTransitionAllowed(fromStatus, toStatus)
}

function groupByStatus(tickets: WorkOrderTicket[]): Record<string, WorkOrderTicket[]> {
  const groups: Record<string, WorkOrderTicket[]> = {}
  for (const col of BOARD_COLUMNS) {
    groups[col] = []
  }
  for (const ticket of tickets) {
    if (ticket.status in groups) {
      groups[ticket.status].push(ticket)
    }
  }
  return groups
}

// ─── Main Board Component ─────────────────────────────────────────────────────

export default function KanbanBoard({
  tickets,
  isLoading,
  filters,
  onFilterChange,
  technicians,
  currentUserId,
  canManage,
  queryKeys,
}: KanbanBoardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Board view tab state — default to team-board for managers, my-board for technicians
  const [boardView, setBoardView] = useState<BoardViewTab>(canManage ? 'team-board' : 'my-board')

  // DnD state
  const [activeTicket, setActiveTicket] = useState<WorkOrderTicket | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)

  // Gate modal state
  const [holdPending, setHoldPending] = useState<{ ticketId: string } | null>(null)
  const [qaPending, setQaPending] = useState<{ ticketId: string } | null>(null)

  // Optimistic local ticket state
  const [localTickets, setLocalTickets] = useState<WorkOrderTicket[] | null>(null)

  // Use localTickets if set (optimistic), otherwise use prop tickets
  const displayTickets = localTickets ?? tickets

  // Filter tickets by board view tab
  const filteredByView = useMemo(() => {
    if (boardView === 'my-board') {
      return displayTickets.filter((t) => t.assignedTo?.id === currentUserId)
    }
    // 'team-board' shows all tickets (already filtered by campus via parent)
    return displayTickets
  }, [displayTickets, boardView, currentUserId])

  const grouped = useMemo(() => groupByStatus(filteredByView), [filteredByView])

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  // Compute valid/invalid for currently dragged ticket and hovered column
  const overColumnValidity = useMemo<boolean | null>(() => {
    if (!activeTicket || !overColumnId) return null
    return isValidTransition(activeTicket.status, overColumnId)
  }, [activeTicket, overColumnId])

  // ─── DnD handlers ────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    const ticket = displayTickets.find((t) => t.id === id)
    if (ticket) {
      setActiveTicket(ticket)
      setLocalTickets(null) // clear any stale optimistic state
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | undefined
    if (!overId) {
      setOverColumnId(null)
      return
    }
    // overId can be a column status string or a card id
    if ((BOARD_COLUMNS as readonly string[]).includes(overId)) {
      setOverColumnId(overId)
    } else {
      // Card is over another card — find its column
      const overTicket = displayTickets.find((t) => t.id === overId)
      if (overTicket) setOverColumnId(overTicket.status)
    }
  }

  const invalidateAll = useCallback(() => {
    for (const key of queryKeys) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }, [queryClient, queryKeys])

  async function handleDragEnd(event: DragEndEvent) {
    const draggedTicket = activeTicket
    setActiveTicket(null)
    setOverColumnId(null)

    if (!event.over || !draggedTicket) return

    const overId = event.over.id as string

    // ─── Dropped on a technician avatar ────────────────────────────────────
    if (overId.startsWith('tech-')) {
      const techId = overId.replace('tech-', '')
      try {
        await fetchApi(`/api/maintenance/tickets/${draggedTicket.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ assignedToId: techId }),
        })
        invalidateAll()
        toast('Ticket assigned', 'success')
      } catch {
        toast('Failed to assign ticket', 'error')
      }
      return
    }

    // ─── Resolve target column ──────────────────────────────────────────────
    let targetStatus: string
    if ((BOARD_COLUMNS as readonly string[]).includes(overId)) {
      targetStatus = overId
    } else {
      // Dropped on a card — use that card's column
      const overTicket = displayTickets.find((t) => t.id === overId)
      if (!overTicket) return
      targetStatus = overTicket.status
    }

    // No-op if same column
    if (targetStatus === draggedTicket.status) return

    // ─── Validate transition ────────────────────────────────────────────────
    if (!isValidTransition(draggedTicket.status, targetStatus)) {
      toast(
        `Cannot move from ${draggedTicket.status.replace('_', ' ')} to ${targetStatus.replace('_', ' ')}`,
        'error'
      )
      return
    }

    // ─── Gate: ON_HOLD requires hold reason modal ───────────────────────────
    if (targetStatus === 'ON_HOLD') {
      setHoldPending({ ticketId: draggedTicket.id })
      return
    }

    // ─── Gate: QA requires completion modal ────────────────────────────────
    if (targetStatus === 'QA') {
      setQaPending({ ticketId: draggedTicket.id })
      return
    }

    // ─── Non-gated: optimistic update ──────────────────────────────────────
    const snapshot = localTickets ?? tickets
    setLocalTickets(
      (localTickets ?? tickets).map((t) =>
        t.id === draggedTicket.id ? { ...t, status: targetStatus } : t
      )
    )

    try {
      await fetchApi(`/api/maintenance/tickets/${draggedTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus }),
      })
      invalidateAll()
      setLocalTickets(null)
    } catch {
      // Rollback
      setLocalTickets(snapshot)
      toast('Failed to update status', 'error')
    }
  }

  // ─── Gate modal callbacks ─────────────────────────────────────────────────

  function handleHoldComplete() {
    setHoldPending(null)
    invalidateAll()
    toast('Ticket placed on hold', 'success')
  }

  function handleHoldCancel() {
    setHoldPending(null)
  }

  function handleQAComplete() {
    setQaPending(null)
    invalidateAll()
    toast('Ticket submitted for QA', 'success')
  }

  function handleQAClose() {
    setQaPending(null)
  }

  // ─── Skeleton ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse w-64" />
        <div className="flex gap-3 overflow-hidden">
          {BOARD_COLUMNS.map((col) => (
            <div key={col} className="min-w-[280px] bg-gray-50/60 rounded-2xl p-3 space-y-2 flex-shrink-0">
              <div className="h-6 bg-gray-100 rounded animate-pulse w-24 mb-3" />
              {[1, 2].map((i) => (
                <div key={i} className="bg-white/80 rounded-xl p-3 animate-pulse space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-16" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* View tabs */}
      <div className="flex items-center gap-1">
        {(
          [
            { key: 'my-board', label: 'My Board' },
            ...(canManage ? [{ key: 'team-board', label: 'Team Board' }] : []),
          ] as { key: BoardViewTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setBoardView(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              boardView === key
                ? 'bg-gray-900 text-white border border-gray-900'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <WorkOrdersFilters
        filters={filters}
        onChange={onFilterChange}
        technicians={technicians}
      />

      {/* Mobile notice */}
      <p className="lg:hidden text-xs text-gray-400 text-center py-1">
        Swipe between columns. Tap a ticket to manage it.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Technician assign panel — only for managers */}
        {canManage && technicians.length > 0 && (
          <TechnicianAssignPanel
            technicians={technicians}
            isDragging={!!activeTicket}
          />
        )}

        {/* Kanban columns */}
        <div className="flex gap-3 overflow-x-auto pb-4 lg:overflow-x-auto snap-x snap-mandatory lg:snap-none">
          {BOARD_COLUMNS.map((col) => {
            // Compute valid/invalid for this column
            let validity: boolean | null = null
            if (activeTicket) {
              validity = isValidTransition(activeTicket.status, col)
            }

            return (
              <div key={col} className="snap-center lg:snap-none min-w-[85vw] lg:min-w-[280px]">
                <KanbanColumn
                  status={col}
                  tickets={grouped[col] ?? []}
                  isValidTarget={validity}
                  pendingTicketId={
                    (holdPending?.ticketId ?? qaPending?.ticketId) ?? null
                  }
                />
              </div>
            )
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTicket ? (
            <KanbanCard ticket={activeTicket} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Hold reason gate modal */}
      {holdPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="ui-glass-overlay w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Place Ticket On Hold</h3>
            <HoldReasonInlineForm
              ticketId={holdPending.ticketId}
              onComplete={handleHoldComplete}
              onCancel={handleHoldCancel}
            />
          </div>
        </div>
      )}

      {/* QA completion gate modal */}
      <QACompletionModal
        ticketId={qaPending?.ticketId ?? ''}
        open={!!qaPending}
        onClose={handleQAClose}
        onComplete={handleQAComplete}
      />
    </div>
  )
}
