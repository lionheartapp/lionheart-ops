'use client'

import { useState, useRef, type ReactNode } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { getEventAriaLabel } from './a11y-helpers'

const HOUR_HEIGHT = 64
const SNAP_PX = HOUR_HEIGHT / 4 // 16px = 15 minutes

interface DraggableEventProps {
  event: CalendarEventData
  top: number
  height: number
  date: Date
  siblingEvents: CalendarEventData[]
  onDragReschedule: (event: CalendarEventData, deltaMinutes: number, deltaDays: number) => void
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

export default function DraggableEvent({
  event,
  top,
  height,
  date,
  siblingEvents,
  onDragReschedule,
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

  const handleDragStart = (_: unknown, info: PanInfo) => {
    dragStartRef.current = { x: info.point.x, y: info.point.y }
    totalOffsetRef.current = 0
    setIsDragging(true)
    setHasConflict(false)
  }

  const handleDrag = (_: unknown, info: PanInfo) => {
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

  const eventColor = getEventColor(event)

  return (
    <div className="relative" style={{ position: 'absolute', top, left: 0, right: 0 }}>
      {/* Ghost placeholder (original position) */}
      {isDragging && (
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
        drag={dragAxis === 'both' ? true : 'y'}
        dragMomentum={false}
        dragSnapToOrigin
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation()
          if (!isDragging && totalOffsetRef.current < 3) {
            onClick(event)
          }
        }}
        aria-label={getEventAriaLabel(event)}
        className={`absolute left-1 right-1 rounded-xl px-3 py-2 text-left overflow-hidden cursor-grab active:cursor-grabbing transition-shadow ${className} ${
          isDragging
            ? hasConflict
              ? 'shadow-xl ring-2 ring-red-400 z-[5]'
              : 'shadow-xl ring-2 ring-blue-400 z-[5]'
            : 'z-[1] hover:z-[2] hover:shadow-lg hover:scale-[1.02]'
        }`}
        style={{
          ...style,
          height,
          backgroundColor: `${eventColor}20`,
          top: 0,
        }}
      >
        {children}
      </motion.button>
    </div>
  )
}
