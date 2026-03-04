'use client'

import { useMemo, useEffect, useRef } from 'react'
import { getEventColor, type CalendarEventData } from '@/lib/hooks/useCalendar'
import { useDragToCreate } from '@/lib/hooks/useDragToCreate'
import { getEventAriaLabel } from './a11y-helpers'
import { Trophy } from 'lucide-react'
import CampusShapeIndicator, { getShapeIndex } from './CampusShapeIndicator'
import DraggableEvent from './DraggableEvent'
import { computeSubColumns, getSubColumnStyle } from './MeetWithColumnLayout'
import { layoutEvents, getOverlapStyle } from './overlapLayout'
import { DayViewSkeletons } from './EventSkeletons'
import { motion } from 'framer-motion'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import { useDaySchedule, useSpecialDays, SPECIAL_DAY_COLORS } from '@/lib/hooks/useAcademicCalendar'

interface DayViewProps {
  currentDate: Date
  events: CalendarEventData[]
  onEventClick: (event: CalendarEventData) => void
  onSlotClick: (start: Date, end: Date) => void
  onDragReschedule?: (event: CalendarEventData, deltaMinutes: number, deltaDays: number) => void
  onResize?: (event: CalendarEventData, deltaMinutes: number) => void
  campusShapeMap: Map<string, number>
  meetWithPeople?: MeetWithPerson[]
  meetWithEvents?: Map<string, CalendarEventData[]>
  isLoading?: boolean
}

const HOUR_HEIGHT = 64
const START_HOUR = 0
const END_HOUR = 24

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'pm' : 'am'
  const h = hour % 12 || 12
  return `${h} ${ampm}`
}

