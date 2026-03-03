'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'

const HOUR_HEIGHT = 64
const SNAP_PX = HOUR_HEIGHT / 4 // 16px = 15 minutes
const MIN_HEIGHT = 28

interface DraggableEventProps {
  event: CalendarEventData
  top: number
  height: number
  date: Date
  siblingEvents: CalendarEventData[]
  onDragReschedule: (event: CalendarEventData, deltaMinutes: number, deltaDays: number) => void
  onResize?: (event: CalendarEventData, deltaMinutes: number) => void
  onClick: (event: CalendarEventData) => void
  dragAxis: 'y' | 'both'
  columnWidth?: number
  weekDates?: Date[]
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  subColumnStyle?: { left: string; width: string }
  readOnly?: boolean
}

function snapToGrid(px: number): number {
  return Math.round(px / SNAP_PX) * SNAP_PX
}

function checkConflict(
  event: CalendarEventData,
  deltaMinutes: number,
  deltaDays: number,
  siblings: CalendarEventData[]
): boolean {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const duration = end.getTime() - start.getTime()

  const newStart = new Date(start.getTime() + deltaMinutes * 60_000 + deltaDays * 86_400_000)
  const newEnd = new Date(newStart.getTime() + duration)

  return siblings.some((s) => {
    if (s.id === event.id) return false
    const sStart = new Date(s.startTime)
    const sEnd = new Date(s.endTime)
    return newStart < sEnd && newEnd > sStart
  })
}

function checkResizeConflict(
  event: CalendarEventData,
  deltaMinutes: number,
  siblings: CalendarEventData[]
): boolean {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const newEnd = new Date(end.getTime() + deltaMinutes * 60_000)

  // Ensure minimum 15-min duration
  if (newEnd.getTime() - start.getTime() < 15 * 60_000) return true

  return siblings.some((s) => {
    if (s.id === event.id) return false
    const sStart = new Date(s.startTime)
    const sEnd = new Date(s.endTime)
    return start < sEnd && newEnd > sStart
  })
}

