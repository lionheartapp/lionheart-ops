'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  Link2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { PlanningCenterCard } from './integrations/PlanningCenterCard'
import { GoogleCalendarCard } from './integrations/GoogleCalendarCard'
import { MicrosoftCalendarCard } from './integrations/MicrosoftCalendarCard'
import { TwilioCard } from './integrations/TwilioCard'
import type { IntegrationStatusData } from './integrations/integration-types'

// ─── Main IntegrationsTab ─────────────────────────────────────────────────────

export default function IntegrationsTab() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch integration status')
      const json = await res.json()
      return json.data as IntegrationStatusData
    },
    staleTime: 30000,
  })

  // Auto-refetch when returning from OAuth callback
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('pco_connected') || searchParams.get('pco_error')) {
      queryClient.invalidateQueries({ queryKey: ['integration-status'] })
    }
  }, [searchParams, queryClient])

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['integration-status'] })
  }

  const showPlanningCenter = data?.institutionType === 'FAITH_BASED'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
            <p className="text-sm text-slate-500 mt-0.5">Connect external services and tools</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-slate-100" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-100 rounded-lg w-28 mb-1.5" />
                  <div className="h-3 bg-slate-50 rounded-lg w-16" />
                </div>
              </div>
              <div className="h-3 bg-slate-50 rounded-lg w-full mb-2" />
              <div className="h-3 bg-slate-50 rounded-lg w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500 mb-4">Failed to load integration status.</p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    )
  }

  // Determine grid columns based on how many cards we show
  const cardCount = (showPlanningCenter ? 1 : 0) + 2 // Google Calendar + Twilio always show
  const gridCols = cardCount === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-6">
      {/* Header — full-width, flush top */}
      <div className="-mt-6 lg:-mt-8 -mx-4 sm:-mx-10 px-4 sm:px-10 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
            <p className="text-sm text-slate-500 mt-0.5">Connect external services to sync data and send notifications</p>
          </div>
        </div>
      </div>

      {/* Integration cards grid */}
      <div className={`grid grid-cols-1 ${gridCols} gap-5`}>
        {showPlanningCenter && (
          <PlanningCenterCard status={data.planningCenter} onRefresh={handleRefresh} />
        )}
        <GoogleCalendarCard status={data.googleCalendar} onRefresh={handleRefresh} />
        <MicrosoftCalendarCard status={data.microsoftCalendar} onRefresh={handleRefresh} />
        <TwilioCard status={data.twilio} onRefresh={handleRefresh} />
      </div>
    </div>
  )
}
