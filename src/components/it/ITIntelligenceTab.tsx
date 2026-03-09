'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { useToast } from '@/components/Toast'
import { DeviceStatusBadge, DeviceTypeBadge } from './ITDeviceStatusBadge'
import {
  Brain,
  AlertTriangle,
  Wrench,
  Replace,
  Settings,
  Loader2,
  BarChart3,
  TrendingUp,
} from 'lucide-react'
import { IllustrationSecurity } from '@/components/illustrations'

// ─── Types ─────────────────────────────────────────────────────────────

interface LemonDevice {
  id: string
  assetTag: string
  deviceType: string
  make: string | null
  model: string | null
  status: string
  isLemon: boolean
  lemonFlaggedAt: string | null
  aiRecommendation: {
    action: 'repair' | 'replace'
    reasoning: string
    confidence: number
  } | null
  repairs: Array<{
    id: string
    repairDate: string
    repairCost: number
    description: string
  }>
  _repairCount: number
  _totalRepairCost: number
}

interface ITDeviceConfig {
  lemonRepairCount: number
  lemonPeriodMonths: number
  replaceThresholdPct: number
  defaultLoanDays: number
  overdueGraceDays: number
}

interface ITIntelligenceTabProps {
  canManage: boolean
  canConfigure: boolean
  onViewDevice?: (deviceId: string) => void
}

// ─── Helpers ───────────────────────────────────────────────────────────

function RecommendationBadge({ rec }: { rec: LemonDevice['aiRecommendation'] }) {
  if (!rec) {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
        Not analyzed
      </span>
    )
  }
  if (rec.action === 'replace') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
        <Replace className="w-3 h-3" />
        Replace
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
      <Wrench className="w-3 h-3" />
      Repair
    </span>
  )
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  )
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Component ─────────────────────────────────────────────────────────

