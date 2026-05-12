'use client'

import CalendarView from '@/components/calendar/CalendarView'
import PagePadding from '@/components/PagePadding'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'

export default function CalendarPage() {
  usePageTitle('Calendar')
  useTrackModuleVisit('events')

  return (
    <PagePadding>
      <div className="flex-1 min-h-0 flex flex-col">
        <CalendarView />
      </div>
    </PagePadding>
  )
}
