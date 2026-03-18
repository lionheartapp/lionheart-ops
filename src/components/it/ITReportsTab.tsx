'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeInUp, staggerContainer, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import {
  BarChart3,
  TrendingUp,
  ArrowLeftRight,
  DollarSign,
  Download,
  Sparkles,
  Loader2,
  X,
  Calendar,
  Building2,
  PieChart,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────

interface School {
  id: string
  name: string
}

interface AnnualReportData {
  totalDevices: number
  totalStudents: number
  costPerStudent: number
  repairRate: number
  avgFleetAge: number
  totalRepairCost: number
  devicesByType: Record<string, number>
  devicesByStatus: Record<string, number>
}

interface RefreshForecastData {
  devicesOverThreshold: number
  projectedReplacementCost: number
  staggeredYearOne: number
  staggeredYearTwo: number
  staggeredYearThree: number
  staggeredYearFour: number
  devicesByAge: Array<{ year: number; count: number }>
}

interface RepairReplaceData {
  lemons: Array<{
    id: string
    assetTag: string
    model: string | null
    repairCount: number
    totalRepairCost: number
    recommendation: string
  }>
  totalLemonCount: number
  avgRepairCost: number
  replaceRecommendedCount: number
  repairRecommendedCount: number
}

interface DamageFeesData {
  totalAssessed: number
  totalCollected: number
  totalOutstanding: number
  collectionRate: number
  fees: Array<{
    id: string
    studentName: string
    assetTag: string
    amount: number
    status: string
    assessedAt: string
  }>
}

type ReportType = 'annual' | 'refresh-forecast' | 'repair-replace' | 'damage-fees' | 'ticket-roi'

interface ReportCard {
  type: ReportType
  icon: typeof BarChart3
  title: string
  description: string
}

interface ITReportsTabProps {}

// ─── Report Card Definitions ────────────────────────────────────────────

const REPORT_CARDS: ReportCard[] = [
  {
    type: 'annual',
    icon: BarChart3,
    title: 'Annual Technology Report',
    description: 'Total devices, cost per student, repair rate, fleet age',
  },
  {
    type: 'refresh-forecast',
    icon: TrendingUp,
    title: 'Device Refresh Forecast',
    description: '4-year threshold, projected costs, staggered budget',
  },
  {
    type: 'repair-replace',
    icon: ArrowLeftRight,
    title: 'Repair vs Replace',
    description: 'Lemon devices, cost analysis, recommendations',
  },
  {
    type: 'damage-fees',
    icon: DollarSign,
    title: 'Damage Fee Collection',
    description: 'Assessed fees, payment status, aging',
  },
  {
    type: 'ticket-roi',
    icon: PieChart,
    title: 'IT Ticket ROI',
    description: 'Resolution metrics, cost savings, AI narrative',
  },
]

// ─── Skeleton ───────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="ui-glass p-4 animate-pulse">
            <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-7 w-20 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      <div className="ui-glass animate-pulse">
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────

