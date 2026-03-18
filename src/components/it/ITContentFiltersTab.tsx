'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { fetchApi } from '@/lib/api-client'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { IllustrationSecurity } from '@/components/illustrations'
import {
  Shield,
  ShieldAlert,
  Clock,
  Wifi,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Settings,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  FileText,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────

interface ITContentFiltersTabProps {
  canManage: boolean
  canConfigure: boolean
  canViewAdminOnly: boolean
}

interface FilterConfig {
  id: string
  provider: 'GOGUARDIAN' | 'SECURLY' | 'LIGHTSPEED' | 'BARK'
  isEnabled: boolean
  webhookSecret?: string
  lastSyncAt: string | null
}

interface FilterEvent {
  id: string
  platform: 'GOGUARDIAN' | 'SECURLY' | 'LIGHTSPEED' | 'BARK'
  eventType: 'UNBLOCK_REQUEST' | 'SAFETY_ALERT' | 'FILTER_EXCEPTION' | 'BLOCK_EVENT'
  studentName: string | null
  studentEmail: string | null
  url: string | null
  disposition: 'PENDING' | 'APPROVED' | 'DENIED' | 'ESCALATED'
  createdAt: string
  notes: string | null
}

interface FilterEventsResponse {
  events: FilterEvent[]
  total: number
}

type Platform = 'GOGUARDIAN' | 'SECURLY' | 'LIGHTSPEED' | 'BARK'
type EventType = 'UNBLOCK_REQUEST' | 'SAFETY_ALERT' | 'FILTER_EXCEPTION' | 'BLOCK_EVENT'
type Disposition = 'PENDING' | 'APPROVED' | 'DENIED' | 'ESCALATED'

// ─── Constants ─────────────────────────────────────────────────────────

const PLATFORMS: { key: Platform; label: string; color: string }[] = [
  { key: 'GOGUARDIAN', label: 'GoGuardian', color: '#4285F4' },
  { key: 'SECURLY', label: 'Securly', color: '#00BFA5' },
  { key: 'LIGHTSPEED', label: 'Lightspeed', color: '#FF6D00' },
  { key: 'BARK', label: 'Bark', color: '#7C3AED' },
]

const EVENT_TYPES: { key: EventType; label: string }[] = [
  { key: 'UNBLOCK_REQUEST', label: 'Unblock Request' },
  { key: 'SAFETY_ALERT', label: 'Safety Alert' },
  { key: 'FILTER_EXCEPTION', label: 'Filter Exception' },
  { key: 'BLOCK_EVENT', label: 'Block Event' },
]

const DISPOSITIONS: { key: Disposition; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'DENIED', label: 'Denied' },
  { key: 'ESCALATED', label: 'Escalated' },
]

const PAGE_SIZE = 20

// ─── Helpers ───────────────────────────────────────────────────────────

function truncateUrl(url: string, maxLen = 40): string {
  if (url.length <= maxLen) return url
  return url.substring(0, maxLen) + '...'
}

function dispositionBadge(d: Disposition) {
  switch (d) {
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-700'
    case 'APPROVED':
      return 'bg-green-100 text-green-700'
    case 'DENIED':
      return 'bg-red-100 text-red-700'
    case 'ESCALATED':
      return 'bg-orange-100 text-orange-700'
  }
}

function eventTypeLabel(t: EventType): string {
  return EVENT_TYPES.find((e) => e.key === t)?.label ?? t
}

function platformLabel(p: Platform): string {
  return PLATFORMS.find((pl) => pl.key === p)?.label ?? p
}