export default function DayView({ currentDate, events, onEventClick, onSlotClick, onDragReschedule, onResize, campusShapeMap, meetWithPeople = [], meetWithEvents = new Map(), isLoading }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { dragState, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, getGhostStyle, getGhostLabel } = useDragToCreate({ onSlotClick })

  // Academic calendar integrations
  const { data: daySchedule } = useDaySchedule(currentDate)
  const dayEnd = useMemo(() => {
    const d = new Date(currentDate)
    d.setHours(23, 59, 59, 999)
    return d
  }, [currentDate])
  const { data: specialDays = [] } = useSpecialDays(currentDate, dayEnd)
  const todaySpecial = specialDays.find((sd) => {
    const sdDate = new Date(sd.date)
    return sdDate.getFullYear() === currentDate.getFullYear() &&
      sdDate.getMonth() === currentDate.getMonth() &&
      sdDate.getDate() === currentDate.getDate()
  })

  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEventData[] = []
    const timed: CalendarEventData[] = []
    for (const event of events) {
      if (event.isAllDay) allDay.push(event)
      else timed.push(event)
    }
    return { allDayEvents: allDay, timedEvents: timed }
  }, [events])

  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date()
      const scrollTo = (now.getHours() - START_HOUR - 1) * HOUR_HEIGHT
      scrollRef.current.scrollTop = Math.max(0, scrollTo)
    }
  }, [])

  const hasMeetWith = meetWithPeople.length > 0
  const subColumns = hasMeetWith
    ? computeSubColumns(timedEvents, meetWithPeople, meetWithEvents, currentDate)
    : null

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const now = new Date()
  const isToday =
    currentDate.getFullYear() === now.getFullYear() &&
    currentDate.getMonth() === now.getMonth() &&
    currentDate.getDate() === now.getDate()
  const nowMinutes = (now.getHours() - START_HOUR) * 60 + now.getMinutes()
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
  const showNowLine = isToday && now.getHours() >= START_HOUR && now.getHours() < END_HOUR

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Special day banner */}
      {todaySpecial && (() => {
        const colors = SPECIAL_DAY_COLORS[todaySpecial.type] || SPECIAL_DAY_COLORS.OTHER
        return (
          <div
            className="flex items-center gap-2 px-4 sm:px-10 py-2 text-xs font-medium"
            style={{ backgroundColor: colors.bg, color: colors.text, borderBottom: `1px solid ${colors.border}` }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors.text }} />
            {todaySpecial.name}
            <span className="opacity-60">({todaySpecial.type.replace(/_/g, ' ').toLowerCase()})</span>
          </div>
        )
      })()}

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex items-center gap-3 py-4 border-b border-gray-100 mb-0 px-4 sm:px-10">
          <span className="w-14 flex-shrink-0 text-xs text-gray-400 text-right pr-3">All day</span>
          <div className="flex gap-1">
            {allDayEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                aria-label={getEventAriaLabel(event)}
                className="text-left flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold truncate"
                style={{
                  backgroundColor: `${getEventColor(event)}20`,
                  color: getEventColor(event),
                }}
              >
                <CampusShapeIndicator
                  shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                  color={getEventColor(event)}
                  size={10}
                />
                {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-70" />}
                <span className="truncate">{event.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Meet-with person headers — static above scroll */}
      {subColumns && (
        <div className="flex items-center py-4 border-b border-gray-100 px-4 sm:px-10">
          <div className="w-14 flex-shrink-0" />
          <div className="flex-1 flex">
            {subColumns.map((col) => {
              const colStyle = getSubColumnStyle(col.columnIndex, col.totalColumns)
              return (
                <div
                  key={col.personId ?? 'self'}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold truncate px-1"
                  style={{ width: colStyle.width, color: col.color }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="truncate">{col.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white calendar-scroll">
        <div className="flex relative pl-4 sm:pl-10 pr-4" style={{ height: hours.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-3 text-xs text-gray-400"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT - 7 }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Main column */}
          <div
            className="flex-1 relative"
            onPointerDown={(e) => handlePointerDown(currentDate, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {/* Bell schedule period markers */}
            {daySchedule?.bellSchedule?.periods?.map((period) => {
              const [startH, startM] = period.startTime.split(':').map(Number)
              const [endH, endM] = period.endTime.split(':').map(Number)
              const startMin = (startH - START_HOUR) * 60 + startM
              const endMin = (endH - START_HOUR) * 60 + endM
              const top = (startMin / 60) * HOUR_HEIGHT
              const height = ((endMin - startMin) / 60) * HOUR_HEIGHT
              return (
                <div
                  key={period.id}
                  className="absolute left-0 right-0 pointer-events-none z-[0]"
                  style={{ top, height }}
                >
                  <div className="absolute inset-0 bg-primary-50/30 border-l-2 border-primary-200" />
                  <span className="absolute top-0.5 left-2 text-[10px] font-medium text-primary-400/70 truncate max-w-[120px]">
                    {period.name}
                  </span>
                </div>
              )
            })}

            {/* Hour lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-gray-100"
                style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}

            {/* Now line */}
            {showNowLine && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: nowTop }}
              >
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              </div>
            )}

            {/* Hover targets */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 right-0 cursor-pointer border border-transparent rounded-lg hover:bg-primary-100/30 hover:border-dashed hover:border-primary-300 transition-colors"
                style={{
                  top: (hour - START_HOUR) * HOUR_HEIGHT,
                  height: HOUR_HEIGHT,
                }}
              />
            ))}

            {/* Drag-to-create ghost */}
            {(() => {
              const ghostStyle = getGhostStyle(dragState?.dayDate ?? new Date(0), currentDate)
              return ghostStyle ? (
                <div
                  className="bg-primary-100/50 border-2 border-dashed border-primary-400 rounded-xl flex items-start justify-start px-3 py-1.5"
                  style={ghostStyle}
                >
                  <span className="text-xs font-medium text-primary-700 select-none">
                    {getGhostLabel()}
                  </span>
                </div>
              ) : null
            })()}

            {/* Sub-column separator lines (meet-with mode) */}
            {subColumns && subColumns.length > 1 && subColumns.slice(1).map((col) => {
              const colStyle = getSubColumnStyle(col.columnIndex, col.totalColumns)
              return (
                <div
                  key={`sep-${col.personId}`}
                  className="absolute top-0 bottom-0 border-l border-dashed border-gray-200 pointer-events-none z-[1]"
                  style={{ left: colStyle.left }}
                />
              )
            })}

            {/* Skeleton overlay (cold load) */}
            {isLoading && <DayViewSkeletons />}

            {/* Event blocks */}
            {!isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="contents"
              >
              {subColumns ? (
                <>
                  {subColumns.map((col) => {
                    const colStyle = getSubColumnStyle(col.columnIndex, col.totalColumns)
                    const isSelf = col.personId === null
                    return col.events.map((event) => {
                      const evStart = new Date(event.startTime)
                      const evEnd = new Date(event.endTime)
                      const startMinutes = (evStart.getHours() - START_HOUR) * 60 + evStart.getMinutes()
                      const endMinutes = (evEnd.getHours() - START_HOUR) * 60 + evEnd.getMinutes()
                      const evTop = (startMinutes / 60) * HOUR_HEIGHT
                      const evHeight = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 28)
                      const eventColor = isSelf ? getEventColor(event) : col.color

                      if (isSelf && onDragReschedule) {
                        return (
                          <DraggableEvent
                            key={`${col.personId}-${event.id}`}
                            event={event}
                            top={evTop}
                            height={evHeight}
                            date={currentDate}
                            siblingEvents={timedEvents}
                            onDragReschedule={onDragReschedule}
                            onResize={onResize}
                            onClick={onEventClick}
                            dragAxis="y"
                            subColumnStyle={colStyle}
                          >
                            <div className="font-semibold text-sm truncate flex items-center gap-1" style={{ color: eventColor }}>
                              <CampusShapeIndicator
                                shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                                color={eventColor}
                                size={10}
                              />
                              {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-70" />}
                              {event.title}
                            </div>
                            {evHeight > 36 && (
                              <div className="text-xs mt-0.5 opacity-60" style={{ color: eventColor }}>
                                {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' - '}
                                {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </DraggableEvent>
                        )
                      }

                      return (
                        <DraggableEvent
                          key={`${col.personId}-${event.id}`}
                          event={event}
                          top={evTop}
                          height={evHeight}
                          date={currentDate}
                          siblingEvents={[]}
                          onDragReschedule={onDragReschedule || (() => {})}
                          onClick={onEventClick}
                          dragAxis="y"
                          subColumnStyle={colStyle}
                          readOnly={!isSelf}
                          style={!isSelf ? {
                            backgroundColor: `${col.color}15`,
                            borderLeft: `3px solid ${col.color}`,
                          } : undefined}
                        >
                          <div className="font-semibold text-sm truncate" style={{ color: eventColor }}>
                            {event.title}
                          </div>
                          {evHeight > 36 && (
                            <div className="text-xs mt-0.5 opacity-60" style={{ color: eventColor }}>
                              {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' - '}
                              {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </DraggableEvent>
                      )
                    })
                  })}
                </>
              ) : (
                (() => {
                  const overlapMap = layoutEvents(timedEvents)
                  return timedEvents.map((event) => {
                    const evStart = new Date(event.startTime)
                    const evEnd = new Date(event.endTime)
                    const startMinutes = (evStart.getHours() - START_HOUR) * 60 + evStart.getMinutes()
                    const endMinutes = (evEnd.getHours() - START_HOUR) * 60 + evEnd.getMinutes()
                    const evTop = (startMinutes / 60) * HOUR_HEIGHT
                    const evHeight = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 28)
                    const layout = overlapMap.get(event.id)
                    const colStyle = layout ? getOverlapStyle(layout) : undefined

                    if (onDragReschedule) {
                      return (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          top={evTop}
                          height={evHeight}
                          date={currentDate}
                          siblingEvents={timedEvents}
                          onDragReschedule={onDragReschedule}
                          onResize={onResize}
                          onClick={onEventClick}
                          dragAxis="y"
                          subColumnStyle={colStyle}
                        >
                          <div className="font-semibold text-sm truncate flex items-center gap-1" style={{ color: getEventColor(event) }}>
                            <CampusShapeIndicator
                              shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                              color={getEventColor(event)}
                              size={10}
                            />
                            {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-70" />}
                            {event.title}
                          </div>
                          {evHeight > 36 && (
                            <div className="text-xs mt-0.5 opacity-60" style={{ color: getEventColor(event) }}>
                              {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {' - '}
                              {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {evHeight > 56 && event.locationText && (
                            <div className="text-xs mt-0.5 opacity-40" style={{ color: getEventColor(event) }}>
                              {event.locationText}
                            </div>
                          )}
                        </DraggableEvent>
                      )
                    }

                    return (
                      <button
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(event)
                        }}
                        aria-label={getEventAriaLabel(event)}
                        className="absolute rounded-xl px-4 py-2 text-left overflow-hidden z-[1] hover:z-[2] hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
                        style={{
                          top: evTop,
                          height: evHeight,
                          left: colStyle?.left ?? '4px',
                          width: colStyle?.width ?? 'calc(100% - 20px)',
                          backgroundColor: `${getEventColor(event)}20`,
                        }}
                      >
                        <div className="font-semibold text-sm truncate flex items-center gap-1" style={{ color: getEventColor(event) }}>
                          <CampusShapeIndicator
                            shapeIndex={getShapeIndex(campusShapeMap, event.calendar.campus?.id)}
                            color={getEventColor(event)}
                            size={10}
                          />
                          {!!(event.metadata as any)?.athleticsType && <Trophy className="w-3 h-3 flex-shrink-0 opacity-70" />}
                          {event.title}
                        </div>
                        {evHeight > 36 && (
                          <div className="text-xs mt-0.5 opacity-60" style={{ color: getEventColor(event) }}>
                            {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {evHeight > 56 && event.locationText && (
                          <div className="text-xs mt-0.5 opacity-40" style={{ color: getEventColor(event) }}>
                            {event.locationText}
                          </div>
                        )}
                      </button>
                    )
                  })
                })()
              )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
