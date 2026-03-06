'use client'

import { motion } from 'framer-motion'
import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CalendarClock,
  DollarSign,
} from 'lucide-react'
import { staggerContainer, fadeInUp, cardEntrance } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'

interface MaintenanceDashboardProps {
  activeCampusId: string | null
}

const TICKET_STATUSES = [
  { label: 'Backlog', color: '#64748b' },
  { label: 'To Do', color: '#3b82f6' },
  { label: 'In Progress', color: '#f59e0b' },
  { label: 'On Hold', color: '#ef4444' },
  { label: 'Scheduled', color: '#8b5cf6' },
  { label: 'QA Review', color: '#ec4899' },
  { label: 'Done', color: '#22c55e' },
  { label: 'Cancelled', color: '#94a3b8' },
]

function EmptyState({ icon: Icon, heading, description }: { icon: typeof Clock; heading: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{heading}</p>
      <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">{description}</p>
    </div>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <span className="text-xs text-gray-300 cursor-not-allowed">View all</span>
    </div>
  )
}

export default function MaintenanceDashboard({ activeCampusId: _activeCampusId }: MaintenanceDashboardProps) {
  const statCards = [
    {
      label: 'Open Tickets',
      value: 0,
      icon: ClipboardList,
      accent: false,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Urgent / Overdue',
      value: 0,
      icon: AlertTriangle,
      accent: true,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: 'In Progress',
      value: 0,
      icon: Wrench,
      accent: false,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Completed This Month',
      value: 0,
      icon: CheckCircle2,
      accent: false,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
  ]

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
    >
      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.label}
              variants={cardEntrance}
              custom={i}
              className={
                card.accent
                  ? 'bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm'
                  : 'ui-glass p-5'
              }
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                <AnimatedCounter value={card.value} />
              </div>
              <p className="text-xs text-gray-500">{card.label}</p>
            </motion.div>
          )
        })}
      </div>

      {/* Two-column panel grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Tickets by Status */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Tickets by Status" />
            <div className="space-y-2.5">
              {TICKET_STATUSES.map((status) => (
                <div key={status.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20 flex-shrink-0">{status.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: '0%', backgroundColor: status.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-4 text-right flex-shrink-0">0</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Recent Activity" />
            <EmptyState
              icon={Clock}
              heading="No activity yet"
              description="Ticket activity and updates will appear here once you start receiving requests."
            />
          </motion.div>

          {/* Campus Breakdown */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Campus Breakdown" />
            <div className="text-xs text-gray-400 text-center py-4">No campus data available</div>
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Urgent / Overdue Alerts */}
          <motion.div
            variants={fadeInUp}
            className="bg-gradient-to-br from-red-50/80 to-red-100/80 backdrop-blur-sm border border-red-200/30 rounded-2xl p-5 shadow-sm"
          >
            <PanelHeader title="Urgent / Overdue Alerts" />
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 text-red-300" />
              </div>
              <p className="text-sm font-medium text-red-700 mb-1">No urgent alerts</p>
              <p className="text-xs text-red-400 max-w-[180px] leading-relaxed">
                Overdue and high-priority tickets will appear here.
              </p>
            </div>
          </motion.div>

          {/* Technician Workload */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="Technician Workload" />
            <div className="text-xs text-gray-300 mb-2 flex gap-4 pb-1 border-b border-gray-100">
              <span className="flex-1">Technician</span>
              <span className="w-20 text-right">Active</span>
              <span className="w-20 text-right">Specialty</span>
            </div>
            <div className="text-xs text-gray-400 text-center py-4">No technicians assigned yet</div>
          </motion.div>

          {/* PM Calendar Preview */}
          <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
            <PanelHeader title="PM Calendar Preview" />
            <EmptyState
              icon={CalendarClock}
              heading="No PM schedules configured"
              description="Preventive maintenance schedules will appear here once configured."
            />
          </motion.div>
        </div>
      </div>

      {/* Full-width bottom row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cost Summary */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Cost Summary" />
          <EmptyState
            icon={DollarSign}
            heading="No cost data yet"
            description="Labor and material costs will be tracked here once tickets are completed."
          />
        </motion.div>

        {/* Compliance Status */}
        <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
          <PanelHeader title="Compliance Status" />
          <EmptyState
            icon={ShieldCheck}
            heading="No compliance domains configured"
            description="Compliance tracking domains will appear here once configured."
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