export default function DraggableEvent({
  event,
  top,
  height,
  date,
  siblingEvents,
  onDragReschedule,
  onResize,
  onClick,
  dragAxis,
  columnWidth,
  weekDates,
  children,
  className = '',
  style = {},
  subColumnStyle,
  readOnly = false,
}: DraggableEventProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [hasConflict, setHasConflict] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const totalOffsetRef = useRef(0)

  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDeltaPx, setResizeDeltaPx] = useState(0)
  const [resizeConflict, setResizeConflict] = useState(false)
  const resizeStartYRef = useRef(0)
  // Tracks when a resize just finished — prevents click from opening detail panel
  const justResizedAtRef = useRef(0)

  const handleDragStart = (_: unknown, info: PanInfo) => {
    if (isResizing) return
    dragStartRef.current = { x: info.point.x, y: info.point.y }
    totalOffsetRef.current = 0
    setIsDragging(true)
    setHasConflict(false)
  }

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (isResizing) return
    const snappedY = snapToGrid(info.offset.y)
    const deltaMinutes = (snappedY / HOUR_HEIGHT) * 60

    let deltaDays = 0
    if (dragAxis === 'both' && columnWidth && columnWidth > 0) {
      deltaDays = Math.round(info.offset.x / columnWidth)
    }

    const conflict = checkConflict(event, deltaMinutes, deltaDays, siblingEvents)
    setHasConflict(conflict)
    totalOffsetRef.current = Math.abs(info.offset.x) + Math.abs(info.offset.y)
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (isResizing) return
    setIsDragging(false)
    setHasConflict(false)

    // Click detection: if drag distance < 3px, treat as click
    if (totalOffsetRef.current < 3) {
      onClick(event)
      return
    }

    const snappedY = snapToGrid(info.offset.y)
    const deltaMinutes = (snappedY / HOUR_HEIGHT) * 60

    let deltaDays = 0
    if (dragAxis === 'both' && columnWidth && columnWidth > 0) {
      deltaDays = Math.round(info.offset.x / columnWidth)
    }

    // Only fire reschedule if there's an actual time change
    if (deltaMinutes === 0 && deltaDays === 0) return

    // Don't reschedule if there's a conflict
    if (checkConflict(event, deltaMinutes, deltaDays, siblingEvents)) return

    onDragReschedule(event, deltaMinutes, deltaDays)
  }

  // Resize: use refs to avoid stale closures in document-level listeners
  const resizeEventRef = useRef(event)
  const resizeSiblingsRef = useRef(siblingEvents)
  const resizeHeightRef = useRef(height)
  const onResizeRef = useRef(onResize)
  resizeEventRef.current = event
  resizeSiblingsRef.current = siblingEvents
  resizeHeightRef.current = height
  onResizeRef.current = onResize

  // Finish resize — shared cleanup used by pointerup, pointercancel, and Escape
  const finishResize = useCallback((clientY?: number) => {
    setIsResizing(false)
    setResizeConflict(false)

    if (clientY !== undefined && onResizeRef.current) {
      const snapped = snapToGrid(clientY - resizeStartYRef.current)
      const deltaMinutes = (snapped / HOUR_HEIGHT) * 60

      const currentDuration =
        new Date(resizeEventRef.current.endTime).getTime() -
        new Date(resizeEventRef.current.startTime).getTime()
      const newDuration = currentDuration + deltaMinutes * 60_000
      const clampedDelta =
        newDuration < 15 * 60_000
          ? Math.ceil((15 * 60_000 - currentDuration) / 60_000)
          : deltaMinutes

      if (clampedDelta !== 0 && !checkResizeConflict(resizeEventRef.current, clampedDelta, resizeSiblingsRef.current)) {
        // Keep resizeDeltaPx so the event stays at its new height until data refetches
        justResizedAtRef.current = Date.now()
        onResizeRef.current(resizeEventRef.current, clampedDelta)
      } else {
        // No actual change or conflict — reset visuals
        setResizeDeltaPx(0)
      }
    } else {
      // Cancelled — just reset visuals
      setResizeDeltaPx(0)
    }
  }, [])

  // Document-level pointermove / pointerup while resizing
  useEffect(() => {
    if (!isResizing) return

    const onMove = (e: PointerEvent) => {
      const rawDelta = e.clientY - resizeStartYRef.current
      const snapped = snapToGrid(rawDelta)
      const deltaMinutes = (snapped / HOUR_HEIGHT) * 60

      const newHeight = resizeHeightRef.current + snapped
      if (newHeight < MIN_HEIGHT) {
        setResizeDeltaPx(MIN_HEIGHT - resizeHeightRef.current)
        return
      }

      setResizeDeltaPx(snapped)
      setResizeConflict(checkResizeConflict(resizeEventRef.current, deltaMinutes, resizeSiblingsRef.current))
    }

    const onUp = (e: PointerEvent) => {
      finishResize(e.clientY)
    }

    const onCancel = () => {
      finishResize() // no clientY → cancelled, just reset
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishResize() // Escape cancels resize
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isResizing, finishResize])

  // Resize handle: only pointerdown needs to be on the element
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onResize) return
    e.stopPropagation()
    e.preventDefault()
    resizeStartYRef.current = e.clientY
    setIsResizing(true)
    setResizeDeltaPx(0)
    setResizeConflict(false)
  }, [onResize])

  // When event data is refetched (endTime changes), clear the optimistic resize delta
  const prevEndTimeRef = useRef(event.endTime)
  useEffect(() => {
    if (event.endTime !== prevEndTimeRef.current) {
      prevEndTimeRef.current = event.endTime
      setResizeDeltaPx(0)
    }
  }, [event.endTime])

  const eventColor = getEventColor(event)
  // Keep optimistic height while resizing OR while waiting for data to refetch after commit
  const displayHeight = resizeDeltaPx !== 0 ? Math.max(height + resizeDeltaPx, MIN_HEIGHT) : height

  // Read-only events (other people's events in meet-with mode)
  if (readOnly) {
    return (
      <div
        data-event
        className="relative"
        style={{
          position: 'absolute',
          top,
          ...(subColumnStyle
            ? { left: subColumnStyle.left, width: subColumnStyle.width }
            : { left: 0, right: 0 }),
        }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClick(event) }}
          aria-label={getEventAriaLabel(event)}
          className={`absolute left-1 right-1 rounded-xl px-3 py-2 text-left overflow-hidden z-[1] hover:z-[2] hover:shadow-medium transition-[box-shadow,background-color] cursor-pointer ${className}`}
          style={{
            ...style,
            height: displayHeight,
            backgroundColor: `${eventColor}20`,
            top: 0,
          }}
        >
          {children}
        </button>
      </div>
    )
  }

  return (
    <div
      data-event
      className="relative"
      style={{
        position: 'absolute',
        top,
        ...(subColumnStyle
          ? { left: subColumnStyle.left, width: subColumnStyle.width }
          : { left: 0, right: 0 }),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Ghost placeholder (original position) */}
      {(isDragging || isResizing) && (
        <div
          className="absolute left-1 right-1 rounded-xl opacity-30 pointer-events-none"
          style={{
            height,
            backgroundColor: `${eventColor}20`,
          }}
        />
      )}

      {/* Draggable event */}
      <motion.button
        drag={isResizing ? false : (dragAxis === 'both' ? true : 'y')}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation()
          // Skip click if a resize just finished (pointer-up fires click on the same element)
          if (Date.now() - justResizedAtRef.current < 300) return
          // Fallback click: if onDragEnd didn't fire (zero pointer movement),
          // totalOffsetRef stays at 0 — treat as a genuine click.
          if (!isDragging && !isResizing && totalOffsetRef.current < 3) {
            onClick(event)
          }
        }}
        aria-label={getEventAriaLabel(event)}
        className={`absolute left-1 right-1 rounded-xl px-3 py-2 text-left overflow-hidden transition-shadow ${className} ${
          isResizing
            ? resizeConflict
              ? 'shadow-heavy ring-2 ring-red-400 z-[5]'
              : 'shadow-heavy ring-2 ring-blue-400 z-[5]'
            : isDragging
              ? hasConflict
                ? 'shadow-heavy ring-2 ring-red-400 z-[5]'
                : 'shadow-heavy ring-2 ring-blue-400 z-[5]'
              : 'z-[1] hover:z-[2] hover:shadow-medium hover:scale-[1.02] cursor-grab active:cursor-grabbing'
        }`}
        style={{
          ...style,
          height: displayHeight,
          backgroundColor: `${eventColor}20`,
          top: 0,
        }}
      >
        {children}

        {/* Bottom resize handle — larger hit area for touch (24px visible, extends to edges) */}
        {onResize && (
          <div
            onPointerDown={handleResizePointerDown}
            className="absolute left-0 right-0 bottom-0 h-6 cursor-ns-resize group z-10 touch-none"
          >
            {/* Visual indicator line */}
            <div className="absolute left-1/3 right-1/3 bottom-1 h-0.5 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity"
              style={{ color: eventColor }}
            />
          </div>
        )}
      </motion.button>
    </div>
  )
}
