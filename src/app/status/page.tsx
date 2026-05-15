'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  Server,
  Mail,
  HardDrive,
  Cpu,
  Radio,
} from 'lucide-react'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'
import { fadeInUp, staggerContainer } from '@/lib/animations'

// ─── Types ────────────────────────────────────────────────────────────

type ServiceStatus = 'operational' | 'degraded' | 'outage'

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latencyMs?: number
  message?: string
}

interface StatusData {
  overall: ServiceStatus
  services: ServiceCheck[]
  timestamp: string
}

// ─── Constants ────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, typeof Server> = {
  API: Server,
  Database: Database,
  Cache: Radio,
  Email: Mail,
  Storage: HardDrive,
  AI: Cpu,
}

const STATUS_CONFIG: Record<ServiceStatus, {
  label: string
  color: string
  bg: string
  border: string
  dot: string
  icon: typeof CheckCircle2
}> = {
  operational: {
    label: 'Operational',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
  },
  outage: {
    label: 'Outage',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-500',
    icon: XCircle,
  },
}

const REFRESH_INTERVAL_MS = 30_000

// ─── Component ────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/status', { cache: 'no-store' })
      const json = await res.json()
      if (json.ok && json.data) {
        setData(json.data)
        setError(null)
      } else {
        setError('Failed to fetch status')
      }
    } catch {
      setError('Unable to reach the status API')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(() => fetchStatus(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchStatus])

  const overallConfig = data ? STATUS_CONFIG[data.overall] : STATUS_CONFIG.operational
  const OverallIcon = overallConfig.icon

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicNav />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-16 max-w-4xl mx-auto w-full">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.08, 0.05)}
          >
            {/* Hero */}
            <motion.div variants={fadeInUp} className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl font-heading font-bold text-slate-900 mb-4">
                System Status
              </h1>

              {loading ? (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 text-slate-500 text-sm">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                  Checking services...
                </div>
              ) : error ? (
                <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                  <XCircle className="w-4 h-4" />
                  {error}
                </div>
              ) : (
                <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full ${overallConfig.bg} border ${overallConfig.border} ${overallConfig.color} text-sm font-medium`}>
                  <OverallIcon className="w-4 h-4" />
                  {data?.overall === 'operational'
                    ? 'All systems operational'
                    : data?.overall === 'degraded'
                    ? 'Some systems experiencing issues'
                    : 'Service disruption detected'}
                </div>
              )}
            </motion.div>

            {/* Service Grid */}
            {data && (
              <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {data.services.map((service) => {
                  const config = STATUS_CONFIG[service.status]
                  const Icon = SERVICE_ICONS[service.name] || Server
                  const StatusIcon = config.icon

                  return (
                    <div
                      key={service.name}
                      className={`bg-white border ${config.border} rounded-xl p-5 transition-colors`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Icon className="w-4.5 h-4.5 text-slate-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">{service.name}</h3>
                            {service.latencyMs !== undefined && (
                              <p className="text-xs text-slate-400">{service.latencyMs}ms</p>
                            )}
                          </div>
                        </div>
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                      </div>
                      {service.message && (
                        <p className="text-xs text-slate-400 mt-2">{service.message}</p>
                      )}
                    </div>
                  )
                })}
              </motion.div>
            )}

            {/* Footer info */}
            {data && (
              <motion.div variants={fadeInUp} className="flex items-center justify-between text-xs text-slate-400">
                <p>
                  Last checked: {new Date(data.timestamp).toLocaleTimeString()} — auto-refreshes every 30s
                </p>
                <button
                  onClick={() => fetchStatus(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </main>

        <PublicFooter />
      </div>
    </MotionConfig>
  )
}
