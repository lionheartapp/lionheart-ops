'use client'

import { useMemo } from 'react'
import CampusShapeIndicator from '@/components/calendar/CampusShapeIndicator'
import type { AthleticsCampus } from './types'

interface AthleticsPanelProps {
  athleticsCampuses: AthleticsCampus[]
  athleticsCampusId: string | null
  onCampusClick: (campusId: string) => void
}

export default function AthleticsPanel({
  athleticsCampuses,
  athleticsCampusId,
  onCampusClick,
}: AthleticsPanelProps) {
  const campusShapeMap = useMemo(() => {
    const ids = athleticsCampuses.map((c) => c.id).sort()
    return new Map(ids.map((id, i) => [id, i % 5]))
  }, [athleticsCampuses])

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-10 pb-4 border-b border-white/30">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Athletics</h2>
      </div>

      {athleticsCampuses.length > 0 && (
        <div className="px-3 pt-4">
          <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase px-2 mb-2">
            Campuses
          </p>
          <nav className="space-y-0.5" aria-label="Athletics campuses">
            {athleticsCampuses.map((campus) => {
              const isActiveCampus = athleticsCampusId === campus.id
              return (
                <button
                  key={campus.id}
                  onClick={() => onCampusClick(campus.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                    isActiveCampus
                      ? 'bg-white/50 text-primary-600 font-medium'
                      : 'text-slate-500 hover:bg-white/30 hover:text-slate-700'
                  }`}
                >
                  <CampusShapeIndicator
                    shapeIndex={campusShapeMap.get(campus.id) ?? 0}
                    color={campus.color}
                    size={14}
                  />
                  {campus.name}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
