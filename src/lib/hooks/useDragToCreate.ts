'use client'

import { useCallback, useRef, useState } from 'react'

const HOUR_HEIGHT = 64
const START_HOUR = 0
const SNAP_MINUTES = 15
const MIN_DRAG_PX = 4

interface DragState {
  /** The date column being dragged in */
  dayDate: Date
  /** Start minutes from midnight (snapped) */
  startMinutes: number
  /** Current end minutes from midnight (snapped) */
  endMinutes: number
}

interface UseDragToCreateOptions {
  onSlotClick: (start: Date, end: Date) => void
}

function yToMinutes(y: number): number {
  const raw = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES
}

function minutesToY(minutes: number): number {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function clampMinutes(minutes: number): number {
  return Math.max(0, Math.min(24 * 60, minutes))
}

export function useDragToCreate({ onSlotClick }: UseDragToCreateOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const startYRef = useRef(0)
  const isDraggingRef = useRef(false)
  const dayDateRef = useRef<Date | null>(null)

  const handlePointerDown = useCallback((dayDate: Date, e: React.PointerEvent) => {
    // Only handle primary button (left click)
    if (e.button !== 0) return
    // Don't start drag on existing events
    if ((e.target as HTMLElement).closest('[data-event]')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutes = clampMinutes(yToMinutes(y))

    startYRef.current = e.clientY
    isDraggingRef.current = false
    dayDateRef.current = dayDate

    setDragState({
      dayDate,
      startMinutes: minutes,
      endMinutes: minutes + SNAP_MINUTES,
    })

    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dayDateRef.current) return

    const dy = Math.abs(e.clientY - startYRef.current)
    if (dy >= MIN_DRAG_PX) {
      isDraggingRef.current = true
    }

    if (isDraggingRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const y = e.clientY - rect.top
      const currentMinutes = clampMinutes(yToMinutes(y))

      setDragState(prev => {
        if (!prev) return prev
        // Always keep the original anchor; allow dragging in both directions
        const anchor = prev.startMinutes
        const startMinutes = Math.min(anchor, currentMinutes)
        const endMinutes = Math.max(anchor, currentMinutes + SNAP_MINUTES)
        // Ensure at least 15 min duration
        const finalEnd = endMinutes <= startMinutes ? startMinutes + SNAP_MINUTES : endMinutes
        return {
          ...prev,
          startMinutes: clampMinutes(startMinutes),
          endMinutes: clampMinutes(finalEnd),
        }
      })
    }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const currentDayDate = dayDateRef.current
    if (!currentDayDate) return

    e.currentTarget.releasePointerCapture(e.pointerId)

    setDragState(prev => {
      if (!prev) return null

      if (!isDraggingRef.current) {
        // Click — create 1-hour event
        const start = new Date(currentDayDate)
        start.setHours(0, prev.startMinutes, 0, 0)
        const end = new Date(currentDayDate)
        end.setHours(0, prev.startMinutes + 60, 0, 0)
        // Use setTimeout to avoid calling during render
        setTimeout(() => onSlotClick(start, end), 0)
      } else {
        // Drag — use the dragged range
        const start = new Date(currentDayDate)
        start.setHours(0, prev.startMinutes, 0, 0)
        const end = new Date(currentDayDate)
        end.setHours(0, prev.endMinutes, 0, 0)
        setTimeout(() => onSlotClick(start, end), 0)
      }

      return null
    })

    isDraggingRef.current = false
    dayDateRef.current = null
  }, [onSlotClick])

  const handlePointerCancel = useCallback(() => {
    setDragState(null)
    isDraggingRef.current = false
    dayDateRef.current = null
  }, [])

  // Ghost preview positioning
  const getGhostStyle = useCallback((dragDayDate: Date, columnDate: Date): React.CSSProperties | null => {
    if (!dragState) return null
    if (
      dragDayDate.getFullYear() !== columnDate.getFullYear() ||
      dragDayDate.getMonth() !== columnDate.getMonth() ||
      dragDayDate.getDate() !== columnDate.getDate()
    ) {
      return null
    }

    const top = minutesToY(dragState.startMinutes)
    const height = minutesToY(dragState.endMinutes) - top

    return {
      position: 'absolute' as const,
      top,
      height: Math.max(height, minutesToY(SNAP_MINUTES)),
      left: 4,
      right: 4,
      zIndex: 20,
      pointerEvents: 'none' as const,
    }
  }, [dragState])

  const getGhostLabel = useCallback((): string => {
    if (!dragState) return ''
    return `${formatTime(dragState.startMinutes)} – ${formatTime(dragState.endMinutes)}`
  }, [dragState])

  return {
    dragState,
    isDragging: isDraggingRef.current && dragState !== null,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    getGhostStyle,
    getGhostLabel,
  }
}
