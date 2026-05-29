'use client'

import dynamic from 'next/dynamic'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'

const CalendarView = dynamic(() => import('@/components/calendar/CalendarView'), {
  loading: () => <CalendarPageSkeleton />,
})

function CalendarPageSkeleton() {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 lg:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
      <div className="grid flex-1 min-h-0 grid-cols-7 gap-px bg-slate-200 p-px">
        {Array.from({ length: 35 }).map((_, index) => (
          <div key={index} className="animate-pulse bg-white p-3">
            <div className="mb-4 h-4 w-8 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}

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
