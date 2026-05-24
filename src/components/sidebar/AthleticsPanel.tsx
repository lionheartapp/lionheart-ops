'use client'

import { useMemo } from 'react'
import CampusShapeIndicator from '@/components/calendar/CampusShapeIndicator'
import { LayoutDashboard, Settings2, CalendarDays, BarChart3, Globe } from 'lucide-react'
import type { AthleticsCampus } from './types'

const ATHLETICS_TABS = [
  { key: 'overview', label: 'Today', icon: LayoutDashboard },
  { key: 'manage', label: 'Teams', icon: Settings2 },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'stats', label: 'Results', icon: BarChart3 },
  { key: 'leagues', label: 'Leagues', icon: Globe },
]

interface AthleticsPanelProps {
  athleticsCampuses: AthleticsCampus[]
  athleticsCampusId: string | null
  activeTab: string
  onCampusClick: (campusId: string) => void
  onTabClick: (tab: string) => void
}

export default function AthleticsPanel({
  athleticsCampuses,
  athleticsCampusId,
  activeTab,
  onCampusClick,
  onTabClick,
}: AthleticsPanelProps) {
  const campusShapeMap = useMemo(() => {
    const ids = athleticsCampuses.map((c) => c.id).sort()
    return new Map(ids.map((id, i) => [id, i % 5]))
  }, [athleticsCampuses])

  return (
    <div className="flex flex-col h-full">
      {/* Navigation tabs */}
      <div className="px-3 pt-10 flex-shrink-0">
        <nav className="space-y-0.5" aria-label="Athletics navigation">
          {ATHLETICS_TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => onTabClick(tab.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-[13.5px] transition-colors focus:outline-none"
                style={{
                  backgroundColor: active ? '#f6f4f0' : 'transparent',
                  color: active ? '#1a1915' : '#6a6864',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.005em',
                }}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className="w-[18px] h-[18px] flex-shrink-0"
                  strokeWidth={active ? 2.25 : 1.75}
                  aria-hidden="true"
                />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Campus selector */}
      {athleticsCampuses.length > 1 && (
        <div className="px-3 pt-6">
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
