'use client'

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateEvent, type CalendarEventData } from './useCalendar'
import { useToast } from '@/components/Toast'

interface RescheduleParams {
  event: CalendarEventData
  newStartTime: string
  newEndTime: string
  editMode?: 'this' | 'thisAndFollowing' | 'all'
  notify?: boolean
}

export function useDragReschedule() {
  const queryClient = useQueryClient()
  const updateEvent = useUpdateEvent()
  const { toast } = useToast()
  const undoRef = useRef<{ originalStart: string; originalEnd: string; eventId: string } | null>(null)

  const reschedule = useCallback(({ event, newStartTime, newEndTime, editMode = 'all', notify }: RescheduleParams) => {
    const originalStart = event.startTime
    const originalEnd = event.endTime

    // Optimistic update only works for 'all' mode — the API updates the event in place.
    // For 'this' (creates an exception) and 'thisAndFollowing' (splits the series),
    // the original event is NOT modified, so optimistic patching would revert on refetch.
    const canOptimistic = editMode === 'all'

    if (canOptimistic) {
      queryClient.setQueriesData<CalendarEventData[]>(
        { queryKey: ['calendar-events'] },
        (old) => {
          if (!old) return old
          return old.map((e) =>
            e.id === event.id ? { ...e, startTime: newStartTime, endTime: newEndTime } : e
          )
        }
      )
      undoRef.current = { originalStart, originalEnd, eventId: event.id }
    }

    // Fire mutation
    updateEvent.mutate(
      {
        id: event.id,
        startTime: newStartTime,
        endTime: newEndTime,
        editMode,
        ...(notify !== undefined ? { notify } : {}),
      },
      {
        onSuccess: () => {
          // Always invalidate so the server's authoritative state is reflected
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] })

          if (canOptimistic) {
            toast('Event rescheduled', 'success', {
              duration: 5000,
              action: {
                label: 'Undo',
                onClick: () => {
                  const saved = undoRef.current
                  if (!saved) return

                  // Revert cache
                  queryClient.setQueriesData<CalendarEventData[]>(
                    { queryKey: ['calendar-events'] },
                    (old) => {
                      if (!old) return old
                      return old.map((e) =>
                        e.id === saved.eventId
                          ? { ...e, startTime: saved.originalStart, endTime: saved.originalEnd }
                          : e
                      )
                    }
                  )

                  // Fire revert mutation
                  updateEvent.mutate(
                    {
                      id: saved.eventId,
                      startTime: saved.originalStart,
                      endTime: saved.originalEnd,
                      editMode,
                    },
                    {
                      onSuccess: () => {
                        toast('Change undone', 'info')
                        queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
                      },
                      onError: () => {
                        toast('Failed to undo', 'error')
                        queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
                      },
                    }
                  )
                },
              },
            })
          } else {
            toast('Event rescheduled', 'success')
          }
        },
        onError: () => {
          if (canOptimistic) {
            // Revert optimistic update on error
            queryClient.setQueriesData<CalendarEventData[]>(
              { queryKey: ['calendar-events'] },
              (old) => {
                if (!old) return old
                return old.map((e) =>
                  e.id === event.id ? { ...e, startTime: originalStart, endTime: originalEnd } : e
                )
              }
            )
          }
          toast('Failed to reschedule event', 'error')
        },
      }
    )
  }, [queryClient, updateEvent, toast])

  return { reschedule }
}
