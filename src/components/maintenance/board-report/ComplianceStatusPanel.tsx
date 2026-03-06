'use client'

import { ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, listItem } from '@/lib/animations'
import type { BoardReportMetrics } from '@/lib/services/boardReportService'

// ─── Status badge config ──────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  AHERA: 'Asbestos (AHERA)',
  FIRE_SAFETY: 'Fire Safety',
  PLAYGROUND: 'Playground Safety',
  LEAD_WATER: 'Lead in Water',
  BOILER: 'Boiler Inspection',
  ELEVATOR: 'Elevator Inspection',
  KITCHEN: 'Kitchen Health',
  ADA: 'ADA Accessibility',
  RADON: 'Radon Testing',
  IPM: 'Pest Management (IPM)',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex gap-3 items-center h-9 px-3 rounded-xl bg-gray-50">
          <div className="h-3 w-40 bg-gray-200 rounded" />
          <div className="h-5 w-16 bg-gray-200 rounded-full ml-auto" />
          <div className="h-3 w-10 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function PctBadge({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : pct >= 50
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {pct}%
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ComplianceStatusPanelProps {
  byDomain: BoardReportMetrics['complianceStatus']['byDomain']
  loading?: boolean
}

export function ComplianceStatusPanel({ byDomain, loading }: ComplianceStatusPanelProps) {
  const domains = Object.entries(byDomain)
  const totalCurrent = domains.reduce((sum, [, d]) => sum + d.current, 0)
  const totalAll = domains.reduce((sum, [, d]) => sum + d.total, 0)
  const overallPct = totalAll > 0 ? Math.round((totalCurrent / totalAll) * 100) : 0

  return (
    <div className="ui-glass p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Compliance Status</h3>
          <p className="text-xs text-gray-500 mt-0.5">Regulatory domain current status</p>
        </div>
        <div className="flex items-center gap-2">
          {totalAll > 0 && <PctBadge pct={overallPct} />}
          <a
            href="/maintenance/compliance"
            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer"
          >
            Details <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : domains.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">No compliance records yet.</p>
          <a href="/maintenance/compliance" className="text-xs text-emerald-600 hover:underline cursor-pointer">
            Configure compliance domains
          </a>
        </div>
      ) : (
        <div className="ui-glass-table overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left">
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500">Domain</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">Current</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-center">Overdue</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 text-right">% Current</th>
              </tr>
            </thead>
            <motion.tbody
              variants={staggerContainer(0.04)}
              initial="hidden"
              animate="visible"
            >
              {domains.map(([domain, d]) => (
                <motion.tr
                  key={domain}
                  variants={listItem}
                  className="border-t border-gray-100/60 hover:bg-emerald-50/30 transition-colors duration-150"
                >
                  <td className="px-3 py-2.5 text-gray-700 font-medium text-xs">
                    {DOMAIN_LABELS[domain] ?? domain.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs font-semibold text-emerald-600">{d.current}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {d.overdue > 0 ? (
                      <span className="text-xs font-semibold text-red-600">{d.overdue}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PctBadge pct={d.pct} />
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </div>
  )
}
