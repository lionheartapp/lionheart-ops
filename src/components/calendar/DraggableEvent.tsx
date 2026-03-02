'use client'

import { useState, useRef, useCallback, type ReactNode } from 'react'
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

  // Resize handlers (pointer events on the bottom handle)
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onResize) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    resizeStartYRef.current = e.clientY
    setIsResizing(true)
    setResizeDeltaPx(0)
    setResizeConflict(false)
  }, [onResize])

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isResizing) return
    e.stopPropagation()
    const rawDelta = e.clientY - resizeStartYRef.current
    const snapped = snapToGrid(rawDelta)
    const deltaMinutes = (snapped / HOUR_HEIGHT) * 60

    // Clamp: new height must be >= MIN_HEIGHT
    const newHeight = height + snapped
    if (newHeight < MIN_HEIGHT) {
      setResizeDeltaPx(MIN_HEIGHT - height)
      return
    }

    setResizeDeltaPx(snapped)
    setResizeConflict(checkResizeConflict(event, deltaMinutes, siblingEvents))
  }, [isResizing, height, event, siblingEvents])

  const handleResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isResizing || !onResize) return
    e.stopPropagation()
    setIsResizing(false)

    const snapped = snapToGrid(e.clientY - resizeStartYRef.current)
    const deltaMinutes = (snapped / HOUR_HEIGHT) * 60

    // Clamp minimum duration to 15 min
    const currentDuration = new Date(event.endTime).getTime() - new Date(event.startTime).getTime()
    const newDuration = currentDuration + deltaMinutes * 60_000
    const clampedDelta = newDuration < 15 * 60_000
      ? Math.ceil((15 * 60_000 - currentDuration) / 60_000)
      : deltaMinutes

    setResizeDeltaPx(0)
    setResizeConflict(false)

    if (clampedDelta === 0) return
    if (checkResizeConflict(event, clampedDelta, siblingEvents)) return

    onResize(event, clampedDelta)
  }, [isResizing, onResize, event, siblingEvents])

  const eventColor = getEventColor(event)
  const displayHeight = isResizing ? Math.max(height + resizeDeltaPx, MIN_HEIGHT) : height

  return (
    <div className="relative" style={{ position: 'absolute', top, left: 0, right: 0 }}>
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
          if (!isDragging && !isResizing && totalOffsetRef.current < 3) {
            onClick(event)
          }
        }}
        aria-label={getEventAriaLabel(event)}
        className={`absolute left-1 right-1 rounded-xl px-3 py-2 text-left overflow-hidden transition-shadow ${className} ${
          isResizing
            ? resizeConflict
              ? 'shadow-xl ring-2 ring-red-400 z-[5]'
              : 'shadow-xl ring-2 ring-blue-400 z-[5]'
            : isDragging
              ? hasConflict
                ? 'shadow-xl ring-2 ring-red-400 z-[5]'
                : 'shadow-xl ring-2 ring-blue-400 z-[5]'
              : 'z-[1] hover:z-[2] hover:shadow-lg hover:scale-[1.02] cursor-grab active:cursor-grabbing'
        }`}
        style={{
          ...style,
          height: displayHeight,
          backgroundColor: `${eventColor}20`,
          top: 0,
        }}
      >
        {children}

        {/* Bottom resize handle */}
        {onResize && (
          <div
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize group z-10 touch-none"
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