function StatCard({ label, value, prefix, suffix }: {
  label: string
  value: number
  prefix?: string
  suffix?: string
}) {
  return (
    <motion.div variants={cardEntrance} className="ui-glass p-4 text-center">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">
        {prefix}<AnimatedCounter value={value} />{suffix}
      </p>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function ITReportsTab({}: ITReportsTabProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [exporting, setExporting] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Date range defaults to current school year
  const currentYear = new Date().getFullYear()
  const defaultFrom = `${currentYear - 1}-08-01`
  const defaultTo = `${currentYear}-06-30`
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [schoolId, setSchoolId] = useState<string>('')

  // Fetch campuses for school filter
  const { data: campuses } = useQuery({
    ...queryOptions.campuses(),
  })
  const schools = (campuses ?? []) as School[]

  // ─── Report Queries ─────────────────────────────────────────────────

  const annualQuery = useQuery({
    ...queryOptions.itReportAnnual(dateFrom, dateTo, schoolId || undefined),
    enabled: selectedReport === 'annual',
  })

  const refreshQuery = useQuery({
    ...queryOptions.itReportRefreshForecast(4),
    enabled: selectedReport === 'refresh-forecast',
  })

  const repairQuery = useQuery({
    ...queryOptions.itReportRepairReplace(),
    enabled: selectedReport === 'repair-replace',
  })

  const damageQuery = useQuery({
    ...queryOptions.itReportDamageFees(schoolId || undefined),
    enabled: selectedReport === 'damage-fees',
  })

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleExportPDF = async (reportType: string) => {
    setExporting(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/it/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportType, from: dateFrom, to: dateTo, schoolId: schoolId || undefined }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        window.open(url)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleGenerateAISummary = async () => {
    if (!selectedReport) return
    setAiLoading(true)
    setAiSummary(null)
    try {
      const res = await fetch('/api/it/reports/ai-summary', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reportType: selectedReport, from: dateFrom, to: dateTo, schoolId: schoolId || undefined }),
      })
      if (res.ok) {
        const json = await res.json()
        setAiSummary(json.data?.summary ?? json.summary ?? 'No summary available.')
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleSelectReport = (type: ReportType) => {
    if (selectedReport === type) {
      setSelectedReport(null)
    } else {
      setSelectedReport(type)
      setAiSummary(null)
    }
  }

  // ─── Determine if filters should show ──────────────────────────────

  const showDateRange = selectedReport === 'annual' || selectedReport === 'damage-fees'
  const showSchoolFilter = schools.length > 1

  // ─── Get active query ──────────────────────────────────────────────

  const activeQuery = useMemo(() => {
    switch (selectedReport) {
      case 'annual': return annualQuery
      case 'refresh-forecast': return refreshQuery
      case 'repair-replace': return repairQuery
      case 'damage-fees': return damageQuery
      default: return null
    }
  }, [selectedReport, annualQuery, refreshQuery, repairQuery, damageQuery])

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Report Card Grid */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon
          const isSelected = selectedReport === card.type
          return (
            <motion.button
              key={card.type}
              variants={cardEntrance}
              onClick={() => handleSelectReport(card.type)}
              className={`ui-glass-hover p-6 cursor-pointer transition-all duration-200 text-left ${
                isSelected ? 'ring-2 ring-blue-400/40' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  isSelected
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{card.description}</p>
                </div>
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      {/* Report Detail View */}
      <AnimatePresence mode="wait">
        {selectedReport && (
          <motion.div
            key={selectedReport}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-4"
          >
            {/* Filters Bar */}
            {(showDateRange || showSchoolFilter) && (
              <div className="ui-glass p-4 flex flex-wrap items-center gap-4">
                {showDateRange && (
                  <>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <label className="text-xs text-slate-500 font-medium">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 font-medium">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                  </>
                )}
                {showSchoolFilter && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <select
                      value={schoolId}
                      onChange={(e) => setSchoolId(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">All Schools</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Report Content */}
            {activeQuery?.isLoading ? (
              <ReportSkeleton />
            ) : activeQuery?.isError ? (
              <div className="ui-glass p-8 text-center">
                <p className="text-sm text-red-600">Failed to load report data. Please try again.</p>
              </div>
            ) : (
              <>
                {/* Annual Report */}
                {selectedReport === 'annual' && annualQuery.data && (
                  <AnnualReportDetail data={annualQuery.data as AnnualReportData} />
                )}

                {/* Refresh Forecast */}
                {selectedReport === 'refresh-forecast' && refreshQuery.data && (
                  <RefreshForecastDetail data={refreshQuery.data as RefreshForecastData} />
                )}

                {/* Repair vs Replace */}
                {selectedReport === 'repair-replace' && repairQuery.data && (
                  <RepairReplaceDetail data={repairQuery.data as RepairReplaceData} />
                )}

                {/* Damage Fees */}
                {selectedReport === 'damage-fees' && damageQuery.data && (
                  <DamageFeesDetail data={damageQuery.data as DamageFeesData} />
                )}
              </>
            )}

            {/* AI Summary */}
            {aiSummary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="ui-glass p-5 border-l-4 border-indigo-400"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-900">AI Summary</h4>
                  <button onClick={() => setAiSummary(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExportPDF(selectedReport)}
                disabled={exporting || activeQuery?.isLoading}
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors duration-200"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? 'Exporting...' : 'Download PDF'}
              </button>
              <button
                onClick={handleGenerateAISummary}
                disabled={aiLoading || activeQuery?.isLoading}
                className="px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors duration-200"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? 'Generating...' : 'Generate AI Summary'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Annual Report Detail ───────────────────────────────────────────────

function AnnualReportDetail({ data }: { data: AnnualReportData }) {
  return (
    <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={data.totalDevices} />
        <StatCard label="Cost / Student" value={Math.round(data.costPerStudent)} prefix="$" />
        <StatCard label="Repair Rate" value={Math.round(data.repairRate)} suffix="%" />
        <StatCard label="Avg Fleet Age" value={Math.round(data.avgFleetAge * 10) / 10} suffix=" yr" />
      </div>

      {/* Device breakdown table */}
      {data.devicesByType && Object.keys(data.devicesByType).length > 0 && (
        <div className="ui-glass-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Device Type</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.devicesByType).map(([type, count]) => (
                <tr key={type} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 px-4 text-slate-700 capitalize">{type.toLowerCase().replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

// ─── Refresh Forecast Detail ────────────────────────────────────────────

function RefreshForecastDetail({ data }: { data: RefreshForecastData }) {
  return (
    <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Over Threshold" value={data.devicesOverThreshold} />
        <StatCard label="Replacement Cost" value={Math.round(data.projectedReplacementCost)} prefix="$" />
        <StatCard label="Year 1 Budget" value={Math.round(data.staggeredYearOne)} prefix="$" />
      </div>

      {/* Staggered budget breakdown */}
      <div className="ui-glass p-5">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Staggered Replacement Budget</h4>
        <div className="space-y-3">
          {[
            { label: 'Year 1', value: data.staggeredYearOne },
            { label: 'Year 2', value: data.staggeredYearTwo },
            { label: 'Year 3', value: data.staggeredYearThree },
            { label: 'Year 4', value: data.staggeredYearFour },
          ].map((item) => {
            const maxVal = Math.max(data.staggeredYearOne, data.staggeredYearTwo, data.staggeredYearThree, data.staggeredYearFour, 1)
            const pct = (item.value / maxVal) * 100
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 w-12">{item.label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-20 text-right">
                  ${item.value.toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fleet age distribution */}
      {data.devicesByAge && data.devicesByAge.length > 0 && (
        <div className="ui-glass-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Purchase Year</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Devices</th>
              </tr>
            </thead>
            <tbody>
              {data.devicesByAge.map((row) => (
                <tr key={row.year} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 px-4 text-slate-700">{row.year}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

// ─── Repair vs Replace Detail ───────────────────────────────────────────

function RepairReplaceDetail({ data }: { data: RepairReplaceData }) {
  return (
    <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Lemon Devices" value={data.totalLemonCount} />
        <StatCard label="Avg Repair Cost" value={Math.round(data.avgRepairCost)} prefix="$" />
        <StatCard label="Replace Recommended" value={data.replaceRecommendedCount} />
        <StatCard label="Repair Recommended" value={data.repairRecommendedCount} />
      </div>

      {data.lemons && data.lemons.length > 0 && (
        <div className="ui-glass-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Asset Tag</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Model</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Repairs</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cost</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {data.lemons.slice(0, 20).map((device) => (
                <tr key={device.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{device.assetTag}</td>
                  <td className="py-2.5 px-4 text-slate-700">{device.model ?? '-'}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{device.repairCount}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                    ${device.totalRepairCost.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      device.recommendation === 'replace'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {device.recommendation === 'replace' ? 'Replace' : 'Repair'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.lemons.length > 20 && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
              Showing 20 of {data.lemons.length} devices
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Damage Fees Detail ─────────────────────────────────────────────────

function DamageFeesDetail({ data }: { data: DamageFeesData }) {
  return (
    <motion.div variants={staggerContainer(0.05)} initial="hidden" animate="visible" className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Assessed" value={Math.round(data.totalAssessed)} prefix="$" />
        <StatCard label="Collected" value={Math.round(data.totalCollected)} prefix="$" />
        <StatCard label="Outstanding" value={Math.round(data.totalOutstanding)} prefix="$" />
        <StatCard label="Collection Rate" value={Math.round(data.collectionRate)} suffix="%" />
      </div>

      {data.fees && data.fees.length > 0 && (
        <div className="ui-glass-table">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Asset Tag</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Assessed</th>
              </tr>
            </thead>
            <tbody>
              {data.fees.slice(0, 25).map((fee) => (
                <tr key={fee.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 px-4 text-slate-700">{fee.studentName}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{fee.assetTag}</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                    ${fee.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      fee.status === 'PAID' ? 'bg-green-100 text-green-700'
                        : fee.status === 'WAIVED' ? 'bg-slate-100 text-slate-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {fee.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-slate-500">
                    {new Date(fee.assessedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.fees.length > 25 && (
            <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
              Showing 25 of {data.fees.length} fees
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
