'use client'

import { AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssetRepairGaugeProps {
  cumulativeRepairCost: number
  replacementCost: number
  thresholdPct: number  // 0-1 decimal (e.g. 0.5 = 50%)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AssetRepairGauge({
  cumulativeRepairCost,
  replacementCost,
  thresholdPct,
}: AssetRepairGaugeProps) {
  if (!replacementCost || replacementCost <= 0) {
    return (
      <div className="ui-glass p-4 text-center text-sm text-slate-400">
        Set a replacement cost to track repair-vs-replace health
      </div>
    )
  }

  const pct = Math.min((cumulativeRepairCost / replacementCost) * 100, 100)
  const thresholdPctDisplay = Math.round(thresholdPct * 100)
  const thresholdAmt = replacementCost * thresholdPct
  const halfThreshold = thresholdPct * 0.5

  // Color logic:
  // green if < 50% of threshold
  // amber if between 50% of threshold and threshold
  // red if >= threshold
  const repairRatio = cumulativeRepairCost / replacementCost
  let barColor: string
  if (repairRatio >= thresholdPct) {
    barColor = 'bg-red-500'
  } else if (repairRatio >= halfThreshold) {
    barColor = 'bg-amber-400'
  } else {
    barColor = 'bg-primary-500'
  }

  const isAtThreshold = cumulativeRepairCost >= thresholdAmt

  return (
    <div className="space-y-3">
      {/* Gauge */}
      <div className="ui-glass p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Repair vs. Replacement</span>
          <span className="text-sm font-semibold text-slate-900">
            {Math.round(pct)}%
          </span>
        </div>

        {/* Progress bar track */}
        <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
          {/* Threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
            style={{ left: `${thresholdPctDisplay}%` }}
            title={`Alert threshold: ${thresholdPctDisplay}%`}
          />
          {/* Fill bar */}
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">
            {formatCurrency(cumulativeRepairCost)} cumulative repairs
          </span>
          <span className="text-xs text-slate-500">
            {formatCurrency(replacementCost)} replacement cost
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Alert threshold at {thresholdPctDisplay}% ({formatCurrency(thresholdAmt)})
        </p>
      </div>

      {/* Alert banner — only shown when threshold is met */}
      {isAtThreshold && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">
            Cumulative repairs ({formatCurrency(cumulativeRepairCost)}) have reached{' '}
            {Math.round((cumulativeRepairCost / replacementCost) * 100)}% of replacement cost (
            {formatCurrency(replacementCost)}). Consider replacement.
          </p>
        </div>
      )}
    </div>
  )
}
