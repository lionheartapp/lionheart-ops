'use client'

import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, Users, BarChart3 } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { formatTimeLeft } from '@/lib/services/sla-utils'

interface DashboardData {
  sla: {
    atRiskCount: number
    breachedCount: number
    tickets: Array<{
      ticketNumber: string
      title: string
      category: string
      assignedTo: { firstName: string | null; lastName: string | null } | null
      slaStatus: {
        responseStatus: string
        resolveStatus: string
        responseTimeLeft: number | null
        resolveTimeLeft: number | null
      }
    }>
  }
  workload: Array<{
    userId: string
    name: string
    openTickets: number
    maxActiveTickets: number
    status: string
    utilizationPct: number
  }>
  categoryDistribution: Array<{
    category: string
    count: number
  }>
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical', PLUMBING: 'Plumbing', HVAC: 'HVAC',
  STRUCTURAL: 'Structural', CUSTODIAL_BIOHAZARD: 'Custodial',
  IT_AV: 'IT/AV', GROUNDS: 'Grounds', OTHER: 'Other',
  HARDWARE: 'Hardware', SOFTWARE: 'Software',
  ACCOUNT_PASSWORD: 'Accounts', NETWORK: 'Network', DISPLAY_AV: 'Display/AV',
}

export default function RoutingDashboard({ module }: { module: 'MAINTENANCE' | 'IT' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['routing-dashboard', module],
    queryFn: () => fetchApi<DashboardData>(`/api/settings/ticket-routing/dashboard?module=${module}`),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
            <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { sla, workload, categoryDistribution } = data
  const totalOpen = categoryDistribution.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="space-y-4 mb-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SLA Health */}
        <div className={`rounded-xl border p-5 ${
          sla.breachedCount > 0 ? 'bg-red-50 border-red-200' :
          sla.atRiskCount > 0 ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {sla.breachedCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <Clock className="w-4 h-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">SLA Health</span>
          </div>
          {sla.breachedCount > 0 && (
            <div className="text-2xl font-bold text-red-700">{sla.breachedCount} breached</div>
          )}
          {sla.atRiskCount > 0 && (
            <div className={`${sla.breachedCount > 0 ? 'text-sm text-amber-600 mt-0.5' : 'text-2xl font-bold text-amber-700'}`}>
              {sla.atRiskCount} at risk
            </div>
          )}
          {sla.breachedCount === 0 && sla.atRiskCount === 0 && (
            <div className="text-2xl font-bold text-green-700">All clear</div>
          )}
        </div>

        {/* Open Tickets */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Open Tickets</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalOpen}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {categoryDistribution.length} categories active
          </div>
        </div>

        {/* Staff Active */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Staff</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {workload.filter((w) => w.status === 'AVAILABLE').length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {workload.filter((w) => w.status === 'OUT_OF_OFFICE').length > 0 &&
              `${workload.filter((w) => w.status === 'OUT_OF_OFFICE').length} out of office`}
            {workload.filter((w) => w.status === 'OUT_OF_OFFICE').length === 0 && 'all available'}
          </div>
        </div>
      </div>

      {/* At-risk tickets list */}
      {sla.tickets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Tickets Requiring Attention
          </h4>
          <div className="space-y-2">
            {sla.tickets.map((ticket) => {
              const isBreach = ticket.slaStatus.responseStatus === 'BREACHED' || ticket.slaStatus.resolveStatus === 'BREACHED'
              const worstTimeLeft = Math.min(
                ticket.slaStatus.responseTimeLeft ?? Infinity,
                ticket.slaStatus.resolveTimeLeft ?? Infinity
              )
              return (
                <div
                  key={ticket.ticketNumber}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    isBreach ? 'bg-red-50' : 'bg-amber-50'
                  }`}
                >
                  <div className="min-w-0">
                    <span className={`text-xs font-mono font-medium ${isBreach ? 'text-red-700' : 'text-amber-700'}`}>
                      {ticket.ticketNumber}
                    </span>
                    <span className="text-xs text-slate-600 ml-2 truncate">{ticket.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {ticket.assignedTo ? (
                      <span className="text-xs text-slate-500">
                        {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isBreach ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isBreach ? `Breached ${formatTimeLeft(worstTimeLeft)}` : `${formatTimeLeft(worstTimeLeft)} left`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Staff workload bars */}
      {workload.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
            Staff Workload
          </h4>
          <div className="space-y-2">
            {workload
              .sort((a, b) => b.utilizationPct - a.utilizationPct)
              .map((staff) => (
                <div key={staff.userId} className="flex items-center gap-3">
                  <span className="text-xs text-slate-700 w-32 truncate">{staff.name}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        staff.utilizationPct >= 80 ? 'bg-red-400' :
                        staff.utilizationPct >= 50 ? 'bg-amber-400' : 'bg-green-400'
                      }`}
                      style={{ width: `${Math.min(staff.utilizationPct, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-16 text-right">
                    {staff.openTickets}/{staff.maxActiveTickets}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