function platformColor(p: Platform): string {
  return PLATFORMS.find((pl) => pl.key === p)?.color ?? '#6B7280'
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function ContentFiltersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Platform cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ui-glass p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ui-glass p-4 text-center">
            <div className="h-8 w-12 mx-auto bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-3 w-20 mx-auto bg-slate-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="ui-glass p-6">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 flex-1 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────

export default function ITContentFiltersTab({
  canManage,
  canConfigure,
  canViewAdminOnly,
}: ITContentFiltersTabProps) {
  const queryClient = useQueryClient()

  // ── Filter state ───────────────────────────────────────────────────
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [dispositionFilter, setDispositionFilter] = useState<string>('')
  const [page, setPage] = useState(0)

  // ── Config form state ──────────────────────────────────────────────
  const [configuringProvider, setConfiguringProvider] = useState<Platform | null>(null)
  const [configForm, setConfigForm] = useState<{ webhookSecret: string; isEnabled: boolean }>({
    webhookSecret: '',
    isEnabled: false,
  })
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null)

  // ── CIPA toggle ────────────────────────────────────────────────────
  const [showCIPAEvidence, setShowCIPAEvidence] = useState(false)

  // ── Queries ────────────────────────────────────────────────────────
  const configsQuery = useQuery(queryOptions.itFilterConfigs())

  const eventsFilters = useMemo(() => {
    const f: Record<string, string> = {
      offset: String(page * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    }
    if (platformFilter) f.platform = platformFilter
    if (typeFilter) f.eventType = typeFilter
    if (dispositionFilter) f.disposition = dispositionFilter
    return f
  }, [platformFilter, typeFilter, dispositionFilter, page])

  const eventsQuery = useQuery(queryOptions.itFilterEvents(eventsFilters))

  // ── Derived data ───────────────────────────────────────────────────
  const configs = (configsQuery.data as FilterConfig[] | undefined) ?? []
  const eventsData = eventsQuery.data as FilterEventsResponse | undefined
  const events = eventsData?.events ?? []
  const totalEvents = eventsData?.total ?? 0

  const stats = useMemo(() => {
    const pendingCount = events.filter((e) => e.disposition === 'PENDING').length
    const safetyAlertCount = events.filter((e) => e.eventType === 'SAFETY_ALERT').length
    const activePlatforms = configs.filter((c) => c.isEnabled).length
    return {
      totalEvents,
      pendingCount,
      safetyAlertCount,
      activePlatforms,
    }
  }, [events, configs, totalEvents])

  const totalPages = Math.ceil(totalEvents / PAGE_SIZE)

  // ── Mutations ──────────────────────────────────────────────────────
  const configMutation = useMutation({
    mutationFn: async ({ provider, body }: { provider: Platform; body: { webhookSecret: string; isEnabled: boolean } }) => {
      return fetchApi(`/api/it/content-filters/config/${provider}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itFilterConfigs.all })
      setConfiguringProvider(null)
    },
  })

  const dispositionMutation = useMutation({
    mutationFn: async ({ id, disposition }: { id: string; disposition: Disposition }) => {
      return fetchApi(`/api/it/content-filters/events/${id}/disposition`, {
        method: 'PUT',
        body: JSON.stringify({ disposition }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itFilterEvents.all })
    },
  })

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCopyWebhook = useCallback((provider: string) => {
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') ?? '{orgId}' : '{orgId}'
    const url = `${window.location.origin}/api/it/content-filters/webhook/${provider.toLowerCase()}?org=${orgId}`
    navigator.clipboard.writeText(url)
    setCopiedWebhook(provider)
    setTimeout(() => setCopiedWebhook(null), 2000)
  }, [])

  const handleStartConfigure = useCallback((provider: Platform, config?: FilterConfig) => {
    setConfiguringProvider(provider)
    setConfigForm({
      webhookSecret: config?.webhookSecret ?? '',
      isEnabled: config?.isEnabled ?? false,
    })
  }, [])

  const handleSaveConfig = useCallback(() => {
    if (!configuringProvider) return
    configMutation.mutate({
      provider: configuringProvider,
      body: configForm,
    })
  }, [configuringProvider, configForm, configMutation])

  const handleExportCSV = useCallback(() => {
    if (!events.length) return
    const headers = ['Date', 'Platform', 'Type', 'Student', 'URL', 'Disposition']
    const rows = events.map((e) => [
      new Date(e.createdAt).toLocaleDateString(),
      platformLabel(e.platform),
      eventTypeLabel(e.eventType),
      e.studentName ?? e.studentEmail ?? 'Unknown',
      e.url ?? '',
      e.disposition,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-filter-events-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [events])

  // ── Loading state ──────────────────────────────────────────────────
  if (configsQuery.isLoading && eventsQuery.isLoading) {
    return <ContentFiltersSkeleton />
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={staggerContainer()}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* ── Section 1: Platform Connection Cards ───────────────────── */}
      <motion.div variants={fadeInUp}>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Platform Connections
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLATFORMS.map((platform) => {
            const config = configs.find((c) => c.provider === platform.key)
            const isConnected = config?.isEnabled ?? false
            const isConfiguring = configuringProvider === platform.key

            return (
              <div key={platform.key} className="ui-glass p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Logo placeholder */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.label.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{platform.label}</p>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          isConnected
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isConnected ? 'bg-green-500' : 'bg-slate-400'
                          }`}
                        />
                        {isConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                  </div>
                  {canConfigure && !isConfiguring && (
                    <button
                      onClick={() => handleStartConfigure(platform.key, config)}
                      className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 inline mr-1" />
                      Configure
                    </button>
                  )}
                </div>

                {/* Last sync */}
                {config?.lastSyncAt && (
                  <p className="text-xs text-slate-500 mb-2">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Last sync: {new Date(config.lastSyncAt).toLocaleString()}
                  </p>
                )}

                {/* Webhook URL (read-only, copyable) */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-mono truncate">
                    /api/it/content-filters/webhook/{platform.key.toLowerCase()}?org=...
                  </div>
                  <button
                    onClick={() => handleCopyWebhook(platform.key)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                    title="Copy webhook URL"
                  >
                    {copiedWebhook === platform.key ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>

                {/* Inline config form */}
                {isConfiguring && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Webhook Secret
                      </label>
                      <input
                        type="text"
                        value={configForm.webhookSecret}
                        onChange={(e) => setConfigForm((s) => ({ ...s, webhookSecret: e.target.value }))}
                        placeholder="Enter webhook secret..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all duration-200"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configForm.isEnabled}
                        onChange={(e) => setConfigForm((s) => ({ ...s, isEnabled: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm text-slate-700">Enable integration</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveConfig}
                        disabled={configMutation.isPending}
                        className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-colors duration-200 cursor-pointer disabled:opacity-50"
                      >
                        {configMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setConfiguringProvider(null)}
                        className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    {configMutation.isError && (
                      <p className="text-xs text-red-600">
                        Failed to save configuration. Please try again.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ── Section 2: Compliance Stats ─────────────────────────────── */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="ui-glass p-4 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={stats.totalEvents} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Total Events</p>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-yellow-50 flex items-center justify-center mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={stats.pendingCount} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Pending Requests</p>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-red-50 flex items-center justify-center mb-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={stats.safetyAlertCount} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Safety Alerts</p>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-green-50 flex items-center justify-center mb-2">
            <Wifi className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            <AnimatedCounter value={stats.activePlatforms} />
          </div>
          <p className="text-xs text-slate-500 mt-1">Active Platforms</p>
        </div>
      </motion.div>

      {/* ── Section 3: Filter Events Table ──────────────────────────── */}
      <motion.div variants={fadeInUp} className="ui-glass p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Filter Events</h3>
          <div className="flex flex-wrap gap-2">
            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">All Platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">All Types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>

            {/* Disposition filter */}
            <select
              value={dispositionFilter}
              onChange={(e) => { setDispositionFilter(e.target.value); setPage(0) }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 cursor-pointer"
            >
              <option value="">All Dispositions</option>
              {DISPOSITIONS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Platform</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Disposition</th>
                {canManage && (
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canManage ? 7 : 6 }).map((__, j) => (
                      <td key={j} className="py-3 px-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="py-12 text-center text-sm text-slate-500">
                    <IllustrationSecurity className="w-32 h-24 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600 mb-1">No filter events found</p>
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={event.id}
                    className={`hover:bg-slate-50/50 transition-colors duration-150 ${
                      event.eventType === 'SAFETY_ALERT' ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: platformColor(event.platform) }}
                        />
                        <span className="text-slate-700">{platformLabel(event.platform)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {event.eventType === 'SAFETY_ALERT' && (
                        <AlertTriangle className="w-3.5 h-3.5 inline mr-1 text-red-500" />
                      )}
                      {eventTypeLabel(event.eventType)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {event.studentName ?? event.studentEmail ?? 'Unknown'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                      {event.url ? truncateUrl(event.url) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${dispositionBadge(event.disposition)}`}
                      >
                        {event.disposition}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-2.5 px-3 text-right">
                        {event.disposition === 'PENDING' && (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => dispositionMutation.mutate({ id: event.id, disposition: 'APPROVED' })}
                              disabled={dispositionMutation.isPending}
                              className="p-1 rounded-md hover:bg-green-50 text-green-600 transition-colors duration-200 cursor-pointer"
                              title="Approve"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => dispositionMutation.mutate({ id: event.id, disposition: 'DENIED' })}
                              disabled={dispositionMutation.isPending}
                              className="p-1 rounded-md hover:bg-red-50 text-red-600 transition-colors duration-200 cursor-pointer"
                              title="Deny"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalEvents)} of {totalEvents}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Section 4: CIPA Evidence ────────────────────────────────── */}
      <motion.div variants={fadeInUp} className="ui-glass p-6">
        <button
          onClick={() => setShowCIPAEvidence((v) => !v)}
          className="flex items-center gap-2 w-full text-left cursor-pointer"
        >
          {showCIPAEvidence ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <FileText className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-900">CIPA Compliance Evidence</span>
        </button>

        {showCIPAEvidence && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-medium text-slate-900">{totalEvents.toLocaleString()}</span>{' '}
              total filter events logged for CIPA compliance. Export this data as evidence for E-Rate applications or audit reviews.
            </p>
            <button
              onClick={handleExportCSV}
              disabled={events.length === 0}
              className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 inline mr-1.5" />
              Export CSV
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
