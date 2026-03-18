'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Wrench,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Package,
  MapPin,
  Tag,
  Edit2,
  QrCode,
  ChevronRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import AssetRepairGauge from './AssetRepairGauge'
import QRCodeThumbnail from './QRCodeThumbnail'
import AssetCreateDrawer from './AssetCreateDrawer'
import type { MaintenanceAsset } from './AssetRegisterTable'

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'SCHEDULED'
  | 'QA'
  | 'DONE'
  | 'CANCELLED'

interface TicketHistoryItem {
  id: string
  ticketNumber: string
  title: string
  status: TicketStatus
  createdAt: string
  updatedAt: string
}

interface PmScheduleItem {
  id: string
  name: string
  recurrenceType: string
  nextDueDate: string | null
  isActive: boolean
  defaultTechnician: { id: string; firstName: string; lastName: string } | null
}

interface AssetDetail extends MaintenanceAsset {
  ticketHistory: TicketHistoryItem[]
  pmSchedules: PmScheduleItem[]
  cumulativeRepairCost: number
  building: { id: string; name: string } | null
  area: { id: string; name: string } | null
  room: { id: string; roomNumber: string; displayName: string | null } | null
  school: { id: string; name: string } | null
  aiRecommendation?: {
    recommendation: string
    decision: 'REPLACE' | 'REPAIR' | 'UNKNOWN'
    urgency: 'LOW' | 'MEDIUM' | 'HIGH'
  } | null
  aiRecommendationAt?: string | null
  repeatAlertSentAt?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  if (token) return { Authorization: `Bearer ${token}` }
  return {}
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(dateStr)
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / AV',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Every 6 months',
  ANNUAL: 'Annually',
  CUSTOM_INTERVAL: 'Custom interval',
}

function getStatusConfig(status: TicketStatus) {
  switch (status) {
    case 'BACKLOG':
      return { label: 'Backlog', color: 'bg-slate-100 text-slate-600' }
    case 'TODO':
      return { label: 'To Do', color: 'bg-blue-100 text-blue-700' }
    case 'IN_PROGRESS':
      return { label: 'In Progress', color: 'bg-amber-100 text-amber-700' }
    case 'ON_HOLD':
      return { label: 'On Hold', color: 'bg-orange-100 text-orange-700' }
    case 'SCHEDULED':
      return { label: 'Scheduled', color: 'bg-purple-100 text-purple-700' }
    case 'QA':
      return { label: 'QA Review', color: 'bg-indigo-100 text-indigo-700' }
    case 'DONE':
      return { label: 'Done', color: 'bg-primary-100 text-primary-700' }
    case 'CANCELLED':
      return { label: 'Cancelled', color: 'bg-red-100 text-red-700' }
    default:
      return { label: status, color: 'bg-slate-100 text-slate-600' }
  }
}

