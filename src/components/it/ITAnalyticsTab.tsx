'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { fetchApi } from '@/lib/api-client'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { IllustrationAnalytics } from '@/components/illustrations'
import {
  BarChart3,
  Clock,
  Monitor,
  ShieldCheck,
  Users,
  Package,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────

interface ITAnalyticsTabProps {
  canViewBoardReports: boolean
}

interface AnalyticsData {
  ticketVolume: { issueType: string; count: number }[]
  resolutionTime: { campus: string; issueType: string; avgHours: number }[]
  passwordResetVolume: { month: string; count: number }[]
  deviceHealth: { schoolId: string; schoolName: string; good: number; fair: number; poor: number; retired: number }[]
  lemonDevices: { id: string; assetTag: string; model: string | null; repairCount: number; totalRepairCost: number }[]
  repairCostByModel: { model: string; totalCost: number; repairCount: number; avgCostPerRepair: number }[]
  technicianWorkload: { technicianId: string; name: string; activeTickets: number }[]
  slaCompliance: { campus: string; total: number; met: number; breached: number; compliancePct: number }[]
  summerThroughput: { total: number; completed: number; completionPct: number; repairCount: number }
  loanerUtilization: { totalLoaners: number; activeCheckouts: number; utilizationPct: number }
}

interface School {
  id: string
  name: string
}

// ─── Bar color palette ─────────────────────────────────────────────────

const BAR_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-orange-500',
]

