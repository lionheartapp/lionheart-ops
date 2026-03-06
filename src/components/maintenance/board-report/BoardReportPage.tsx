'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import { FCIScoreCard } from './FCIScoreCard'
import { BoardMetricsGrid } from './BoardMetricsGrid'
import { ComplianceStatusPanel } from './ComplianceStatusPanel'
import { AssetForecastPanel } from './AssetForecastPanel'
import { GenerateReportDialog } from './GenerateReportDialog'
import type { BoardReportMetrics } from '@/lib/services/boardReportService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

function formatPeriodLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-52 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100" />
          ))}
        </div>
      </div>
      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 rounded-2xl bg-gray-100" />
        <div className="h-80 rounded-2xl bg-gray-100" />
      </div>
      {/* Row 3 */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}

// ─── YoY Comparison Card ──────────────────────────────────────────────────────

function YoyCard({
  label,
  thisYear,
  lastYear,
  formatValue,
  lowerIsBetter = false,
}: {
  label: string
  thisYear: number
  lastYear: number
  formatValue: (n: number) => string
  lowerIsBetter?: boolean
}) {
  const delta =
    lastYear > 0 ? Math.round(((thisYear - lastYear) / lastYear) * 100) : 0
  const improved = lowerIsBetter ? thisYear < lastYear : thisYear > lastYear
  const unchanged = thisYear === lastYear || delta === 0

  return (
    <motion.div variants={cardEntrance} className="ui-glass p-4">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-xl font-black text-gray-900">{formatValue(thisYear)}</p>
      <p className="text-xs text-gray-400 mt-0.5">Last year: {formatValue(lastYear)}</p>
      {!unchanged && (
        <div
          className={`flex items-center gap-1 mt-1.5 text-xs font-semibold ${
            improved ? 'text-primary-600' : 'text-red-600'
          }`}
        >
          {improved ? (
            <TrendingDown className="w-3.5 h-3.5" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5" />
          )}
          {Math.abs(delta)}% {improved ? 'improvement' : 'increase'}
        </div>
      )}
      {unchanged && (
        <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold text-gray-400">
          <Minus className="w-3.5 h-3.5" />
          No change
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface BoardReportPageProps {
  token: string | null
}

export function BoardReportPage({ token }: BoardReportPageProps) {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const { from, to } = getMonthRange(selectedYear, selectedMonth)

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<{
    data: BoardReportMetrics
  }>({
    queryKey: ['board-report', from, to],
    queryFn: async () => {
      const res = await fetch(
        `/api/maintenance/board-report?from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error('Failed to fetch board report')
      return res.json()
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const metrics = data?.data

  const handleRefresh = useCallback(() => {
    refetch()
    setLastRefreshed(new Date())
  }, [refetch])

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleDateString('en-US', { month: 'long' }),
  }))
  const years = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <motion.div
        className="mb-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.div variants={fadeInUp} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Board Report</h1>
              <p className="text-sm text-gray-500">
                Superintendent-ready facility metrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Period picker */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm text-gray-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60"
              title={`Last updated: ${lastRefreshed.toLocaleTimeString()}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Generate Report */}
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </motion.div>

        <motion.p variants={fadeInUp} className="text-xs text-gray-400 mt-2 ml-12">
          Viewing: {formatPeriodLabel(selectedYear, selectedMonth)}
        </motion.p>
      </motion.div>

      {/* ── Metrics Content ─────────────────────────────────────────── */}
      {isLoading || !metrics ? (
        <PageSkeleton />
      ) : (
        <motion.div
          className="space-y-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.05, 0.1)}
        >
          {/* Row 1: FCI + Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div variants={cardEntrance}>
              <FCIScoreCard fci={metrics.fci} />
            </motion.div>
            <BoardMetricsGrid metrics={metrics} />
          </div>

          {/* Row 2: Compliance + Asset Forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div variants={cardEntrance}>
              <ComplianceStatusPanel
                byDomain={metrics.complianceStatus.byDomain}
              />
            </motion.div>
            <motion.div variants={cardEntrance}>
              <AssetForecastPanel
                eolForecast={metrics.assetEOLForecast}
                topRepairCostAssets={metrics.topRepairCostAssets}
              />
            </motion.div>
          </div>

          {/* Row 3: Year-over-Year */}
          <div>
            <motion.h2
              variants={fadeInUp}
              className="text-sm font-semibold text-gray-700 mb-3"
            >
              Year-over-Year Comparison
            </motion.h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <YoyCard
                label="Ticket Volume"
                thisYear={metrics.yoyComparison.thisYear.ticketCount}
                lastYear={metrics.yoyComparison.lastYear.ticketCount}
                formatValue={(n) => `${n} tickets`}
                lowerIsBetter
              />
              <YoyCard
                label="Total Cost"
                thisYear={metrics.yoyComparison.thisYear.totalCost}
                lastYear={metrics.yoyComparison.lastYear.totalCost}
                formatValue={fmt}
                lowerIsBetter
              />
              <YoyCard
                label="Avg Resolution"
                thisYear={metrics.yoyComparison.thisYear.avgResolutionHours}
                lastYear={metrics.yoyComparison.lastYear.avgResolutionHours}
                formatValue={(n) => `${n.toFixed(1)}h`}
                lowerIsBetter
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Generate Report Dialog ─────────────────────────────────── */}
      <GenerateReportDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        token={token}
        onSuccess={() => {
          // Could show a toast here — dialog handles its own feedback
        }}
      />
    </div>
  )
}
