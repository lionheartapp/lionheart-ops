'use client'

/**
 * ERateOnboardingPanel — the BEN onboarding + USAC sync + funding-year
 * experience. Composed inside ITERateUnifiedTab, which is the only entry
 * point — the standalone /it/erate route now redirects to
 * /it/admin?tab=erate so there's a single canonical home for E-Rate.
 *
 * Props:
 *   showHeader  — render the "Funding-year mirror …" header & description.
 *                 Defaults to true; the unified tab passes false because
 *                 the section already has its own heading.
 *   showFooter  — render the FCC §54.516 retention footer. Defaults to true;
 *                 the unified tab passes false because the footer is rendered
 *                 once at the bottom of the whole page instead.
 *
 * Everything that talks to the network goes through fetchApi, which uses the
 * cookie-based session. The component owns its own state and is safe to mount
 * multiple times on a page (each instance fetches independently).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { fetchApi } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'
import ERateFundingYearDetail from './ERateFundingYearDetail'

// ─── Types ──────────────────────────────────────────────────────────────

interface ERateOnboardingPanelProps {
  /** Render the page-level "E-Rate" title above the panel. Defaults to true. */
  showHeader?: boolean
  /** Render the FCC §54.516 retention footer at the bottom. Defaults to true. */
  showFooter?: boolean
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
  schoolId: string | null
  school: { id: string; name: string } | null
}

// ─── API helpers ────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  return fetchApi<T>(path)
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return fetchApi<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

async function apiDelete<T>(path: string): Promise<T> {
  return fetchApi<T>(path, { method: 'DELETE' })
}