function getBarColor(index: number): string {
  return BAR_COLORS[index % BAR_COLORS.length]
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 rounded-lg animate-pulse" />
          <div className="flex gap-1">
            <div className="h-9 w-12 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-9 w-12 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-9 w-12 bg-slate-200 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stat row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ui-glass p-6 text-center">
            <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mx-auto mb-2" />
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ui-glass p-6">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-10 bg-slate-200 rounded animate-pulse" />
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full">
                    <div
                      className="h-3 bg-slate-200 rounded-full animate-pulse"
                      style={{ width: `${60 - j * 15}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sub-sections ──────────────────────────────────────────────────────

function TicketVolumeSection({ data }: { data: AnalyticsData['ticketVolume'] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
        No ticket volume data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const pct = Math.round((item.count / maxCount) * 100)
        return (
          <div key={item.issueType} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium truncate mr-2">
                {item.issueType.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-500 tabular-nums flex-shrink-0">{item.count}</span>
            </div>
            <div className="bg-slate-100 rounded-full h-3">
              <div
                className={`${getBarColor(idx)} rounded-full h-3 transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResolutionTimeSection({ data }: { data: AnalyticsData['resolutionTime'] }) {
  // Group by campus, show avg hours
  const byCampus = useMemo(() => {
    const map = new Map<string, { totalHours: number; count: number }>()
    for (const row of data) {
      const existing = map.get(row.campus) ?? { totalHours: 0, count: 0 }
      existing.totalHours += row.avgHours
      existing.count += 1
      map.set(row.campus, existing)
    }
    return Array.from(map.entries())
      .map(([campus, v]) => ({
        campus,
        avgHours: Math.round(v.totalHours / v.count),
      }))
      .sort((a, b) => b.avgHours - a.avgHours)
  }, [data])

  const maxHours = Math.max(...byCampus.map((d) => d.avgHours), 1)

  if (byCampus.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
        No resolution time data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {byCampus.map((item, idx) => {
        const pct = Math.round((item.avgHours / maxHours) * 100)
        return (
          <div key={item.campus} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium truncate mr-2">{item.campus}</span>
              <span className="text-slate-500 tabular-nums flex-shrink-0">{item.avgHours}h</span>
            </div>
            <div className="bg-slate-100 rounded-full h-3">
              <div
                className={`${getBarColor(idx)} rounded-full h-3 transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DeviceHealthSection({ data }: { data: AnalyticsData['deviceHealth'] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
        No device health data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const total = row.good + row.fair + row.poor
        if (total === 0) return null
        const goodPct = Math.round((row.good / total) * 100)
        const fairPct = Math.round((row.fair / total) * 100)
        const poorPct = Math.round((row.poor / total) * 100)

        return (
          <div key={row.schoolId} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium truncate mr-2">{row.schoolName}</span>
              <span className="text-slate-500 tabular-nums flex-shrink-0">{total} devices</span>
            </div>
            <div className="bg-slate-100 rounded-full h-3 flex overflow-hidden">
              {goodPct > 0 && (
                <div
                  className="bg-emerald-500 h-3 transition-all duration-500"
                  style={{ width: `${goodPct}%` }}
                  title={`Good: ${goodPct}%`}
                />
              )}
              {fairPct > 0 && (
                <div
                  className="bg-amber-400 h-3 transition-all duration-500"
                  style={{ width: `${fairPct}%` }}
                  title={`Fair: ${fairPct}%`}
                />
              )}
              {poorPct > 0 && (
                <div
                  className="bg-red-500 h-3 transition-all duration-500"
                  style={{ width: `${poorPct}%` }}
                  title={`Poor: ${poorPct}%`}
                />
              )}
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Good {goodPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Fair {fairPct}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Poor {poorPct}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TechWorkloadSection({ data }: { data: AnalyticsData['technicianWorkload'] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
        No technician workload data available
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.activeTickets - a.activeTickets)

  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 text-slate-500 font-medium">Technician</th>
            <th className="text-right py-2 text-slate-500 font-medium">Active Tickets</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tech) => (
            <tr key={tech.technicianId} className="border-b border-slate-50 last:border-0">
              <td className="py-2 text-slate-700">{tech.name}</td>
              <td className="py-2 text-right tabular-nums font-medium text-slate-900">
                {tech.activeTickets}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SLASection({ data }: { data: AnalyticsData['slaCompliance'] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
        No SLA compliance data available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const pct = Math.round(row.compliancePct)
        const barColor =
          pct > 90 ? 'bg-emerald-500' : pct > 70 ? 'bg-amber-400' : 'bg-red-500'

        return (
          <div key={row.campus} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium truncate mr-2">{row.campus}</span>
              <span
                className={`tabular-nums font-semibold flex-shrink-0 ${
                  pct > 90 ? 'text-emerald-600' : pct > 70 ? 'text-amber-600' : 'text-red-600'
                }`}
              >
                {pct}%
              </span>
            </div>
            <div className="bg-slate-100 rounded-full h-3">
              <div
                className={`${barColor} rounded-full h-3 transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs text-slate-400">
              {row.met} met / {row.breached} breached of {row.total} total
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LoanerSection({ data }: { data: AnalyticsData['loanerUtilization'] }) {
  const pct = Math.round(data.utilizationPct)
  const barColor =
    pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">
          {data.activeCheckouts} / {data.totalLoaners}
        </span>
        <span
          className={`text-sm font-semibold ${
            pct > 80 ? 'text-red-600' : pct > 50 ? 'text-amber-600' : 'text-emerald-600'
          }`}
        >
          {pct}% utilized
        </span>
      </div>
      <div className="bg-slate-100 rounded-full h-4">
        <div
          className={`${barColor} rounded-full h-4 transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>0</span>
        <span>{data.totalLoaners} total loaners</span>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: '3mo', value: 3 },
  { label: '6mo', value: 6 },
  { label: '12mo', value: 12 },
] as const

export default function ITAnalyticsTab({ canViewBoardReports }: ITAnalyticsTabProps) {
  const [schoolId, setSchoolId] = useState<string>('')
  const [months, setMonths] = useState<number>(6)

  // Fetch schools for the filter dropdown
  const { data: schoolsRaw } = useQuery({
    queryKey: ['campuses'],
    queryFn: () => fetchApi<School[]>('/api/settings/campus/campuses'),
    staleTime: 5 * 60_000,
  })
  const schools: School[] = Array.isArray(schoolsRaw) ? schoolsRaw : []

  // Fetch analytics data
  const {
    data: analyticsRaw,
    isLoading,
    isError,
  } = useQuery({
    ...queryOptions.itAnalytics(schoolId || undefined, months),
    enabled: canViewBoardReports,
  })

  const analytics: AnalyticsData | null = (analyticsRaw as AnalyticsData) ?? null

  // ── Derived summary stats ──────────────────────────────────────────

  const totalTickets = useMemo(() => {
    if (!analytics?.ticketVolume) return 0
    return analytics.ticketVolume.reduce((sum, v) => sum + v.count, 0)
  }, [analytics])

  const avgResolutionHours = useMemo(() => {
    if (!analytics?.resolutionTime?.length) return 0
    const total = analytics.resolutionTime.reduce((sum, r) => sum + r.avgHours, 0)
    return Math.round(total / analytics.resolutionTime.length)
  }, [analytics])

  const fleetHealthPct = useMemo(() => {
    if (!analytics?.deviceHealth?.length) return 0
    const totals = analytics.deviceHealth.reduce(
      (acc, d) => ({
        good: acc.good + d.good,
        total: acc.total + d.good + d.fair + d.poor,
      }),
      { good: 0, total: 0 }
    )
    return totals.total > 0 ? Math.round((totals.good / totals.total) * 100) : 0
  }, [analytics])

  const slaCompliancePct = useMemo(() => {
    if (!analytics?.slaCompliance?.length) return 0
    const totals = analytics.slaCompliance.reduce(
      (acc, s) => ({
        met: acc.met + s.met,
        total: acc.total + s.total,
      }),
      { met: 0, total: 0 }
    )
    return totals.total > 0 ? Math.round((totals.met / totals.total) * 100) : 0
  }, [analytics])

  // ── Permission gate ────────────────────────────────────────────────

  if (!canViewBoardReports) {
    return (
      <div className="text-center py-16 text-slate-400">
        You do not have permission to view analytics.
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  // ── Error ──────────────────────────────────────────────────────────

  if (isError || !analytics) {
    return (
      <div className="text-center py-16 text-slate-400">
        Failed to load analytics data. Please try again.
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  const statCards = [
    {
      icon: BarChart3,
      label: 'Total Tickets',
      value: totalTickets,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      icon: Clock,
      label: 'Avg Resolution',
      value: avgResolutionHours,
      suffix: 'h',
      color: 'text-indigo-600 bg-indigo-50',
    },
    {
      icon: Monitor,
      label: 'Fleet Health',
      value: fleetHealthPct,
      suffix: '%',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      icon: ShieldCheck,
      label: 'SLA Compliance',
      value: slaCompliancePct,
      suffix: '%',
      color: 'text-violet-600 bg-violet-50',
    },
  ]

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header: School filter + Time range ───────────────────────── */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">IT Analytics</h2>
        <div className="flex items-center gap-3">
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          >
            <option value="">All Campuses</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setMonths(range.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  months === range.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Stat summary row ─────────────────────────────────────────── */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="ui-glass p-6 text-center">
            <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mx-auto mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              <AnimatedCounter value={stat.value} />
              {stat.suffix && <span>{stat.suffix}</span>}
            </div>
            <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </motion.div>

      {/* ── Metric cards grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Ticket Volume */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-slate-900">Ticket Volume by Issue Type</h3>
          </div>
          <TicketVolumeSection data={analytics.ticketVolume ?? []} />
        </motion.div>

        {/* 2. Resolution Time */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900">Avg Resolution Time by Campus</h3>
          </div>
          <ResolutionTimeSection data={analytics.resolutionTime ?? []} />
        </motion.div>

        {/* 3. Device Health */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900">Device Health by Campus</h3>
          </div>
          <DeviceHealthSection data={analytics.deviceHealth ?? []} />
        </motion.div>

        {/* 4. Technician Workload */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Technician Workload</h3>
          </div>
          <TechWorkloadSection data={analytics.technicianWorkload ?? []} />
        </motion.div>

        {/* 5. SLA Compliance */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-slate-900">SLA Compliance by Campus</h3>
          </div>
          <SLASection data={analytics.slaCompliance ?? []} />
        </motion.div>

        {/* 6. Loaner Utilization */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-900">Loaner Utilization</h3>
          </div>
          {analytics.loanerUtilization ? (
            <LoanerSection data={analytics.loanerUtilization} />
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              <IllustrationAnalytics className="w-32 h-24 mx-auto mb-2" />
              No loaner data available
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
