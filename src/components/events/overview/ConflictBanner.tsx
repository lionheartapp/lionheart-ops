'use client'

import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { AlertTriangle } from 'lucide-react'
import { fadeInUp } from '@/lib/animations'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConflictItem {
  type: string
  severity: string
  description: string
  conflictingEventTitle?: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConflictBanner({ conflicts, checkedAt }: { conflicts: ConflictItem[]; checkedAt?: string }) {
  if (conflicts.length === 0) return null

  const highCount = conflicts.filter((c) => c.severity === 'high').length

  return (
    <motion.div
      variants={fadeInUp}
      className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          {conflicts.length} scheduling conflict{conflicts.length === 1 ? '' : 's'} detected
          {highCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">{highCount} critical</span>}
        </p>
        {checkedAt && (
          <span className="text-[10px] text-amber-600">
            Checked {format(new Date(checkedAt), 'MMM d, h:mm a')}
          </span>
        )}
      </div>
      {conflicts.map((c, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span
            className={`px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
              c.severity === 'high'
                ? 'bg-red-100 text-red-700'
                : c.severity === 'medium'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {c.severity.toUpperCase()}
          </span>
          <span className="text-amber-800">{c.description}</span>
        </div>
      ))}
    </motion.div>
  )
}
