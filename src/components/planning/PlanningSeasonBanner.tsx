'use client'

import type { PlanningSeason } from '@/lib/hooks/usePlanningSeason'

interface PlanningSeasonBannerProps {
  season: PlanningSeason
  onNavigate: () => void
}

export default function PlanningSeasonBanner({ season, onNavigate }: PlanningSeasonBannerProps) {
  const isCollecting = season.phase === 'COLLECTING'
  const closeDate = new Date(season.submissionClose).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-blue-900">{season.name}</p>
          <p className="text-xs text-blue-700">
            {isCollecting
              ? `Submissions open until ${closeDate}`
              : `Phase: ${season.phase.replace('_', ' ')}`}
          </p>
        </div>
      </div>
      <button onClick={onNavigate} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition">
        {isCollecting ? 'Submit Event' : 'View Planning'}
      </button>
    </div>
  )
}
