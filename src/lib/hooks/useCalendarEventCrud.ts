import { useState, useCallback } from 'react'
import { logger } from '@/lib/logger'
import type { EventFormData } from '@/components/calendar/EventCreatePanel'

interface ConflictWarning {
  conflictingEventTitle: string
  conflictingStart: string
  conflictingEnd: string
  bufferMinutes: number
  location: string
}

interface PendingConflictPayload {
  type: 'create' | 'update'
  payload: Record<string, unknown>
}

interface UseCalendarEventCrudParams {
  createEvent: {
    mutateAsync: (data: Record<string, unknown>) => Promise<unknown>
  }
  updateEvent: {
    mutateAsync: (data: { id: string } & Record<string, unknown>) => Promise<unknown>
  }
  editingEvent: { id: string } | null
  toast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
  onCreateSuccess: () => void
  onUpdateSuccess: () => void
}

export function useCalendarEventCrud({
  createEvent,
  updateEvent,
  editingEvent,
  toast,
  onCreateSuccess,
  onUpdateSuccess,
}: UseCalendarEventCrudParams) {
  const [formError, setFormError] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<ConflictWarning | null>(null)
  const [pendingConflictPayload, setPendingConflictPayload] = useState<PendingConflictPayload | null>(null)

  const handleSubmitEvent = useCallback(async (data: EventFormData) => {
    setFormError(null)
    try {
      const { categoryId, rrule, buildingId, areaId, attendeeIds, ...rest } = data
      const payload: Record<string, unknown> = {
        ...rest,
        ...(categoryId ? { categoryId } : {}),
        ...(rrule ? { rrule } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(areaId ? { areaId } : {}),
        ...(attendeeIds && attendeeIds.length > 0 ? { attendeeIds } : {}),
      }
      await createEvent.mutateAsync(payload)
      onCreateSuccess()
      toast('Event created successfully', 'success')
    } catch (err: unknown) {
      const apiErr = err as Error & { code?: string; details?: Record<string, unknown> }
      if (apiErr.code === 'LOCATION_CONFLICT' && apiErr.details) {
        setConflictWarning(apiErr.details as unknown as ConflictWarning)
        const { categoryId, rrule, buildingId, areaId, attendeeIds, ...rest } = data
        setPendingConflictPayload({
          type: 'create',
          payload: {
            ...rest,
            ...(categoryId ? { categoryId } : {}),
            ...(rrule ? { rrule } : {}),
            ...(buildingId ? { buildingId } : {}),
            ...(areaId ? { areaId } : {}),
            ...(attendeeIds && attendeeIds.length > 0 ? { attendeeIds } : {}),
          },
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to create event'
      setFormError(message)
      logger.error({ error: String(err) }, 'Event creation failed')
    }
  }, [createEvent, toast, onCreateSuccess])

  const handleUpdateEvent = useCallback(async (data: EventFormData) => {
    if (!editingEvent) return
    setFormError(null)
    try {
      const { categoryId, calendarId, rrule, buildingId, areaId, ...rest } = data
      const payload: Record<string, unknown> = {
        id: editingEvent.id,
        ...rest,
        ...(categoryId ? { categoryId } : {}),
        ...(rrule ? { rrule } : {}),
        ...(buildingId ? { buildingId } : {}),
        ...(areaId ? { areaId } : {}),
      }
      await updateEvent.mutateAsync(payload as { id: string } & Record<string, unknown>)
      onUpdateSuccess()
      toast('Event updated successfully', 'success')
    } catch (err: unknown) {
      const apiErr = err as Error & { code?: string; details?: Record<string, unknown> }
      if (apiErr.code === 'LOCATION_CONFLICT' && apiErr.details) {
        setConflictWarning(apiErr.details as unknown as ConflictWarning)
        const { categoryId, calendarId, rrule, buildingId, areaId, ...rest } = data
        setPendingConflictPayload({
          type: 'update',
          payload: {
            id: editingEvent.id,
            ...rest,
            ...(categoryId ? { categoryId } : {}),
            ...(rrule ? { rrule } : {}),
            ...(buildingId ? { buildingId } : {}),
            ...(areaId ? { areaId } : {}),
          },
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to update event'
      setFormError(message)
      logger.error({ error: String(err) }, 'Event update failed')
    }
  }, [updateEvent, editingEvent, toast, onUpdateSuccess])

  const handleOverrideConflict = useCallback(async () => {
    if (!pendingConflictPayload) return
    setConflictWarning(null)
    try {
      if (pendingConflictPayload.type === 'create') {
        await createEvent.mutateAsync({ ...pendingConflictPayload.payload, skipConflictCheck: true })
      } else {
        await updateEvent.mutateAsync({ ...pendingConflictPayload.payload, skipConflictCheck: true } as unknown as { id: string } & Record<string, unknown>)
      }
      onUpdateSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save event'
      setFormError(message)
    }
    setPendingConflictPayload(null)
  }, [pendingConflictPayload, createEvent, updateEvent, onUpdateSuccess])

  const handleCancelConflict = useCallback(() => {
    setConflictWarning(null)
    setPendingConflictPayload(null)
  }, [])

  return {
    handleSubmitEvent,
    handleUpdateEvent,
    handleOverrideConflict,
    handleCancelConflict,
    conflictWarning,
    formError,
    setFormError,
  }
}
