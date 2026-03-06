'use client'

import type { PmCalendarEvent as PmCalendarEventType } from '@/lib/types/pm-schedule'

// react-big-calendar passes event objects to the custom event component
// via the `event` prop. The component is rendered inside the calendar cell.

interface PmCalendarEventProps {
  event: PmCalendarEventType
}

const COLOR_CONFIG = {
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  green: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    dot: 'bg-green-500',
    border: 'border-green-200',
  },
}

export default function PmCalendarEvent({ event }: PmCalendarEventProps) {
  const config = COLOR_CONFIG[event.color] || COLOR_CONFIG.blue

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium truncate border ${config.bg} ${config.text} ${config.border}`}
      title={`${event.title}${event.assetName ? ` — ${event.assetName}` : ''}${event.locationName ? ` @ ${event.locationName}` : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className="truncate">{event.title}</span>
      {event.assetName && (
        <span className="opacity-70 truncate hidden sm:inline">({event.assetName})</span>
      )}
    </div>
  )
}
