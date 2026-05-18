'use client'

import CalendarView from '@/components/calendar/CalendarView'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'

export default function CalendarPage() {
  usePageTitle('Calendar')
  useTrackModuleVisit('events')

  // <main> is set to `flex flex-col overflow-hidden` for /calendar in
  // DashboardLayout, so this wrapper can use the flex chain reliably.
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <CalendarView />
    </div>
  )
}
