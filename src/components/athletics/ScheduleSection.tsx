'use client'

import { CalendarDays } from 'lucide-react'

export default function ScheduleSection() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
      <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h2 className="text-lg font-medium text-gray-700 mb-1">Schedule Coming Soon</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Game schedules, practice calendars, and event management will be available here in the next update.
      </p>
    </div>
  )
}
