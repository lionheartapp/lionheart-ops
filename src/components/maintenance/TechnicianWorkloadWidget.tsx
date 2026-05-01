'use client'

import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Users, ChevronRight } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'
import { fetchApi } from '@/lib/api-client'

interface TechnicianWorkload {
  technicianId: string
  name: string
  activeTickets: number
  hoursThisWeek: number
  hoursThisMonth: number
}

interface AnalyticsResponse {
  technicianWorkload: TechnicianWorkload[]
}

export default function TechnicianWorkloadWidget() {
  const router = useRouter()

  const { data } = useQuery<AnalyticsResponse>({
    queryKey: ['maintenance-analytics-workload'],
    queryFn: () => fetchApi<AnalyticsResponse>('/api/maintenance/analytics'),
    staleTime: 5 * 60 * 1000,
    select: (d) => ({ technicianWorkload: d.technicianWorkload ?? [] }),
  })

  const technicians = data?.technicianWorkload ?? []
  if (technicians.length === 0) return null

  const maxTickets = Math.max(1, ...technicians.map((t) => t.activeTickets))

  return (
    <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Technician Workload</h3>
        </div>
        <button
          onClick={() => router.push('/maintenance/analytics')}
          className="text-xs text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          Full analytics
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2.5">
        {technicians.slice(0, 5).map((tech) => {
          const pct = Math.round((tech.activeTickets / maxTickets) * 100)
          const initials = tech.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

          return (
            <div key={tech.technicianId} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-semibold text-slate-500">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-700 truncate" title={tech.name}>{tech.name}</span>
                  <span className="text-xs text-slate-500 flex-shrink-0 ml-2">
                    {tech.activeTickets} active
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      pct >= 80 ? 'bg-red-400' : pct >= 50 ? 'bg-amber-400' : 'bg-slate-300'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {technicians.length > 5 && (
        <button
          onClick={() => router.push('/maintenance/analytics')}
          className="w-full flex items-center justify-center gap-1 py-1.5 mt-3 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
        >
          +{technicians.length - 5} more technicians
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  )
}