function getWarrantyBadge(warrantyExpiry: string | null | undefined) {
  if (!warrantyExpiry) return { label: 'N/A', color: 'bg-slate-100 text-slate-500' }
  const expiry = new Date(warrantyExpiry)
  const now = new Date()
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) return { label: 'Expired', color: 'bg-red-100 text-red-700' }
  if (daysLeft < 90) return { label: `Expires ${formatDate(warrantyExpiry)}`, color: 'bg-amber-100 text-amber-700' }
  return { label: `Active until ${formatDate(warrantyExpiry)}`, color: 'bg-primary-100 text-primary-700' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AssetDetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 rounded-xl w-48" />
      <div className="ui-glass p-6">
        <div className="flex gap-6">
          <div className="w-20 h-20 bg-slate-100 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-slate-100 rounded-lg w-64" />
            <div className="h-4 bg-slate-100 rounded-lg w-32" />
            <div className="h-4 bg-slate-100 rounded-lg w-48" />
          </div>
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="ui-glass p-6">
          <div className="h-4 bg-slate-100 rounded-lg w-32 mb-4" />
          <div className="h-20 bg-slate-100 rounded-xl" />
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AssetDetailPageProps {
  assetId: string
}

export default function AssetDetailPage({ assetId }: AssetDetailPageProps) {
  const router = useRouter()
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)

  const {
    data: asset,
    isLoading,
    error,
    refetch,
  } = useQuery<AssetDetail>({
    queryKey: ['maintenance-asset', assetId],
    queryFn: async () => {
      const res = await fetch(`/api/maintenance/assets/${assetId}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load asset')
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message || 'Failed to load asset')
      return json.data
    },
    staleTime: 30_000,
  })

  if (isLoading) return <AssetDetailSkeleton />

  if (error || !asset) {
    return (
      <div className="ui-glass p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-slate-600">Failed to load asset details</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 text-sm text-primary-600 hover:text-primary-700 cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  const warrantyBadge = getWarrantyBadge(asset.warrantyExpiry as string | null | undefined)

  // ── Repeat repair intelligence badge computation ──────────────────────────
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const repairsInYear = asset.ticketHistory.filter(
    (t) => t.status === 'DONE' && new Date(t.updatedAt) >= twelveMonthsAgo
  )
  const isRepeatRepair = repairsInYear.length >= 3

  const isCostThresholdExceeded =
    asset.replacementCost != null &&
    asset.cumulativeRepairCost >= asset.repairThresholdPct * asset.replacementCost

  const assetAgeYears = asset.purchaseDate
    ? (Date.now() - new Date(asset.purchaseDate as string).getTime()) / (365.25 * 24 * 3600 * 1000)
    : null
  const isEndOfLife =
    asset.expectedLifespanYears != null &&
    assetAgeYears != null &&
    assetAgeYears >= asset.expectedLifespanYears

  // Location hierarchy
  const locationParts: string[] = []
  if (asset.building) locationParts.push(asset.building.name)
  if (asset.area) locationParts.push(asset.area.name)
  if (asset.room) locationParts.push(asset.room.displayName || asset.room.roomNumber)

  // Report Issue URL with pre-filled params
  const reportIssueParams = new URLSearchParams()
  reportIssueParams.set('assetId', assetId)
  if (asset.buildingId) reportIssueParams.set('buildingId', asset.buildingId)
  if (asset.areaId) reportIssueParams.set('areaId', asset.areaId)
  if (asset.roomId) reportIssueParams.set('roomId', asset.roomId)

  return (
    <>
      <motion.div
        className="space-y-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.06, 0.05)}
      >
        {/* Back navigation */}
        <motion.div variants={fadeInUp}>
          <button
            type="button"
            onClick={() => router.push('/maintenance/assets')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Asset Register
          </button>
        </motion.div>

        {/* Identity section */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* QR code thumbnail */}
            <div className="flex-shrink-0">
              <QRCodeThumbnail
                assetId={assetId}
                assetNumber={asset.assetNumber}
                assetName={asset.name}
              />
            </div>

            {/* Identity info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{asset.name}</h1>
                  <p className="text-sm font-mono text-primary-700 font-semibold mt-0.5">{asset.assetNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 mb-2">
                {asset.category && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
                    <Tag className="w-3 h-3" />
                    {CATEGORY_LABELS[asset.category] || asset.category}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${warrantyBadge.color}`}>
                  {warrantyBadge.label === 'N/A' ? (
                    <span>No warranty</span>
                  ) : (
                    <>
                      {warrantyBadge.label.startsWith('Expired') ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {warrantyBadge.label}
                    </>
                  )}
                </span>
              </div>

              {/* Alert badges row — visible when intelligence conditions are met */}
              {(isRepeatRepair || isCostThresholdExceeded || isEndOfLife) && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {isRepeatRepair && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                      <AlertTriangle className="w-3 h-3" />
                      Repeat Repair
                    </span>
                  )}
                  {isCostThresholdExceeded && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                      <TrendingUp className="w-3 h-3" />
                      Cost Threshold Exceeded
                    </span>
                  )}
                  {isEndOfLife && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      <Clock className="w-3 h-3" />
                      End of Life
                    </span>
                  )}
                </div>
              )}

              {/* Make / Model / Serial */}
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm mb-3">
                {asset.make && (
                  <>
                    <dt className="text-slate-400">Make</dt>
                    <dd className="text-slate-700 sm:col-span-2">{asset.make}</dd>
                  </>
                )}
                {asset.model && (
                  <>
                    <dt className="text-slate-400">Model</dt>
                    <dd className="text-slate-700 sm:col-span-2">{asset.model}</dd>
                  </>
                )}
                {asset.serialNumber && (
                  <>
                    <dt className="text-slate-400">Serial</dt>
                    <dd className="text-slate-700 font-mono text-xs sm:col-span-2">{asset.serialNumber}</dd>
                  </>
                )}
              </dl>

              {/* Location */}
              {locationParts.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{locationParts.join(' › ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
            <a
              href={`/maintenance?openWizard=true&${reportIssueParams.toString()}`}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              Report Issue
            </a>
          </div>
        </motion.div>

        {/* Cost & Health section */}
        {(asset.replacementCost !== null && asset.replacementCost !== undefined) && (
          <motion.div variants={fadeInUp} className="ui-glass p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary-500" />
              Cost Health
            </h2>
            <AssetRepairGauge
              cumulativeRepairCost={asset.cumulativeRepairCost}
              replacementCost={asset.replacementCost as number}
              thresholdPct={asset.repairThresholdPct}
            />

            {/* AI Replace vs. Repair Recommendation panel */}
            {isCostThresholdExceeded && asset.aiRecommendation && (
              <div className="ui-glass p-4 border-l-4 border-amber-400 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-900">AI Replace vs. Repair Recommendation</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      asset.aiRecommendation.decision === 'REPLACE'
                        ? 'bg-red-100 text-red-700'
                        : asset.aiRecommendation.decision === 'REPAIR'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {asset.aiRecommendation.decision}
                  </span>
                  {asset.aiRecommendation.urgency && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        asset.aiRecommendation.urgency === 'HIGH'
                          ? 'bg-red-50 text-red-600'
                          : asset.aiRecommendation.urgency === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      {asset.aiRecommendation.urgency} urgency
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{asset.aiRecommendation.recommendation}</p>
                <p className="text-xs text-slate-400 mt-2">
                  AI Suggestion — always verify with professional judgment.
                  {asset.aiRecommendationAt && ` Generated ${formatDate(asset.aiRecommendationAt)}.`}
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Ticket history section */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-500" />
            Ticket History
            {asset.ticketHistory.length > 0 && (
              <span className="ml-auto text-xs font-normal text-slate-400">
                {asset.ticketHistory.length} ticket{asset.ticketHistory.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>

          {asset.ticketHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-2">
                <Wrench className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No tickets linked to this asset yet</p>
            </div>
          ) : (
            <div className="ui-glass-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ticket</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {asset.ticketHistory.map((ticket) => {
                    const statusConfig = getStatusConfig(ticket.status)
                    return (
                      <tr
                        key={ticket.id}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                        onClick={() => router.push(`/maintenance/tickets/${ticket.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary-700">
                          {ticket.ticketNumber}
                        </td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                          {ticket.title}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">
                          {formatDate(ticket.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* PM Schedules section */}
        <motion.div variants={fadeInUp} className="ui-glass p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-500" />
            Preventive Maintenance
            {asset.pmSchedules.length > 0 && (
              <span className="ml-auto text-xs font-normal text-slate-400">
                {asset.pmSchedules.length} schedule{asset.pmSchedules.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>

          {asset.pmSchedules.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">No PM schedules for this asset</p>
              <p className="text-xs text-slate-400 mt-1">PM schedules will be created in Phase 4 Plan 03</p>
            </div>
          ) : (
            <div className="space-y-2">
              {asset.pmSchedules.map((pm) => (
                <div
                  key={pm.id}
                  className="ui-glass-hover p-3 rounded-xl flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{pm.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {RECURRENCE_LABELS[pm.recurrenceType] || pm.recurrenceType}
                      </span>
                      {pm.nextDueDate && (
                        <span className="text-xs text-slate-400">
                          Due {formatDate(pm.nextDueDate)}
                        </span>
                      )}
                      {pm.defaultTechnician && (
                        <span className="text-xs text-slate-400">
                          {pm.defaultTechnician.firstName} {pm.defaultTechnician.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Edit drawer */}
      <AssetCreateDrawer
        isOpen={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        onCreated={() => {
          setEditDrawerOpen(false)
          refetch()
        }}
        editAsset={asset as MaintenanceAsset & { assetNumber: string }}
      />
    </>
  )
}