export default function ITIntelligenceTab({
  canManage,
  canConfigure,
  onViewDevice,
}: ITIntelligenceTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ── Data Queries ──────────────────────────────────────────────────

  const {
    data: lemons = [],
    isLoading: lemonsLoading,
  } = useQuery({
    ...queryOptions.itLemons(),
    select: (data: unknown) => {
      if (Array.isArray(data)) return data as LemonDevice[]
      if (data && typeof data === 'object' && 'data' in data) {
        const inner = (data as { data: unknown }).data
        return Array.isArray(inner) ? (inner as LemonDevice[]) : []
      }
      return []
    },
  })

  const {
    data: config,
    isLoading: configLoading,
  } = useQuery({
    ...queryOptions.itConfig(),
    select: (data: unknown) => {
      if (data && typeof data === 'object' && 'data' in data) {
        return (data as { data: ITDeviceConfig }).data as ITDeviceConfig
      }
      return data as ITDeviceConfig | null
    },
    enabled: canConfigure,
  })

  // ── Config form state ─────────────────────────────────────────────

  const [configForm, setConfigForm] = useState<ITDeviceConfig | null>(null)
  const activeConfig = configForm ?? config ?? null

  // Sync from query when first loaded
  if (config && !configForm) {
    // We'll use a lazy init instead of useEffect to avoid extra render
  }

  function handleConfigChange(key: keyof ITDeviceConfig, value: number) {
    setConfigForm((prev) => ({
      lemonRepairCount: prev?.lemonRepairCount ?? config?.lemonRepairCount ?? 3,
      lemonPeriodMonths: prev?.lemonPeriodMonths ?? config?.lemonPeriodMonths ?? 6,
      replaceThresholdPct: prev?.replaceThresholdPct ?? config?.replaceThresholdPct ?? 0.6,
      defaultLoanDays: prev?.defaultLoanDays ?? config?.defaultLoanDays ?? 5,
      overdueGraceDays: prev?.overdueGraceDays ?? config?.overdueGraceDays ?? 1,
      [key]: value,
    }))
  }

  // ── Mutations ─────────────────────────────────────────────────────

  const analyzeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch(`/api/it/intelligence/analyze/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Analysis failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itLemons.all })
      toast('AI analysis complete', 'success')
    },
    onError: () => {
      toast('Failed to analyze device', 'error')
    },
  })

  const detectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/it/intelligence/detect', {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Detection failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itLemons.all })
      toast('Lemon detection complete', 'success')
    },
    onError: () => {
      toast('Failed to run lemon detection', 'error')
    },
  })

  const saveConfigMutation = useMutation({
    mutationFn: async (values: ITDeviceConfig) => {
      const res = await fetch('/api/it/config', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Save failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.itConfig.all })
      setConfigForm(null)
      toast('Configuration saved', 'success')
    },
    onError: () => {
      toast('Failed to save configuration', 'error')
    },
  })

  // ── Summary Stats ────────────────────────────────────────────────

  const summary = useMemo(() => {
    const repairCount = lemons.filter(
      (d) => d.aiRecommendation?.action === 'repair'
    ).length
    const replaceCount = lemons.filter(
      (d) => d.aiRecommendation?.action === 'replace'
    ).length
    const analyzed = lemons.filter((d) => d.aiRecommendation != null)
    const avgConfidence =
      analyzed.length > 0
        ? analyzed.reduce((s, d) => s + (d.aiRecommendation?.confidence ?? 0), 0) /
          analyzed.length
        : 0
    const totalRepairCost = lemons.reduce((s, d) => s + d._totalRepairCost, 0)

    return { repairCount, replaceCount, avgConfidence, totalRepairCost, total: lemons.length }
  }, [lemons])

  // ── Render ────────────────────────────────────────────────────────

  if (lemonsLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="ui-glass p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── AI Recommendations Summary ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="ui-glass p-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-xs text-gray-500 mt-0.5">Flagged Devices</div>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-2">
            <Wrench className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.repairCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Recommended Repair</div>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-2">
            <Replace className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{summary.replaceCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Recommended Replace</div>
        </div>

        <div className="ui-glass p-4 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(summary.avgConfidence * 100)}%
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Avg. Confidence</div>
        </div>
      </div>

      {/* Total repair cost banner */}
      {summary.totalRepairCost > 0 && (
        <div className="bg-gradient-to-br from-primary-50/80 to-primary-100/80 backdrop-blur-sm border border-primary-200/30 rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary-600 shrink-0" />
          <div>
            <span className="text-sm font-medium text-primary-900">
              Total repair spend on flagged devices:{' '}
            </span>
            <span className="text-sm font-bold text-primary-700">
              {formatCurrency(summary.totalRepairCost)}
            </span>
          </div>
        </div>
      )}

      {/* ── Lemon Devices Table ─────────────────────────────────────── */}
      <div className="ui-glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-gray-700" />
            <h3 className="text-base font-semibold text-gray-900">
              Lemon Devices
            </h3>
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
              {lemons.length}
            </span>
          </div>
          {canManage && (
            <button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {detectMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Detecting...
                </span>
              ) : (
                'Run Lemon Detection'
              )}
            </button>
          )}
        </div>

        {lemons.length === 0 ? (
          <div className="text-center py-12">
            <IllustrationSecurity className="w-40 h-32 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">No lemon devices</p>
            <p className="text-xs text-gray-500 mt-1">
              All devices are within normal repair thresholds.
            </p>
          </div>
        ) : (
          <div className="ui-glass-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Asset Tag
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Make / Model
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Repairs
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Repair Cost
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Flagged
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    AI Recommendation
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                    Confidence
                  </th>
                  {canManage && (
                    <th className="text-right py-3 px-4 font-medium text-gray-500 text-xs uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lemons.map((device) => (
                  <tr
                    key={device.id}
                    onClick={() => onViewDevice?.(device.id)}
                    className="hover:bg-gray-50/50 transition-colors duration-200 cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {device.assetTag}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <DeviceTypeBadge type={device.deviceType} />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {[device.make, device.model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                        {device._repairCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(device._totalRepairCost)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {formatDate(device.lemonFlaggedAt)}
                    </td>
                    <td className="py-3 px-4">
                      <RecommendationBadge rec={device.aiRecommendation} />
                      {device.aiRecommendation?.reasoning && (
                        <p className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={device.aiRecommendation.reasoning}>
                          {device.aiRecommendation.reasoning}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {device.aiRecommendation ? (
                        <ConfidenceBar confidence={device.aiRecommendation.confidence} />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            analyzeMutation.mutate(device.id)
                          }}
                          disabled={analyzeMutation.isPending && analyzeMutation.variables === device.id}
                          className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {analyzeMutation.isPending && analyzeMutation.variables === device.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span className="flex items-center gap-1">
                              <Brain className="w-3.5 h-3.5" />
                              Analyze
                            </span>
                          )}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Configuration Section ──────────────────────────────────── */}
      {canConfigure && (
        <div className="ui-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-700" />
            <h3 className="text-base font-semibold text-gray-900">
              Intelligence Configuration
            </h3>
          </div>

          {configLoading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              {/* Lemon Repair Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repairs to flag as lemon
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={activeConfig?.lemonRepairCount ?? 3}
                  onChange={(e) =>
                    handleConfigChange('lemonRepairCount', parseInt(e.target.value) || 3)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Number of repairs before a device is flagged as a lemon.
                </p>
              </div>

              {/* Lemon Period Months */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lemon period (months)
                </label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={activeConfig?.lemonPeriodMonths ?? 6}
                  onChange={(e) =>
                    handleConfigChange('lemonPeriodMonths', parseInt(e.target.value) || 6)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Time window to count repairs within.
                </p>
              </div>

              {/* Replace Threshold */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Replace threshold (% of purchase price)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={activeConfig?.replaceThresholdPct ?? 0.6}
                    onChange={(e) =>
                      handleConfigChange(
                        'replaceThresholdPct',
                        parseFloat(e.target.value) || 0.6
                      )
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors duration-200"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Recommend replacement when total repair cost exceeds this percentage (e.g. 0.60 = 60%).
                </p>
              </div>

              {/* Default Loan Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default loaner checkout (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={activeConfig?.defaultLoanDays ?? 5}
                  onChange={(e) =>
                    handleConfigChange('defaultLoanDays', parseInt(e.target.value) || 5)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How many days a loaner is checked out by default.
                </p>
              </div>

              {/* Overdue Grace Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overdue grace period (days)
                </label>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={activeConfig?.overdueGraceDays ?? 1}
                  onChange={(e) =>
                    handleConfigChange('overdueGraceDays', parseInt(e.target.value) || 1)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 transition-colors duration-200"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Grace days before sending overdue notifications.
                </p>
              </div>
            </div>
          )}

          {/* Save button */}
          {!configLoading && (
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200/50">
              <button
                onClick={() => {
                  if (activeConfig) saveConfigMutation.mutate(activeConfig)
                }}
                disabled={saveConfigMutation.isPending || !configForm}
                className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveConfigMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Configuration'
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
