'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, MotionConfig } from 'framer-motion'
import { queryOptions, queryKeys } from '@/lib/queries'
import { staggerContainer, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { DashboardSkeleton } from './ITSkeleton'
import { StatusBadge, PriorityBadge, TypeBadge } from './ITStatusBadge'
import { Monitor, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

interface ITDashboardProps {
  onViewTicket: (ticketId: string) => void
  onCreateTicket: () => void
}

interface DashboardStats {
  total: number
  open: number
  inProgress: number
  urgent: number
  recentDone: number
}

interface TicketRow {
  id: string
  ticketNumber: string
  title: string
  status: string
  priority: string
  issueType: string
  createdAt: string
  submittedBy?: { firstName: string; lastName: string } | null
  assignedTo?: { firstName: string; lastName: string } | null
}

const STAT_CARDS = [
  { key: 'open' as const, label: 'Open', icon: Monitor, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'inProgress' as const, label: 'In Progress', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { key: 'urgent' as const, label: 'Urgent', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  { key: 'recentDone' as const, label: 'Resolved (7d)', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
]

export default function ITDashboard({ onViewTicket, onCreateTicket }: ITDashboardProps) {
  const { data: stats, isLoading: statsLoading } = useQuery(queryOptions.itDashboard())
  const { data: ticketsData, isLoading: ticketsLoading } = useQuery(queryOptions.itTickets({ limit: '8' }))

  const isLoading = statsLoading || ticketsLoading

  if (isLoading) return <DashboardSkeleton />

  const dashStats = (stats ?? { total: 0, open: 0, inProgress: 0, urgent: 0, recentDone: 0 }) as DashboardStats
  const tickets = ((ticketsData as { tickets?: TicketRow[] })?.tickets ?? []) as TicketRow[]

  return (
    <MotionConfig transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}>
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_CARDS.map((s) => (
            <motion.div
              key={s.key}
              variants={cardEntrance}
              className="ui-glass p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                <AnimatedCounter value={dashStats[s.key]} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Tickets */}
        <motion.div variants={cardEntrance} className="ui-glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Tickets</h3>
            <button
              onClick={onCreateTicket}
              className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all"
            >
              New Request
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Monitor className="w-6 h-6 text-blue-500" />
              </div>
              <p className="text-sm text-gray-500">No tickets yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first IT request to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2 font-medium">Ticket</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Priority</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => onViewTicket(t.id)}
                        className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">{t.ticketNumber}</td>
                        <td className="py-2.5 pr-3 text-gray-900 truncate max-w-[200px]">{t.title}</td>
                        <td className="py-2.5 pr-3"><StatusBadge status={t.status} /></td>
                        <td className="py-2.5 pr-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="py-2.5 pr-3"><TypeBadge type={t.issueType} /></td>
                        <td className="py-2.5 text-xs text-gray-500">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card view */}
              <div className="sm:hidden space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onViewTicket(t.id)}
                    className="w-full text-left p-3 rounded-xl bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-gray-500">{t.ticketNumber}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <PriorityBadge priority={t.priority} />
                      <TypeBadge type={t.issueType} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}
