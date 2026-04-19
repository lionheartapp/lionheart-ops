'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Building2,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import ITPageShell from '@/components/it/ITPageShell'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { usePageTitle } from '@/hooks/usePageTitle'
import { fetchApi } from '@/lib/api-client'

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────

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

interface DatasetRunResult {
  datasetKey: string
  datasetId: string
  status: 'success' | 'error'
  rowsFetched: number
  rowsUpserted: number
  durationMs: number
  errorMessage?: string
}

interface SyncResponse {
  organizationId: string
  ben: string
  startedAt: string
  finishedAt: string
  datasets: DatasetRunResult[]
  rollupRows: number
}

interface EntityRow {
  id: string
  ben: string
  entityName: string
  isPrimary: boolean
  state: string | null
}

// ───────────────────────────────────────────────────────────────────────────────
// API helpers — thin wrappers around fetchApi for typed JSON post/get
// ───────────────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  return fetchApi<T>(path)
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ───────────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────────

const BEN_REGEX = /^\d{1,12}$/

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ERatePageInner() {
  usePageTitle('E-Rate')

  const [entities, setEntities] = useState<EntityRow[]>([])
  const [years, setYears] = useState<FundingYearCard[]>([])
  const [primaryBen, setPrimaryBen] = useState<string | null>(null)
  const [benInput, setBenInput] = useState('')
  const [benError, setBenError] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const refreshAll = useCallback(async () => {
    const [ents, ys] = await Promise.all([
      apiGet<EntityRow[]>('/api/it/erate/entities'),
      apiGet<FundingYearCard[]>('/api/it/erate/funding-years'),
    ])
    setEntities(ents)
    setYears(ys)
    const primary = ents.find((e) => e.isPrimary) ?? ents[0] ?? null
    setPrimaryBen(primary?.ben ?? null)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await refreshAll()
      } catch (error: unknown) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Failed to load')
        }
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshAll])

  const validateBen = (value: string): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return 'Enter your Billed Entity Number to continue.'
    if (!BEN_REGEX.test(trimmed)) return 'BEN must be a numeric value (up to 12 digits).'
    return null
  }

  const handleAddBen = async () => {
    const err = validateBen(benInput)
    setBenError(err)
    if (err) return
    setSyncing(true)
    setSyncError(null)
    setSyncResult(null)
    try {
      const ben = benInput.trim()
      await apiPost<EntityRow>('/api/it/erate/entities', { ben, isPrimary: true })
      const result = await apiPost<SyncResponse>('/api/it/erate/sync', { ben })
      setSyncResult(result)
      await refreshAll()
      setBenInput('')
    } catch (error: unknown) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleResync = async () => {
    if (!primaryBen) return
    setSyncing(true)
    setSyncError(null)
    setSyncResult(null)
    try {
      const result = await apiPost<SyncResponse>('/api/it/erate/sync', { ben: primaryBen })
      setSyncResult(result)
      await refreshAll()
    } catch (error: unknown) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const headerSubtitle = useMemo(() => {
    if (loadingInitial) return 'Loading…'
    if (!primaryBen) return 'Connect your Billed Entity Number to pull funding data from USAC Open Data.'
    return `Synced from USAC Open Data for BEN ${primaryBen}`
  }, [loadingInitial, primaryBen])

  return (
    <div>
      <motion.div
        className="mb-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
          E-Rate
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          {headerSubtitle}
        </motion.p>
      </motion.div>

      {!loadingInitial && !primaryBen && (
        <BenOnboardingCard
          benInput={benInput}
          benError={benError}
          syncing={syncing}
          syncError={syncError}
          onChange={(v) => {
            setBenInput(v)
            setBenError(null)
          }}
          onSubmit={handleAddBen}
        />
      )}

      {primaryBen && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-2 text-primary-700">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                BEN {primaryBen}
                {entities.find((e) => e.ben === primaryBen)?.entityName && (
                  <span className="ml-2 text-slate-500">
                    · {entities.find((e) => e.ben === primaryBen)?.entityName}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {entities.length > 1
                  ? `${entities.length - 1} additional ${entities.length - 1 === 1 ? 'entity' : 'entities'} on file`
                  : 'Primary entity'}
              </div>
            </div>
          </div>
          <button
            onClick={handleResync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? 'Syncing…' : 'Refresh from USAC'}
          </button>
        </div>
      )}

      {syncError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <TriangleAlert className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">Sync error</div>
            <div className="mt-0.5">{syncError}</div>
          </div>
        </div>
      )}

      {syncResult && <SyncSummary result={syncResult} />}

      {primaryBen && <FundingYearGrid years={years} loading={loadingInitial} />}

      <RetentionFooter />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────────

function BenOnboardingCard({
  benInput,
  benError,
  syncing,
  syncError,
  onChange,
  onSubmit,
}: {
  benInput: string
  benError: string | null
  syncing: boolean
  syncError: string | null
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-gradient-to-br from-primary-50 to-primary-100 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-white p-2 text-primary-700 shadow-sm">
          <Database className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">Connect your USAC data</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter your Billed Entity Number and we&apos;ll pull every Form 470, Form 471, FRN, and
            invoice on file with USAC. No login to EPC required — this uses USAC&apos;s public Open
            Data feeds.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <label htmlFor="ben-input" className="sr-only">
                Billed Entity Number
              </label>
              <input
                id="ben-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 16029999"
                value={benInput}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmit()
                }}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  benError ? 'border-red-300' : 'border-slate-200'
                }`}
                aria-invalid={Boolean(benError)}
                aria-describedby={benError ? 'ben-error' : undefined}
                disabled={syncing}
              />
              {benError && (
                <div id="ben-error" className="mt-1 text-xs text-red-700">
                  {benError}
                </div>
              )}
            </div>
            <button
              onClick={onSubmit}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing from USAC…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Pull my data
                </>
              )}
            </button>
          </div>
          {syncError && (
            <div className="mt-3 text-xs text-red-700">{syncError}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function SyncSummary({ result }: { result: SyncResponse }) {
  const okCount = result.datasets.filter((d) => d.status === 'success').length
  const errCount = result.datasets.length - okCount
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        Last sync: {okCount} of {result.datasets.length} datasets succeeded
        {errCount > 0 && <span className="ml-1 text-red-600">({errCount} failed)</span>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {result.datasets.map((d) => (
          <div
            key={d.datasetKey}
            className={`rounded-lg border p-3 text-xs ${
              d.status === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <div className="font-medium">{d.datasetKey}</div>
            <div className="mt-0.5 opacity-80">
              {d.status === 'success'
                ? `${d.rowsUpserted.toLocaleString()} rows · ${(d.durationMs / 1000).toFixed(1)}s`
                : (d.errorMessage ?? 'Failed')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FundingYearGrid({ years, loading }: { years: FundingYearCard[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    )
  }

  if (years.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <div className="text-sm font-medium text-slate-900">No funding years on file yet.</div>
        <div className="mt-1 text-sm text-slate-500">
          Once you sync, USAC&apos;s data for every funding year you&apos;ve filed will appear here
          (typically the last 10 funding years).
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {years.map((y) => (
        <FundingYearCardView key={`${y.ben}-${y.fundingYear}`} year={y} />
      ))}
    </div>
  )
}

function FundingYearCardView({ year }: { year: FundingYearCard }) {
  const status = year.applicationStatus ?? 'Unknown'
  const tone =
    status === 'Funded'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'Committed'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-amber-100 text-amber-700'
  const utilization =
    year.totalCommitted > 0
      ? Math.min(100, Math.round((year.totalDisbursed / year.totalCommitted) * 100))
      : 0

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-200 hover:border-slate-300">
      <div className="flex items-baseline justify-between">
        <div className="text-lg font-semibold text-slate-900">FY{year.fundingYear}</div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <Row label="Requested" value={formatMoney(year.totalRequested)} />
        <Row label="Committed" value={formatMoney(year.totalCommitted)} />
        <Row label="Disbursed" value={formatMoney(year.totalDisbursed)} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Disbursed vs. committed</span>
          <span>{utilization}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Invoice deadline: {formatDate(year.invoiceDeadline)}</span>
        <span>Synced {formatDate(year.lastSyncedAt)}</span>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

function RetentionFooter() {
  return (
    <div className="mt-10 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <ShieldCheck className="mt-0.5 h-4 w-4 text-slate-400" />
      <div>
        Funding data is mirrored from USAC&apos;s public Open Data feeds. Per FCC 47 CFR § 54.516,
        you remain responsible for retaining audit-side documents (board approvals, bid responses,
        contracts, vendor invoices) for 10 years from the last day of the relevant funding year.
        Upload those under <span className="font-medium text-slate-900">E-Rate → Documents</span>.
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// Default export (wrapped in shell)
// ───────────────────────────────────────────────────────────────────────────────

export default function ERatePage() {
  return (
    <ITPageShell>
      <ERatePageInner />
    </ITPageShell>
  )
}
