'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { expandCollapse } from '@/lib/animations'
import type { BoardReportMetrics } from '@/lib/services/boardReportService'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)

// ─── EOL forecast chip ────────────────────────────────────────────────────────

function EOLChip({
  label,
  count,
  cost,
}: {
  label: string
  count: number
  cost: number
}) {
  return (
    <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3">
      <p className="text-xs text-emerald-600 font-semibold mb-1">{label}</p>
      <p className="text-lg font-black text-gray-900">{count}</p>
      <p className="text-xs text-gray-500">{fmt(cost)}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssetForecastPanelProps {
  eolForecast: BoardReportMetrics['assetEOLForecast']
  topRepairCostAssets: BoardReportMetrics['topRepairCostAssets']
}

export function AssetForecastPanel({
  eolForecast,
  topRepairCostAssets,
}: AssetForecastPanelProps) {
  const [showAll, setShowAll] = useState(false)

  const visibleAssets = showAll
    ? topRepairCostAssets
    : topRepairCostAssets.slice(0, 5)

  return (
    <div className="ui-glass p-6 space-y-5">
      {/* ── EOL Forecast ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">End-of-Life Forecast</h3>
        <div className="grid grid-cols-3 gap-2">
          <EOLChip
            label="Next 1 Year"
            count={eolForecast.in1Year}
            cost={eolForecast.totalReplacementCost1}
          />
          <EOLChip
            label="3 Years"
            count={eolForecast.in3Years}
            cost={eolForecast.totalReplacementCost3}
          />
          <EOLChip
            label="5 Years"
            count={eolForecast.in5Years}
            cost={eolForecast.totalReplacementCost5}
          />
        </div>
      </div>

      {/* ── Top Repair Cost Assets ────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Repair Cost Assets</h3>

        {topRepairCostAssets.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No asset cost data yet.</p>
        ) : (
          <>
            <div className="ui-glass-table overflow-hidden rounded-xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 text-left">
                    <th className="px-3 py-2.5 text-gray-500 font-semibold w-7">#</th>
                    <th className="px-3 py-2.5 text-gray-500 font-semibold">Asset</th>
                    <th className="px-3 py-2.5 text-gray-500 font-semibold text-right">Repair</th>
                    <th className="px-3 py-2.5 text-gray-500 font-semibold text-right">vs. Replace</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAssets.map((asset, idx) => {
                    const repPct = Math.round(asset.repairPct * 100)
                    const isAlert = repPct >= 50
                    return (
                      <tr
                        key={asset.assetId}
                        className="border-t border-gray-100/60 hover:bg-gray-50/50 transition-colors duration-150"
                      >
                        <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-gray-800 truncate max-w-[120px]">
                            {asset.name}
                          </p>
                          <p className="text-gray-400">{asset.assetNumber}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                          {fmt(asset.cumulativeRepairCost)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isAlert ? 'text-red-600' : 'text-gray-600'
                            }`}
                          >
                            {isAlert && (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {repPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Expand/collapse toggle */}
            <AnimatePresence initial={false}>
              {topRepairCostAssets.length > 5 && (
                <motion.button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1.5 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Show fewer
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Show all {topRepairCostAssets.length}
                    </>
                  )}
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}
