'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import type { CalendarData } from '@/lib/hooks/useCalendar'

interface CalendarSidebarProps {
  calendars: CalendarData[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (calendarId: string) => void
}

const typeLabels: Record<string, string> = {
  ACADEMIC: 'Academic',
  STAFF: 'Staff',
  TIMETABLE: 'Timetable',
  PARENT_FACING: 'Parent-Facing',
  ATHLETICS: 'Athletics',
  GENERAL: 'General',
}

export default function CalendarSidebar({
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
}: CalendarSidebarProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(Object.keys(typeLabels))
  )

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Group calendars by type
  const grouped = calendars.reduce<Record<string, CalendarData[]>>((acc, cal) => {
    const type = cal.calendarType
    if (!acc[type]) acc[type] = []
    acc[type].push(cal)
    return acc
  }, {})

  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">
        Calendars
      </h3>
      <div className="space-y-1">
        {Object.entries(grouped).map(([type, cals]) => {
          const isExpanded = expandedTypes.has(type)
          return (
            <div key={type}>
              <button
                onClick={() => toggleType(type)}
                className="flex items-center gap-1.5 w-full px-1 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                {typeLabels[type] || type}
                <span className="text-gray-300 ml-auto">{cals.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {cals.map((cal) => {
                    const isVisible = visibleCalendarIds.has(cal.id)
                    return (
                      <button
                        key={cal.id}
                        onClick={() => onToggleCalendar(cal.id)}
                        className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-md text-sm hover:bg-gray-50 transition-colors group"
                      >
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0 border"
                          style={{
                            backgroundColor: isVisible ? cal.color : 'transparent',
                            borderColor: cal.color,
                          }}
                        />
                        <span className={`truncate ${isVisible ? 'text-gray-900' : 'text-gray-400'}`}>
                          {cal.name}
                        </span>
                        <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          {isVisible ? (
                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-gray-300" />
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
