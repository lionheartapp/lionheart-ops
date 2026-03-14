'use client'

import { motion } from 'framer-motion'
import { Building2 } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'
import AnimatedCounter from '@/components/motion/AnimatedCounter'

interface CampusCount {
  schoolId: string
  schoolName: string
  count: number
}

interface CampusComparisonWidgetProps {
  data: CampusCount[]
  onCampusClick?: (schoolId: string) => void
}

export default function CampusComparisonWidget({ data, onCampusClick }: CampusComparisonWidgetProps) {
  if (!data || data.length === 0) {
    return (
      <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Tickets by Campus</h3>
        </div>
        <div className="text-xs text-slate-400 text-center py-4">No campus data available</div>
      </motion.div>
    )
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count))

  return (
    <motion.div variants={fadeInUp} className="ui-glass p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Tickets by Campus</h3>
        <span className="text-xs text-slate-400">Open tickets</span>
      </div>

      <div className="space-y-3">
        {data.map((campus) => {
          const pct = Math.round((campus.count / maxCount) * 100)

          return (
            <div
              key={campus.schoolId}
              className={`flex items-center gap-3 ${onCampusClick ? 'cursor-pointer rounded-lg px-1 -mx-1 py-0.5 hover:bg-slate-50 transition-colors' : ''}`}
              onClick={onCampusClick ? () => onCampusClick(campus.schoolId) : undefined}
            >
              <div className="flex items-center gap-2 w-32 flex-shrink-0">
                <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 truncate">{campus.schoolName}</span>
              </div>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
              <span className="text-sm font-semibold text-slate-900 w-8 text-right flex-shrink-0">
                <AnimatedCounter value={campus.count} />
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
