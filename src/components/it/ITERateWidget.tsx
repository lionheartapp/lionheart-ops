'use client'

/**
 * ITERateWidget — compact E-Rate snapshot card for the IT dashboard.
 *
 * Surfaces the most recent funding year's commitment + disbursement totals,
 * an invoice-deadline countdown (urgent when ≤ 60 days), and a CTA to the
 * unified Reports & Admin → E-Rate tab. Falls back to an onboarding nudge
 * when the org has no primary BEN configured yet.
 *
 * Visibility: only mount this when the current user has IT_ERATE_VIEW.
 */

const ERATE_TAB_HREF = '/it/admin?tab=erate'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Database,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp } from '@/lib/animations'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ITERateWidgetProps {
  /** Disable the widget entirely (e.g., user lacks IT_ERATE_VIEW). */
  enabled?: boolean
}

interface FundingYearCard {
  fundingYear: number
  ben: string
  applicationStatus: string | null
  totalRequested: number
  totalCommitted: number
  totalDisbursed: number
  category1Committed: number
  category2Committed: number
  invoiceDeadline: string | null
  lastSyncedAt: string | null
}

interface EntityRow {
  id: string
  ben: string
  entityName: string
  isPrimary: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatShortDate(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(value: string | null): number | null {
  if (!value) return null
  const target = new Date(value).getTime()
  if (Number.isNaN(target)) return null
  const diffMs = target - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function statusFor(card: FundingYearCard): 'Funded' | 'Committed' | 'Filed' {
  if (card.totalDisbursed > 0) return 'Funded'
  if (card.totalCommitted > 0) return 'Committed'
  return 'Filed'
}

const STATUS_STYLES: Record<'Funded' | 'Committed' | 'Filed', { bg: string; text: string; dot: string }> = {
  Funded: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  Committed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  Filed: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ITERateWidget({ enabled = true }: ITERateWidgetProps): JSX.Element | null {
  const router = useRouter()

  const entitiesQuery = useQuery({
    queryKey: ['it-erate', 'entities'],
    queryFn: () => fetchApi<EntityRow[]>('/api/it/erate/entities'),
    staleTime: 5 * 60_000,
    enabled,
    retry: false,
  })

  const yearsQuery = useQuery({
    queryKey: ['it-erate', 'funding-years'],
    queryFn: () => fetchApi<FundingYearCard[]>('/api/it/erate/funding-years'),
    staleTime: 60_000,
    enabled,
    retry: false,
  })

  if (!enabled) return null

  const isLoading = entitiesQuery.isLoading || yearsQuery.isLoading
  const isError = entitiesQuery.isError || yearsQuery.isError
  const entities = entitiesQuery.data ?? []
  const years = yearsQuery.data ?? []
  const primary = entities.find((e) => e.isPrimary) ?? null
  const latest = years[0] ?? null

  // ─── Loading skeleton ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-28 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </motion.div>
    )
  }

  // ─── Error state — hide silently (E-Rate is optional) ──────────────────

  if (isError) return null

  // ─── Empty / onboarding state ──────────────────────────────────────────

  if (!primary) {
    return (
      <motion.div
        variants={fadeInUp}
        className="rounded-2xl p-5 shadow-sm backdrop-blur-sm border bg-gradient-to-br from-primary-50/80 to-primary-100/80 border-primary-200/40"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">E-Rate</h3>
          </div>
          <button
            onClick={() => router.push(ERATE_TAB_HREF)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5 cursor-pointer"
          >
            Set up
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          Connect your Billed Entity Number to pull funding commitments, FRNs, and disbursements directly from USAC Open Data.
        </p>
        <button
          onClick={() => router.push(ERATE_TAB_HREF)}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 active:scale-[0.97] transition-all duration-200 cursor-pointer"
        >
          <Database className="w-4 h-4" />
          Add my BEN
        </button>
      </motion.div>
    )
  }

  // ─── Primary state with data ───────────────────────────────────────────

  if (!latest) {
    // Onboarded but no rolled-up year yet (sync not run or USAC has no rows for this BEN).
    return (
      <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">E-Rate</h3>
          </div>
          <button
            onClick={() => router.push(ERATE_TAB_HREF)}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer"
          >
            Open
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <p className="text-sm text-slate-600">
          BEN <span className="font-mono text-slate-800">{primary.ben}</span> is connected, but no funding-year data has synced yet.
        </p>
        <button
          onClick={() => router.push(ERATE_TAB_HREF)}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
        >
          <Loader2 className="w-3.5 h-3.5" />
          Run sync
        </button>
      </motion.div>
    )
  }

  const status = statusFor(latest)
  const styles = STATUS_STYLES[status]
  const utilization =
    latest.totalCommitted > 0
      ? Math.min(100, Math.round((latest.totalDisbursed / latest.totalCommitted) * 100))
      : 0
  const days = daysUntil(latest.invoiceDeadline)
  const deadlineUrgent = days !== null && days <= 60 && days >= 0
  const deadlinePast = days !== null && days < 0

  return (
    <motion.div variants={fadeInUp} className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">E-Rate · FY {latest.fundingYear}</h3>
            <p className="text-[11px] text-slate-400">
              BEN <span className="font-mono">{primary.ben}</span>
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(ERATE_TAB_HREF)}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5 cursor-pointer"
        >
          Details
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${styles.bg} ${styles.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
          {status}
        </span>
        {latest.applicationStatus && (
          <span className="text-[11px] text-slate-400 truncate">{latest.applicationStatus}</span>
        )}
      </div>

      {/* Money rows */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Committed</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">
            {formatMoney(latest.totalCommitted)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Disbursed</p>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">
            {formatMoney(latest.totalDisbursed)}
          </p>
        </div>
      </div>

      {/* Utilization bar */}
      {latest.totalCommitted > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <CircleDollarSign className="w-3 h-3" />
              Utilization
            </span>
            <span className="font-medium text-slate-600">{utilization}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>
      )}

      {/* Deadline */}
      {latest.invoiceDeadline && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            deadlinePast
              ? 'bg-red-50 border-red-100 text-red-700'
              : deadlineUrgent
                ? 'bg-amber-50 border-amber-100 text-amber-800'
                : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}
        >
          <CalendarClock className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-medium opacity-70">
              Invoice deadline
            </p>
            <p className="text-sm font-medium">
              {formatShortDate(latest.invoiceDeadline)}
              {days !== null && (
                <span className="ml-1.5 text-[11px] font-normal opacity-80">
                  {deadlinePast
                    ? `(${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} past)`
                    : days === 0
                      ? '(today)'
                      : `(${days} day${days === 1 ? '' : 's'} left)`}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
