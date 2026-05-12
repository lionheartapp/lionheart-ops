'use client'

import { Suspense, useEffect, useState } from 'react'

import TicketDetailPage from '@/components/maintenance/TicketDetailPage'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'
import PagePadding from '@/components/PagePadding'

function TicketDetailContent({ ticketId }: { ticketId: string }) {
  const { isReady, orgId } = useDashboardLayoutProps()

  if (!isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <PagePadding>
      <TicketDetailPage ticketId={ticketId} />
    </PagePadding>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TicketDetailRoute({ params }: PageProps) {
  const [ticketId, setTicketId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => setTicketId(id))
  }, [params])

  if (!ticketId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <TicketDetailContent ticketId={ticketId} />
    </Suspense>
  )
}
