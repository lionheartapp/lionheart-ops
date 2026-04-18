import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { QueryClient } from '@tanstack/react-query'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'
import type { RecurringEditMode } from '@/components/calendar/RecurringEditDialog'

function isRecurring(event: CalendarEventData): boolean {
  return !!(event.rrule || event.parentEventId)
}

interface UseCalendarDeleteFlowParams {
  deleteEvent: {
    mutateAsync: (data: { id: string; editMode?: RecurringEditMode }) => Promise<unknown>
    isPending: boolean
  }
  queryClient: QueryClient
  onDeleted: () => void
}

export function useCalendarDeleteFlow({
  deleteEvent,
  queryClient,
  onDeleted,
}: UseCalendarDeleteFlowParams) {
  const [pendingDelete, setPendingDelete] = useState<CalendarEventData | null>(null)
  const [deleteRecurringMode, setDeleteRecurringMode] = useState<RecurringEditMode | null>(null)
  const [showCancellationNotify, setShowCancellationNotify] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteEvent = useCallback((event: CalendarEventData) => {
    setPendingDelete(event)
    setDeleteRecurringMode(null)
    setDeleteError(null)
  }, [])

  const handleDeleteRecurringConfirm = useCallback((mode: RecurringEditMode) => {
    setDeleteRecurringMode(mode)
  }, [])

  const confirmDeleteEvent = useCallback(async () => {
    if (!pendingDelete) return
    try {
      setDeleteError(null)
      const editMode = isRecurring(pendingDelete) ? (deleteRecurringMode || 'all') : 'all'
      await deleteEvent.mutateAsync({ id: pendingDelete.id, editMode })
      onDeleted()
      setPendingDelete(null)
      setDeleteRecurringMode(null)
      setShowCancellationNotify(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete event'
      logger.error({ error: msg }, 'Delete event failed')

      // Ghost event — already deleted or doesn't exist. Refresh the calendar.
      if (msg.toLowerCase().includes('not found')) {
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
        onDeleted()
        setPendingDelete(null)
        setDeleteRecurringMode(null)
        return
      }

      setDeleteError(msg)
    }
  }, [deleteEvent, pendingDelete, deleteRecurringMode, queryClient, onDeleted])

  const cancelPendingDelete = useCallback(() => {
    setPendingDelete(null)
    setDeleteRecurringMode(null)
    setDeleteError(null)
  }, [])

  return {
    pendingDelete,
    deleteRecurringMode,
    showCancellationNotify,
    deleteError,
    handleDeleteEvent,
    handleDeleteRecurringConfirm,
    confirmDeleteEvent,
    cancelPendingDelete,
    setShowCancellationNotify,
    isRecurring,
  }
}
