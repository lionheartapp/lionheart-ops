import { useState, useCallback } from 'react'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'
import type { RecurringEditMode } from '@/components/calendar/RecurringEditDialog'

function isRecurring(event: CalendarEventData): boolean {
  return !!(event.rrule || event.parentEventId)
}

interface PendingChange {
  event: CalendarEventData
  newStart: string
  newEnd: string
  type: 'drag' | 'resize'
}

interface UseCalendarDragResizeParams {
  reschedule: (params: {
    event: CalendarEventData
    newStartTime: string
    newEndTime: string
    editMode: RecurringEditMode
    notify: boolean
  }) => void
}

export function useCalendarDragResize({ reschedule }: UseCalendarDragResizeParams) {
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null)
  const [recurringMode, setRecurringMode] = useState<RecurringEditMode | null>(null)
  const [showNotifyDialog, setShowNotifyDialog] = useState(false)
  const [pendingEditMode, setPendingEditMode] = useState<RecurringEditMode>('all')

  const executePendingChange = useCallback((notify: boolean) => {
    if (!pendingChange) return
    reschedule({
      event: pendingChange.event,
      newStartTime: pendingChange.newStart,
      newEndTime: pendingChange.newEnd,
      editMode: pendingEditMode,
      notify,
    })
    setPendingChange(null)
    setPendingEditMode('all')
    setShowNotifyDialog(false)
  }, [pendingChange, pendingEditMode, reschedule])

  const handleDragReschedule = useCallback((event: CalendarEventData, deltaMinutes: number, deltaDays: number) => {
    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const newStart = new Date(start.getTime() + deltaMinutes * 60_000 + deltaDays * 86_400_000)
    const newEnd = new Date(end.getTime() + deltaMinutes * 60_000 + deltaDays * 86_400_000)

    const change: PendingChange = {
      event,
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
      type: 'drag',
    }
    setPendingChange(change)
    if (isRecurring(event)) {
      // Recurring → show RecurringEditDialog first, then notify dialog
      setRecurringMode('all')
    } else {
      // Non-recurring → show notify dialog directly
      setPendingEditMode('all')
      setShowNotifyDialog(true)
    }
  }, [])

  const handleResize = useCallback((event: CalendarEventData, deltaMinutes: number) => {
    const newEnd = new Date(new Date(event.endTime).getTime() + deltaMinutes * 60_000)

    const change: PendingChange = {
      event,
      newStart: event.startTime,
      newEnd: newEnd.toISOString(),
      type: 'resize',
    }
    setPendingChange(change)
    if (isRecurring(event)) {
      setRecurringMode('all')
    } else {
      setPendingEditMode('all')
      setShowNotifyDialog(true)
    }
  }, [])

  // Called after recurring dialog confirms a mode — show notify dialog next
  const handleRecurringConfirm = useCallback((mode: RecurringEditMode) => {
    setPendingEditMode(mode)
    setRecurringMode(null)
    setShowNotifyDialog(true)
  }, [])

  const cancelPendingChange = useCallback(() => {
    setPendingChange(null)
    setRecurringMode(null)
    setPendingEditMode('all')
    setShowNotifyDialog(false)
  }, [])

  return {
    pendingChange,
    recurringMode,
    showNotifyDialog,
    pendingEditMode,
    isRecurring,
    executePendingChange,
    handleDragReschedule,
    handleResize,
    handleRecurringConfirm,
    cancelPendingChange,
  }
}
