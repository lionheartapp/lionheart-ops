'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { Trophy, Building2, Dribbble, Users, CalendarDays, ClipboardList, BarChart3 } from 'lucide-react'
import SportsSection from '@/components/athletics/SportsSection'
import TeamsSection from '@/components/athletics/TeamsSection'
import ScheduleSection from '@/components/athletics/ScheduleSection'
import TournamentsSection from '@/components/athletics/TournamentsSection'
import RosterSection from '@/components/athletics/RosterSection'
import StatsSection from '@/components/athletics/StatsSection'

interface Campus {
  id: string
  name: string
  isActive: boolean
}

async function fetchCampuses(): Promise<Campus[]> {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/settings/campus/campuses', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.ok ? data.data : []
}

type SubTab = 'sports' | 'teams' | 'schedule' | 'tournaments' | 'roster' | 'stats'

const SUB_TABS: { key: SubTab; label: string; icon: typeof Dribbble }[] = [
  { key: 'sports', label: 'Sports', icon: Dribbble },
  { key: 'teams', label: 'Teams', icon: Users },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'roster', label: 'Roster', icon: ClipboardList },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
]

export default function AthleticsPage() {
  const router = useRouter()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const [orgLogoUrl] = useState<string | null>(typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null)

  const [isClient, setIsClient] = useState(false)
  useState(() => { setIsClient(true) })

  const { data: modules = [] } = useModules()
  const { data: campuses = [] } = useQuery({
    queryKey: ['campuses'],
    queryFn: fetchCampuses,
    staleTime: 5 * 60 * 1000,
  })

  const enabledCampusIds = modules
    .filter((m) => m.moduleId === 'athletics' && m.campusId)
    .map((m) => m.campusId as string)

  const enabledCampuses = campuses.filter((c) => enabledCampusIds.includes(c.id))

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const activeCampusId = selectedCampusId ?? enabledCampuses[0]?.id ?? null

  const [activeTab, setActiveTab] = useState<SubTab>('sports')

  if (!isClient && typeof window !== 'undefined') setIsClient(true)

  if (!token || !orgId) {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  const handleLogout = () => {
    localStorage.removeItem('auth-token')
    localStorage.removeItem('org-id')
    localStorage.removeItem('user-name')
    localStorage.removeItem('user-email')
    localStorage.removeItem('user-avatar')
    localStorage.removeItem('user-team')
    localStorage.removeItem('user-school-scope')
    localStorage.removeItem('user-role')
    localStorage.removeItem('org-name')
    localStorage.removeItem('org-school-type')
    localStorage.removeItem('org-logo-url')
    router.push('/login')
  }

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || 'user@school.edu'}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      <ModuleGate moduleId="athletics">
        <div>
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Athletics</h1>
            <p className="text-sm text-gray-500">Manage sports teams, schedules, and rosters</p>
          </div>

          {/* Campus tabs */}
          {enabledCampuses.length > 1 && (
            <div className="flex gap-1 border-b border-gray-200 mb-4">
              {enabledCampuses.map((campus) => (
                <button
                  key={campus.id}
                  onClick={() => setSelectedCampusId(campus.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeCampusId === campus.id
                      ? 'border-primary-500 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  {campus.name}
                </button>
              ))}
            </div>
          )}

          {/* Single campus label */}
          {enabledCampuses.length === 1 && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              <Building2 className="w-4 h-4" />
              {enabledCampuses[0].name}
            </div>
          )}

          {/* Sub-navigation tabs */}
          <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
            {SUB_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  activeTab === key
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Active section */}
          {activeTab === 'sports' && <SportsSection />}
          {activeTab === 'teams' && <TeamsSection activeCampusId={activeCampusId} />}
          {activeTab === 'schedule' && <ScheduleSection activeCampusId={activeCampusId} />}
          {activeTab === 'roster' && <RosterSection activeCampusId={activeCampusId} />}
          {activeTab === 'tournaments' && <TournamentsSection activeCampusId={activeCampusId} />}
          {activeTab === 'stats' && <StatsSection activeCampusId={activeCampusId} />}
        </div>
      </ModuleGate>
    </DashboardLayout>
  )
}
