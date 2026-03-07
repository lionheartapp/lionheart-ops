'use client'

import { useState, useCallback } from 'react'
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

interface ITKanbanBoardProps {
  onTicketClick: (id: string) => void
}

const BOARD_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'ON_HOLD'] as const

export default function ITKanbanBoard({ onTicketClick }: ITKanbanBoardProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTicket, setActiveTicket] = useState<KanbanTicket | null>(null)
  const [holdPending, setHoldPending] = useState<{ ticketId: string; title: string } | null>(null)

  const { data: boardData, isLoading } = useQuery(queryOptions.itBoard())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

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
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.itBoard.all })
      const prev = queryClient.getQueryData(queryKeys.itBoard.filtered())

      queryClient.setQueryData(queryKeys.itBoard.filtered(), (old: Record<string, KanbanTicket[]> | undefined) => {
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

      return { prev }
    },
    onError: (err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(queryKeys.itBoard.filtered(), context.prev)
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

  if (isLoading) return <BoardSkeleton />

  const columns = (boardData ?? {}) as Record<string, KanbanTicket[]>

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {BOARD_COLUMNS.map((status) => (
          <ITKanbanColumn
            key={status}
            status={status}
            tickets={columns[status] ?? []}
            onTicketClick={onTicketClick}
          />
        ))}
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
