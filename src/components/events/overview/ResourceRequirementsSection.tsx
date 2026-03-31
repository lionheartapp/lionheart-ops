'use client'

import { motion } from 'framer-motion'
import { Layers, Monitor, Wrench, StickyNote } from 'lucide-react'
import { listItem } from '@/lib/animations'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Component ──────────────────────────────────────────────────────────────

export function ResourceRequirementsSection({ project }: { project: EventProject }) {
  const meta = (project.metadata ?? {}) as Record<string, unknown>

  const avNeeds = (meta.avNeeds ?? []) as string[]
  const avNotes = (meta.avNotes ?? '') as string
  const facilityNeeds = (meta.facilityNeeds ?? []) as string[]
  const facilityNotes = (meta.facilityNotes ?? '') as string

  const hasAV = project.requiresAV
  const hasFacilities = project.requiresFacilities

  if (!hasAV && !hasFacilities) return null

  return (
    <motion.div variants={listItem} className="ui-glass p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Layers className="w-4 h-4 text-slate-400" />
        Resource Requirements
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* A/V Requirements */}
        {hasAV && (
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800">A/V Production</span>
            </div>
            {avNeeds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {avNeeds.map((need) => (
                  <span
                    key={need}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium"
                  >
                    {need}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-600 italic">A/V support requested — no specific items listed</p>
            )}
            {avNotes && (
              <div className="flex items-start gap-1.5 pt-1 border-t border-blue-100">
                <StickyNote className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">{avNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Facilities Requirements */}
        {hasFacilities && (
          <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-4 py-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800">Facilities</span>
            </div>
            {facilityNeeds.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {facilityNeeds.map((need) => (
                  <span
                    key={need}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium"
                  >
                    {need}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-600 italic">Facilities support requested — no specific items listed</p>
            )}
            {facilityNotes && (
              <div className="flex items-start gap-1.5 pt-1 border-t border-amber-100">
                <StickyNote className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 leading-relaxed">{facilityNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
