'use client'

/**
 * BudgetReportView — Budget vs actual report with per-participant cost analysis.
 *
 * Data-dense spreadsheet-style layout:
 * 1. Summary row: Total Budgeted, Total Actual, Variance, Revenue, Net Position
 * 2. Per-category breakdown table
 * 3. Per-participant cost analysis
 */

import { motion } from 'framer-motion'
import {
  TrendingDown,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
} from 'lucide-react'
import { staggerContainer, listItem } from '@/lib/animations'
import type { BudgetReportData } from '@/lib/types/budget'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatPercent(value: number): string {
  return `${Math.min(value, 999).toFixed(0)}%`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  sub?: string
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
}

function StatCard({ label, value, sub, variant = 'default', icon: Icon }: StatCardProps) {
  const iconBg: Record<string, string> = {
    default: 'bg-indigo-50 text-indigo-500',
    positive: 'bg-green-50 text-green-500',
    negative: 'bg-red-50 text-red-500',
    neutral: 'bg-slate-50 text-slate-500',
  }
  const valueColor: Record<string, string> = {
    default: 'text-slate-900',
    positive: 'text-green-700',
    negative: 'text-red-700',
    neutral: 'text-slate-700',
  }

  return (
    <div className="ui-glass rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg[variant]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className={`text-lg font-bold font-mono mt-0.5 ${valueColor[variant]}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface BudgetReportViewProps {
  report: BudgetReportData
}

export function BudgetReportView({ report }: BudgetReportViewProps) {
  const variance = report.totalBudgeted - report.totalActual
  const isOverBudget = variance < 0
  const netPositive = report.netPosition >= 0

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Summary cards ── */}
      <motion.div variants={listItem} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Budgeted"
          value={formatCurrency(report.totalBudgeted)}
          icon={DollarSign}
          variant="neutral"
        />
        <StatCard
          label="Total Actual"
          value={formatCurrency(report.totalActual)}
          sub={`${report.totalBudgeted > 0 ? formatPercent((report.totalActual / report.totalBudgeted) * 100) : '—'} of budget`}
          icon={BarChart3}
          variant={isOverBudget ? 'negative' : 'default'}
        />
        <StatCard
          label="Variance"
          value={formatCurrency(Math.abs(variance))}
          sub={isOverBudget ? 'over budget' : 'under budget'}
          icon={isOverBudget ? TrendingUp : TrendingDown}
          variant={isOverBudget ? 'negative' : 'positive'}
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(report.totalRevenue)}
          icon={DollarSign}
          variant="neutral"
        />
        <StatCard
          label="Net Position"
          value={formatCurrency(Math.abs(report.netPosition))}
          sub={netPositive ? 'revenue exceeds costs' : 'costs exceed revenue'}
          icon={netPositive ? TrendingDown : TrendingUp}
          variant={netPositive ? 'positive' : 'negative'}
        />
        <StatCard
          label="Cost Per Participant"
          value={report.registrationCount > 0 ? formatCurrency(report.perParticipantCost) : '—'}
          sub={
            report.registrationCount > 0
              ? `${report.registrationCount} participant${report.registrationCount !== 1 ? 's' : ''}`
              : 'No registrations yet'
          }
          icon={Users}
          variant="neutral"
        />
      </motion.div>

      {/* ── Per-category breakdown ── */}
      <motion.div variants={listItem} className="ui-glass-table rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Category Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Category
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Budgeted
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Actual
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Variance
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                  % Used
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {report.categories.map((cat) => {
                const catVariance = cat.totalBudgeted - cat.totalActual
                const catOver = catVariance < 0
                const pctUsed =
                  cat.totalBudgeted > 0
                    ? (cat.totalActual / cat.totalBudgeted) * 100
                    : cat.totalActual > 0
                    ? 100
                    : 0

                return (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-800">{cat.name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {cat.lineItemCount} {cat.lineItemCount === 1 ? 'item' : 'items'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-700">
                      {formatCurrency(cat.totalBudgeted)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-700">
                      {formatCurrency(cat.totalActual)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono text-xs font-semibold ${
                        catOver ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      <span className="flex items-center justify-end gap-1">
                        {catOver ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {formatCurrency(Math.abs(catVariance))}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Mini progress bar */}
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pctUsed > 100 ? 'bg-red-500' : pctUsed > 80 ? 'bg-amber-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(pctUsed, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            pctUsed > 100 ? 'text-red-600' : pctUsed > 80 ? 'text-amber-600' : 'text-slate-600'
                          }`}
                        >
                          {formatPercent(pctUsed)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-slate-900">
                <td className="px-5 py-3 text-sm font-semibold text-white">Grand Total</td>
                <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-slate-300">
                  {formatCurrency(report.totalBudgeted)}
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-slate-300">
                  {formatCurrency(report.totalActual)}
                </td>
                <td
                  className={`px-5 py-3 text-right font-mono text-xs font-bold ${
                    isOverBudget ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  <span className="flex items-center justify-end gap-1">
                    {isOverBudget ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {formatCurrency(Math.abs(variance))}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-xs text-slate-400">
                  {report.totalBudgeted > 0
                    ? formatPercent((report.totalActual / report.totalBudgeted) * 100)
                    : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>

      {/* ── Per-participant cost ── */}
      <motion.div variants={listItem} className="ui-glass rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Per-Participant Cost</h3>
            <p className="text-xs text-slate-400">Total actual costs divided by registrations</p>
          </div>
        </div>

        {report.registrationCount === 0 ? (
          <p className="text-sm text-slate-400 py-2">
            No registrations yet. Per-participant cost will appear once registrations are confirmed.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center py-3 px-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Registrations</p>
              <p className="text-2xl font-bold text-slate-900">{report.registrationCount}</p>
            </div>
            <div className="text-center py-3 px-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Total Actual Cost</p>
              <p className="text-lg font-bold text-slate-900 font-mono">
                {formatCurrency(report.totalActual)}
              </p>
            </div>
            <div className="text-center py-3 px-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-600 mb-1 font-medium">Cost Per Person</p>
              <p className="text-2xl font-bold text-indigo-700 font-mono">
                {formatCurrency(report.perParticipantCost)}
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
