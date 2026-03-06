'use client'

import { motion } from 'framer-motion'
import {
  DollarSign,
  Activity,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { staggerContainer, cardEntrance } from '@/lib/animations'
import type { BoardReportMetrics } from '@/lib/services/boardReportService'

interface BoardMetricsGridProps {
  metrics: BoardReportMetrics
}

// ─── PM Ratio Bar ─────────────────────────────────────────────────────────────

function PMRatioBar({ pmPct }: { pmPct: number }) {
  const isGood = pmPct >= 60
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{pmPct}% Preventive</span>
        <span>{100 - pmPct}% Reactive</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-2 rounded-full ${isGood ? 'bg-primary-500' : 'bg-amber-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pmPct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </div>
  )
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: React.ReactNode
  accent?: 'green' | 'amber' | 'blue' | 'default'
}

function MetricCard({ icon, label, value, subValue, accent = 'default' }: MetricCardProps) {
  const accentMap = {
    green: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    default: 'bg-gray-100 text-gray-600',
  }
  return (
    <motion.div
      variants={cardEntrance}
      className="ui-glass p-4"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accentMap[accent]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-0.5">{label}</p>
          <p className="text-xl font-black text-gray-900 leading-tight">{value}</p>
          {subValue && <div className="mt-1">{subValue}</div>}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardMetricsGrid({ metrics }: BoardMetricsGridProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

  return (
    <motion.div
      className="grid grid-cols-2 gap-3"
      variants={staggerContainer(0.1)}
      initial="hidden"
      animate="visible"
    >
      {/* Cost Per Student */}
      <MetricCard
        icon={<DollarSign className="w-4 h-4" />}
        label="Cost Per Student"
        value={
          metrics.costPerStudent != null
            ? `$${metrics.costPerStudent.toFixed(2)}`
            : 'N/A'
        }
        subValue={
          metrics.costPerStudent == null ? (
            <p className="text-[10px] text-gray-400">
              Set student count in{' '}
              <a href="/settings?tab=school-info" className="text-primary-600 underline cursor-pointer">
                School Info settings
              </a>
            </p>
          ) : (
            <p className="text-xs text-gray-500">Per enrolled student</p>
          )
        }
        accent="green"
      />

      {/* PM vs Reactive */}
      <MetricCard
        icon={<Activity className="w-4 h-4" />}
        label="PM vs Reactive Ratio"
        value={`${metrics.pmVsReactiveRatio.pmPct}%`}
        subValue={
          <PMRatioBar pmPct={metrics.pmVsReactiveRatio.pmPct} />
        }
        accent={metrics.pmVsReactiveRatio.pmPct >= 60 ? 'green' : 'amber'}
      />

      {/* Deferred Backlog */}
      <MetricCard
        icon={<AlertTriangle className="w-4 h-4" />}
        label="Deferred Backlog"
        value={`${metrics.deferredBacklog.count} tickets`}
        subValue={
          <p className="text-xs text-gray-500">
            {fmt(metrics.deferredBacklog.estimatedCostUSD)} est. cost
          </p>
        }
        accent={metrics.deferredBacklog.count > 10 ? 'amber' : 'default'}
      />

      {/* Response + Resolution Time */}
      <MetricCard
        icon={<Clock className="w-4 h-4" />}
        label="Response Time"
        value={`${metrics.responseTime.avgHours.toFixed(1)}h`}
        subValue={
          <p className="text-xs text-gray-500">
            Resolution avg: {metrics.resolutionTime.avgHours.toFixed(1)}h
          </p>
        }
        accent="blue"
      />
    </motion.div>
  )
}
