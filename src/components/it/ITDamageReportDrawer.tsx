'use client'

import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import { Download, AlertTriangle, ShieldCheck, ThumbsUp, Minus, ThumbsDown, Ban } from 'lucide-react'
import { useToast } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  batchId: string | null
  isOpen: boolean
  onClose: () => void
}

interface DamageSummary {
  batchName: string
  totalDevices: number
  totalFeeCents: number
  byCondition: Record<string, number>
  items: DamageItem[]
}

interface DamageItem {
  id: string
  assetTag: string
  deviceType?: string | null
  studentName?: string | null
  condition: string
  damageFeeCents: number
  damageNotes?: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONDITION_STYLES: Record<string, { bg: string; text: string; icon: typeof ShieldCheck }> = {
  EXCELLENT: { bg: 'bg-green-100', text: 'text-green-700', icon: ShieldCheck },
  GOOD:      { bg: 'bg-blue-100', text: 'text-blue-700', icon: ThumbsUp },
  FAIR:      { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Minus },
  POOR:      { bg: 'bg-orange-100', text: 'text-orange-700', icon: ThumbsDown },
  BROKEN:    { bg: 'bg-red-100', text: 'text-red-700', icon: Ban },
}

const CONDITION_CARD_STYLES: Record<string, string> = {
  EXCELLENT: 'bg-green-50 border-green-200/50',
  GOOD:      'bg-blue-50 border-blue-200/50',
  FAIR:      'bg-yellow-50 border-yellow-200/50',
  POOR:      'bg-orange-50 border-orange-200/50',
  BROKEN:    'bg-red-50 border-red-200/50',
}

function ConditionBadge({ condition }: { condition: string }) {
  const style = CONDITION_STYLES[condition]
  if (!style) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
        {condition}
      </span>
    )
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.text}`}>
      {condition}
    </span>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function DamageReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-3 rounded-xl border border-gray-100">
            <div className="h-3 w-16 bg-gray-100 rounded mb-2" />
            <div className="h-6 w-10 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-4 flex-1 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
            <div className="h-4 w-14 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ITDamageReportDrawer({ batchId, isOpen, onClose }: Props) {
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    ...queryOptions.itDamageSummary(batchId ?? ''),
    enabled: !!batchId && isOpen,
  })

  const summary = data as DamageSummary | undefined

  const handleExportCSV = async () => {
    if (!batchId) return
    try {
      const res = await fetch(`/api/it/damage/export/${batchId}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        toast('Failed to export CSV', 'error')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `damage-report-${batchId}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast('CSV downloaded', 'success')
    } catch {
      toast('Failed to export CSV', 'error')
    }
  }

  const conditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'BROKEN']

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title="Damage Report" width="lg">
      {isLoading || !summary ? (
        <DamageReportSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{summary.batchName}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.totalDevices} device{summary.totalDevices !== 1 ? 's' : ''} assessed
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Total devices */}
            <div className="p-3 rounded-xl border border-gray-200/50 bg-gray-50/50">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{summary.totalDevices}</p>
            </div>

            {/* By condition */}
            {conditions.map((cond) => {
              const count = summary.byCondition[cond] ?? 0
              const cardStyle = CONDITION_CARD_STYLES[cond] || 'bg-gray-50 border-gray-200/50'
              const condStyle = CONDITION_STYLES[cond]
              const Icon = condStyle?.icon || AlertTriangle
              return (
                <div key={cond} className={`p-3 rounded-xl border ${cardStyle}`}>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3 h-3 ${condStyle?.text || 'text-gray-500'}`} />
                    <p className={`text-[10px] font-medium uppercase tracking-wide ${condStyle?.text || 'text-gray-400'}`}>
                      {cond}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
                </div>
              )
            })}

            {/* Total fees */}
            <div className="p-3 rounded-xl border border-gray-200/50 bg-gradient-to-br from-primary-50/80 to-primary-100/80">
              <p className="text-[10px] font-medium text-primary-600 uppercase tracking-wide">Total Fees</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                ${(summary.totalFeeCents / 100).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Items table */}
          {summary.items.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No damage assessments recorded</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200/50">
                      <th className="pb-2 font-medium">Device</th>
                      <th className="pb-2 font-medium">Student</th>
                      <th className="pb-2 font-medium">Condition</th>
                      <th className="pb-2 font-medium text-right">Fee</th>
                      <th className="pb-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100/50 hover:bg-gray-50/30 transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs text-gray-700">{item.assetTag}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-gray-600">
                          {item.studentName || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-2.5 pr-3">
                          <ConditionBadge condition={item.condition} />
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-gray-700 text-right">
                          {item.damageFeeCents > 0
                            ? `$${(item.damageFeeCents / 100).toFixed(2)}`
                            : <span className="text-gray-400">$0.00</span>}
                        </td>
                        <td className="py-2.5 text-xs text-gray-500 max-w-[180px] truncate">
                          {item.damageNotes || <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {summary.items.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl bg-gray-50/50 border border-gray-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-700">{item.assetTag}</span>
                      <ConditionBadge condition={item.condition} />
                    </div>
                    {item.studentName && (
                      <p className="text-xs text-gray-600">{item.studentName}</p>
                    )}
                    <div className="flex items-center justify-between">
                      {item.damageFeeCents > 0 ? (
                        <span className="text-xs font-medium text-gray-700">
                          ${(item.damageFeeCents / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No fee</span>
                      )}
                    </div>
                    {item.damageNotes && (
                      <p className="text-[11px] text-gray-500">{item.damageNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}
