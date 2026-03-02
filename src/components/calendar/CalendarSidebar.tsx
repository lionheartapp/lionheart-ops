'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import type { CalendarData } from '@/lib/hooks/useCalendar'

interface CalendarSidebarProps {
  calendars: CalendarData[]
  visibleCalendarIds: Set<string>
  onToggleCalendar: (calendarId: string) => void
}

export default function CalendarSidebar({
  calendars,
  visibleCalendarIds,
  onToggleCalendar,
}: CalendarSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['MASTER', 'MY SCHEDULE'])
  )

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  // Group: MASTER = non-PERSONAL, MY SCHEDULE = PERSONAL
  const masterCalendars = calendars.filter((c) => c.calendarType !== 'PERSONAL')
  const personalCalendars = calendars.filter((c) => c.calendarType === 'PERSONAL')

  const sections = [
    { key: 'MASTER', label: 'Master', calendars: masterCalendars },
    { key: 'MY SCHEDULE', label: 'My Schedule', calendars: personalCalendars },
  ]

  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">
        Calendars
      </h3>
      <div className="space-y-1">
        {sections.map(({ key, label, calendars: sectionCals }) => {
          if (sectionCals.length === 0) return null
          const isExpanded = expandedSections.has(key)
          return (
            <div key={key}>
              <button
                onClick={() => toggleSection(key)}
                className="flex items-center gap-1.5 w-full px-1 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                {label}
                <span className="text-gray-300 ml-auto">{sectionCals.length}</span>
              </button>
              {isExpanded && (
                <div className="ml-2 space-y-0.5">
                  {sectionCals.map((cal) => {
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
