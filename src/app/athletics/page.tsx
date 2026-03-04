'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import SportsSection from '@/components/athletics/SportsSection'
import TeamsSection from '@/components/athletics/TeamsSection'
import ScheduleSection from '@/components/athletics/ScheduleSection'
import TournamentsSection from '@/components/athletics/TournamentsSection'
import RosterSection from '@/components/athletics/RosterSection'
import StatsSection from '@/components/athletics/StatsSection'
import type { AthleticsTab } from '@/components/Sidebar'

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

interface CalendarBrief {
  id: string
  color: string
  calendarType: string
  campus?: { id: string; name: string } | null
}

async function fetchCalendars(): Promise<CalendarBrief[]> {
  const token = localStorage.getItem('auth-token')
  const res = await fetch('/api/calendars', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.ok ? data.data : []
}

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
  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars-brief'],
    queryFn: fetchCalendars,
    staleTime: 5 * 60 * 1000,
  })

  // Build campus → color map from master calendars (first calendar per campus wins)
  const campusColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cal of calendars) {
      if (cal.campus?.id && !map.has(cal.campus.id)) {
        map.set(cal.campus.id, cal.color)
      }
    }
    return map
  }, [calendars])

  const enabledCampusIds = modules
    .filter((m) => m.moduleId === 'athletics' && m.campusId)
    .map((m) => m.campusId as string)

  const enabledCampuses = campuses.filter((c) => enabledCampusIds.includes(c.id))

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const activeCampusId = selectedCampusId ?? enabledCampuses[0]?.id ?? null

  const [activeTab, setActiveTab] = useState<AthleticsTab>('sports')

  // Track whether we've dispatched sidebar data so we re-dispatch when data changes
  const lastDispatchRef = useRef<string>('')

  // Default color fallback for campuses without a master calendar
  const DEFAULT_CAMPUS_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

  // Dispatch sidebar data whenever campuses/modules load or change
  const dispatchSidebarData = useCallback(() => {
    if (enabledCampuses.length === 0) return
    const colorKeys = enabledCampuses.map((c) => campusColorMap.get(c.id) ?? '').join(',')
    const key = enabledCampuses.map((c) => c.id).join(',') + '|' + colorKeys + '|' + activeCampusId + '|' + activeTab
    if (key === lastDispatchRef.current) return
    lastDispatchRef.current = key
    window.dispatchEvent(
      new CustomEvent('athletics-sidebar-data', {
        detail: {
          campuses: enabledCampuses.map((c, i) => ({
            id: c.id,
            name: c.name,
            color: campusColorMap.get(c.id) ?? DEFAULT_CAMPUS_COLORS[i % DEFAULT_CAMPUS_COLORS.length],
          })),
          activeCampusId,
          activeTab,
        },
      })
    )
  }, [enabledCampuses, activeCampusId, activeTab, campusColorMap])

  useEffect(() => {
    dispatchSidebarData()
  }, [dispatchSidebarData])

  // Listen for sidebar-driven changes
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const event = e as CustomEvent<{ tab: AthleticsTab }>
      if (event.detail?.tab) setActiveTab(event.detail.tab)
    }
    const handleCampusChange = (e: Event) => {
      const event = e as CustomEvent<{ campusId: string }>
      if (event.detail?.campusId) setSelectedCampusId(event.detail.campusId)
    }
    window.addEventListener('athletics-tab-change', handleTabChange)
    window.addEventListener('athletics-campus-change', handleCampusChange)
    return () => {
      window.removeEventListener('athletics-tab-change', handleTabChange)
      window.removeEventListener('athletics-campus-change', handleCampusChange)
    }
  }, [])

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
            <p className="text-sm text-gray-500">
              {enabledCampuses.find((c) => c.id === activeCampusId)?.name || 'Manage sports teams, schedules, and rosters'}
            </p>
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
