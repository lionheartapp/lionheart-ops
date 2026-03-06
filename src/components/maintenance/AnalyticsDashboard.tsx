'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, MotionConfig } from 'framer-motion'
import {
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { queryOptions } from '@/lib/queries'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import TicketsByStatusChart from './charts/TicketsByStatusChart'
import ResolutionTimeChart from './charts/ResolutionTimeChart'
import TechnicianWorkloadChart from './charts/TechnicianWorkloadChart'
import LaborHoursChart from './charts/LaborHoursChart'
import CostByBuildingChart from './charts/CostByBuildingChart'
import CategoryBreakdownChart from './charts/CategoryBreakdownChart'
import type {
  AllAnalyticsResult,
  PmComplianceResult,
  TopLocationResult,
} from '@/lib/services/maintenanceAnalyticsService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campus {
  id: string
  name: string
  isActive?: boolean
}

// ─── Skeleton Blocks ──────────────────────────────────────────────────────────

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-4 bg-gray-200 rounded w-2/5 mb-4" />
      <div className="h-3 bg-gray-100 rounded w-1/3 mb-6" />
      <div className="flex items-end gap-2 h-40">
        {[60, 80, 45, 95, 70, 55].map((pct, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 rounded-t"
            style={{ height: `${pct}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse ui-glass p-4">
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-2/3" />
    </div>
  )
}

// ─── PM Compliance Section ────────────────────────────────────────────────────

function PmComplianceSection({ data }: { data: PmComplianceResult }) {
  const total = data.completedOnTime + data.overdue + data.pending

  return (
    <div className="space-y-4">
      {/* Big compliance rate */}
      <div className="text-center py-3">
        <span
          className="text-5xl font-bold"
          style={{
            color:
              data.complianceRate >= 80
                ? '#22c55e'
                : data.complianceRate >= 60
                ? '#f59e0b'
                : '#ef4444',
          }}
        >
          {data.complianceRate}%
        </span>
        <p className="text-sm text-gray-500 mt-1">Compliance Rate</p>
      </div>

      {/* Three stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-3 text-center">
          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <span className="text-2xl font-bold text-green-700">{data.completedOnTime}</span>
          <p className="text-xs text-green-600 mt-0.5">On Time</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" />
          <span className="text-2xl font-bold text-red-700">{data.overdue}</span>
          <p className="text-xs text-red-600 mt-0.5">Overdue</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-3 text-center">
          <Clock className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <span className="text-2xl font-bold text-amber-700">{data.pending}</span>
          <p className="text-xs text-amber-600 mt-0.5">Pending</p>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div className="flex rounded-full h-2 overflow-hidden bg-gray-100">
            {data.completedOnTime > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(data.completedOnTime / total) * 100}%` }}
              />
            )}
            {data.pending > 0 && (
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(data.pending / total) * 100}%` }}
              />
            )}
            {data.overdue > 0 && (
              <div
                className="bg-red-400 transition-all"
                style={{ width: `${(data.overdue / total) * 100}%` }}
              />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">{total} total PM tickets</p>
        </div>
      )}
    </div>
  )
}

// ─── Top Locations Section ────────────────────────────────────────────────────

function TopLocationsSection({ data }: { data: TopLocationResult[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No location data for this period
      </div>
    )
  }

  const maxCount = data[0]?.ticketCount ?? 1

  return (
    <div className="space-y-2">
      {data.map((loc) => (
        <div key={loc.rank} className="flex items-center gap-3">
          <span className="w-5 h-5 flex-shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center">
            {loc.rank}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm text-gray-700 truncate pr-2">{loc.locationLabel}</span>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                {loc.ticketCount}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${(loc.ticketCount / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Chart Section Card ───────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div variants={cardEntrance} className={`ui-glass p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="font-medium text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  )
}

// ─── Main AnalyticsDashboard ──────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [selectedCampusId, setSelectedCampusId] = useState<string>('')

  // Fetch campuses
  const { data: rawCampuses = [] } = useQuery(queryOptions.campuses())
  const campuses = rawCampuses as Campus[]

  // Fetch all analytics
  const params = new URLSearchParams()
  if (selectedCampusId) params.set('campusId', selectedCampusId)
  params.set('months', '6')

  const { data: analyticsResponse, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['maintenance-analytics', selectedCampusId],
    queryFn: () =>
      fetch(`/api/maintenance/analytics?${params.toString()}`, {
        headers: getAuthHeaders(),
      }).then((r) => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const analytics: AllAnalyticsResult | null = analyticsResponse?.ok
    ? analyticsResponse.data
    : null

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.06, 0.05)}
        className="space-y-6"
      >
        {/* Header */}
        <motion.div variants={fadeInUp} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3" />
                <span>
                  {lastUpdated ? `Updated ${lastUpdated} · auto-refreshes every 60s` : 'Auto-refreshes every 60s'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <select
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">All Campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
              Last 6 months
            </span>
          </div>
        </motion.div>

        {/* Row 1: Tickets by Status — full width */}
        <SectionCard
          title="Tickets by Status"
          subtitle="Stacked by campus showing current distribution across all 8 statuses"
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : analytics ? (
            <TicketsByStatusChart data={analytics.ticketsByStatus} />
          ) : (
            <ChartSkeleton />
          )}
        </SectionCard>

        {/* Row 2: Resolution Time + PM Compliance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Resolution Time by Category"
            subtitle="Average hours from submission to DONE"
          >
            {isLoading ? (
              <ChartSkeleton />
            ) : analytics ? (
              <ResolutionTimeChart data={analytics.resolutionTimeByCategory} />
            ) : (
              <ChartSkeleton />
            )}
          </SectionCard>

          <SectionCard title="PM Compliance" subtitle="Preventive maintenance on-time completion rate">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              </div>
            ) : analytics ? (
              <PmComplianceSection data={analytics.pmCompliance} />
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No PM data available
              </div>
            )}
          </SectionCard>
        </div>

        {/* Row 3: Technician Workload — full width */}
        <SectionCard
          title="Technician Workload"
          subtitle="Active ticket count and hours logged this month per technician"
        >
          {isLoading ? (
            <ChartSkeleton />
          ) : analytics ? (
            <TechnicianWorkloadChart data={analytics.technicianWorkload} />
          ) : (
            <ChartSkeleton />
          )}
        </SectionCard>

        {/* Row 4: Labor Hours + Cost by Building */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Labor Hours by Month"
            subtitle="Stacked area by building — last 6 months"
          >
            {isLoading ? (
              <ChartSkeleton />
            ) : analytics ? (
              <LaborHoursChart data={analytics.laborHoursByMonth} />
            ) : (
              <ChartSkeleton />
            )}
          </SectionCard>

          <SectionCard
            title="Cost by Building"
            subtitle="Top 5 buildings by total spend per month"
          >
            {isLoading ? (
              <ChartSkeleton />
            ) : analytics ? (
              <CostByBuildingChart data={analytics.costByBuilding} />
            ) : (
              <ChartSkeleton />
            )}
          </SectionCard>
        </div>

        {/* Row 5: Top Locations + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard
            title="Top 10 Ticket Locations"
            subtitle="Highest-volume locations in the last 6 months"
          >
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-gray-200 rounded w-3/4" />
                      <div className="h-1.5 bg-gray-100 rounded" />
                    </div>
                    <div className="w-6 h-3 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : analytics ? (
              <TopLocationsSection data={analytics.topLocations} />
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No location data available
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Category Breakdown"
            subtitle="Ticket volume by specialty — last 6 months"
          >
            {isLoading ? (
              <ChartSkeleton />
            ) : analytics ? (
              <CategoryBreakdownChart data={analytics.categoryBreakdown} />
            ) : (
              <ChartSkeleton />
            )}
          </SectionCard>
        </div>
      </motion.div>
    </MotionConfig>
  )
}