interface DeleteSummary {
  ben: string
  deletedFundingYears: number
  deletedForm470s: number
  deletedForm471s: number
  deletedFrns: number
  deletedDisbursements: number
  deletedSyncRuns: number
  promotedNewPrimary: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────

const BEN_REGEX = /^\d{1,12}$/

function formatMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Main component ─────────────────────────────────────────────────────

export default function ERateOnboardingPanel({
  showHeader = true,
  showFooter = true,
}: ERateOnboardingPanelProps): JSX.Element {
  const [entities, setEntities] = useState<EntityRow[]>([])
  const [years, setYears] = useState<FundingYearCard[]>([])
  const [primaryBen, setPrimaryBen] = useState<string | null>(null)
  const [benInput, setBenInput] = useState('')
  const [benError, setBenError] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [confirmDeleteBen, setConfirmDeleteBen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null)
  const [selectedFY, setSelectedFY] = useState<{ fundingYear: number; ben: string } | null>(null)
  const [filterBen, setFilterBen] = useState<string | null>(null) // null = all campuses

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

  const handleAddBen = async (): Promise<void> => {
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

  const handleResync = async (): Promise<void> => {
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

  const handleConfirmDelete = async (): Promise<void> => {
    if (!confirmDeleteBen) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const summary = await apiDelete<DeleteSummary>(
        `/api/it/erate/entities/${encodeURIComponent(confirmDeleteBen)}`
      )
      setSyncResult(null)
      setSyncError(null)
      setDeleteNotice(
        summary.promotedNewPrimary
          ? `Removed BEN ${summary.ben}. BEN ${summary.promotedNewPrimary} is now your primary entity.`
          : `Removed BEN ${summary.ben} and all synced USAC data.`
      )
      setConfirmDeleteBen(null)
      await refreshAll()
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const filteredYears = useMemo(() => {
    if (!filterBen) return years
    return years.filter((y) => y.ben === filterBen)
  }, [years, filterBen])

  const headerSubtitle = useMemo(() => {
    if (loadingInitial) return 'Loading…'
    if (!primaryBen) return 'Connect your Billed Entity Number to pull funding data from USAC Open Data.'
    return `Synced from USAC Open Data for BEN ${primaryBen}`
  }, [loadingInitial, primaryBen])

  return (
    <div>
      {showHeader && (
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
      )}

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

      {primaryBen && !selectedFY && (
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleResync}
              disabled={syncing || deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncing ? 'Syncing…' : 'Refresh from USAC'}
            </button>
            <button
              onClick={() => {
                setDeleteError(null)
                setConfirmDeleteBen(primaryBen)
              }}
              disabled={syncing || deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors duration-200 hover:bg-red-50 hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              title="Remove this BEN and all its synced data"
            >
              <Trash2 className="h-4 w-4" />
              Remove BEN
            </button>
          </div>
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

      {deleteNotice && (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>{deleteNotice}</div>
          </div>
          <button
            onClick={() => setDeleteNotice(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {syncResult && <SyncSummary result={syncResult} />}

      {primaryBen && !selectedFY && entities.length > 1 && (
        <CampusBenSelector
          entities={entities}
          years={years}
          selectedBen={filterBen}
          onSelect={setFilterBen}
        />
      )}

      {primaryBen && !selectedFY && (
        <FundingYearGrid
          years={filteredYears}
          loading={loadingInitial}
          onSelect={(fy, ben) => setSelectedFY({ fundingYear: fy, ben })}
        />
      )}

      {selectedFY && (
        <ERateFundingYearDetail
          fundingYear={selectedFY.fundingYear}
          ben={selectedFY.ben}
          onBack={() => setSelectedFY(null)}
        />
      )}

      {showFooter && <RetentionFooter />}

      <DeleteBenDialog
        ben={confirmDeleteBen}
        deleting={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (deleting) return
          setConfirmDeleteBen(null)
          setDeleteError(null)
        }}
      />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────

interface BenOnboardingCardProps {
  benInput: string
  benError: string | null
  syncing: boolean
  syncError: string | null
  onChange: (v: string) => void
  onSubmit: () => void
}

function BenOnboardingCard({
  benInput,
  benError,
  syncing,
  syncError,
  onChange,
  onSubmit,
}: BenOnboardingCardProps): JSX.Element {
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
              <Input
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
                size="sm"
                className={`w-full text-sm ${
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
          {syncError && <div className="mt-3 text-xs text-red-700">{syncError}</div>}
        </div>
      </div>
    </div>
  )
}

interface SyncSummaryProps {
  result: SyncResponse
}

function SyncSummary({ result }: SyncSummaryProps): JSX.Element {
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

interface FundingYearGridProps {
  years: FundingYearCard[]
  loading: boolean
  onSelect: (fundingYear: number, ben: string) => void
}

function FundingYearGrid({ years, loading, onSelect }: FundingYearGridProps): JSX.Element {
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
        <FundingYearCardView
          key={`${y.ben}-${y.fundingYear}`}
          year={y}
          onSelect={() => onSelect(y.fundingYear, y.ben)}
        />
      ))}
    </div>
  )
}

interface FundingYearCardViewProps {
  year: FundingYearCard
  onSelect: () => void
}

function FundingYearCardView({ year, onSelect }: FundingYearCardViewProps): JSX.Element {
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
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-primary-300 hover:shadow-md cursor-pointer">
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

interface RowProps {
  label: string
  value: string
}

function Row({ label, value }: RowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function RetentionFooter(): JSX.Element {
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

// ─── Campus BEN Selector ────────────────────────────────────────────────

interface CampusBenSelectorProps {
  entities: EntityRow[]
  years: FundingYearCard[]
  selectedBen: string | null
  onSelect: (ben: string | null) => void
}

function CampusBenSelector({ entities, years, selectedBen, onSelect }: CampusBenSelectorProps): JSX.Element {
  const totalCommitted = years.reduce((sum, y) => sum + y.totalCommitted, 0)

  const commitmentByBen = useMemo(() => {
    const map = new Map<string, number>()
    for (const y of years) {
      map.set(y.ben, (map.get(y.ben) ?? 0) + y.totalCommitted)
    }
    return map
  }, [years])

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {/* All Campuses */}
        <button
          onClick={() => onSelect(null)}
          className={`flex-shrink-0 rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer ${
            selectedBen === null
              ? 'border-primary-300 bg-primary-50 shadow-sm ring-1 ring-primary-200'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="text-sm font-semibold text-slate-900">All Campuses</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {entities.length} BEN{entities.length !== 1 ? 's' : ''} · {formatMoney(totalCommitted)} committed
          </div>
        </button>

        {/* Per-campus */}
        {entities.map((entity) => (
          <button
            key={entity.ben}
            onClick={() => onSelect(entity.ben)}
            className={`flex-shrink-0 rounded-xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer ${
              selectedBen === entity.ben
                ? 'border-primary-300 bg-primary-50 shadow-sm ring-1 ring-primary-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="text-sm font-semibold text-slate-900">
              {entity.school?.name ?? entity.entityName}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              BEN {entity.ben} · {formatMoney(commitmentByBen.get(entity.ben) ?? 0)} committed
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface DeleteBenDialogProps {
  ben: string | null
  deleting: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteBenDialog({
  ben,
  deleting,
  error,
  onConfirm,
  onCancel,
}: DeleteBenDialogProps): JSX.Element {
  const isOpen = ben !== null
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Esc to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, deleting, onCancel])

  // Initial focus on cancel (safer default)
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus()
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!deleting) onCancel()
            }}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-ben-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-50 p-2 text-red-600">
                <TriangleAlert className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 id="delete-ben-title" className="text-base font-semibold text-slate-900">
                  Remove BEN {ben}?
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  This deletes the BEN from your organization along with every funding year, Form
                  470, Form 471, FRN, disbursement, and sync history we&apos;ve mirrored for it. The
                  data still lives at USAC — you can re-add the BEN at any time and re-sync to pull
                  it back.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Remove BEN
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
