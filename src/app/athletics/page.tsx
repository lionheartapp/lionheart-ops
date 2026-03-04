'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { queryOptions as sharedQueryOptions } from '@/lib/queries'
import { Dribbble, Users, CalendarDays, ClipboardList, Trophy, BarChart3 } from 'lucide-react'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import SportsSection from '@/components/athletics/SportsSection'
import TeamsSection from '@/components/athletics/TeamsSection'
import ScheduleSection from '@/components/athletics/ScheduleSection'
import TournamentsSection from '@/components/athletics/TournamentsSection'
import RosterSection from '@/components/athletics/RosterSection'
import StatsSection from '@/components/athletics/StatsSection'
import type { AthleticsTab } from '@/components/Sidebar'

const SUB_TABS: { key: AthleticsTab; label: string; icon: typeof Dribbble }[] = [
  { key: 'sports', label: 'Sports', icon: Dribbble },
  { key: 'teams', label: 'Teams', icon: Users },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'roster', label: 'Roster', icon: ClipboardList },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
]

interface Campus {
  id: string
  name: string
  isActive: boolean
}

interface CalendarBrief {
  id: string
  color: string
  calendarType: string
  campus?: { id: string; name: string } | null
}

export default function AthleticsPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

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
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )

  // Hydration guard + auth redirect
  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  // Fetch org logo from API if not in localStorage
  useEffect(() => {
    if (orgLogoUrl || !token) return
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/onboarding/school-info', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.data?.logoUrl) {
            setOrgLogoUrl(data.data.logoUrl)
            localStorage.setItem('org-logo-url', data.data.logoUrl)
          }
        }
      } catch {
        // Silently fail — logo is non-critical
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: perms } = usePermissions()
  const canWrite = perms?.canWriteAthletics ?? false
  const canManageUsers = perms?.canManageUsers ?? false
  const { data: rawCampuses, isLoading: campusesLoading } = useQuery(sharedQueryOptions.campuses())
  const campuses = (rawCampuses as Campus[] | undefined) ?? []
  const { data: rawCalendars } = useQuery(sharedQueryOptions.calendars())
  const calendars = (rawCalendars as CalendarBrief[] | undefined) ?? []

  const dataLoading = modulesLoading || campusesLoading

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
    const key = enabledCampuses.map((c) => c.id).join(',') + '|' + colorKeys + '|' + activeCampusId
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
        },
      })
    )
  }, [enabledCampuses, activeCampusId, campusColorMap]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dispatchSidebarData()
  }, [dispatchSidebarData])

  // Listen for sidebar-driven campus changes
  useEffect(() => {
    const handleCampusChange = (e: Event) => {
      const event = e as CustomEvent<{ campusId: string }>
      if (event.detail?.campusId) setSelectedCampusId(event.detail.campusId)
    }
    window.addEventListener('athletics-campus-change', handleCampusChange)
    return () => {
      window.removeEventListener('athletics-campus-change', handleCampusChange)
    }
  }, [])

  // Re-dispatch sidebar data when the Sidebar requests it (handles race condition)
  useEffect(() => {
    const handleRequest = () => {
      lastDispatchRef.current = '' // clear dedup so dispatchSidebarData actually fires
      dispatchSidebarData()
    }
    window.addEventListener('athletics-sidebar-request', handleRequest)
    return () => {
      window.removeEventListener('athletics-sidebar-request', handleRequest)
    }
  }, [dispatchSidebarData])

  // Loading screen during hydration
  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
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

          {/* Sub-navigation tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
            {SUB_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-primary-500 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Loading skeleton while campuses/modules load */}
          {dataLoading ? (
            <AthleticsTableSkeleton columns={5} rows={5} />
          ) : (
            <>
              {activeTab === 'sports' && <SportsSection canWrite={canWrite} />}
              {activeTab === 'teams' && <TeamsSection activeCampusId={activeCampusId} canWrite={canWrite} />}
              {activeTab === 'schedule' && <ScheduleSection activeCampusId={activeCampusId} canWrite={canWrite} />}
              {activeTab === 'roster' && <RosterSection activeCampusId={activeCampusId} canWrite={canWrite} canManageUsers={canManageUsers} />}
              {activeTab === 'tournaments' && <TournamentsSection activeCampusId={activeCampusId} canWrite={canWrite} />}
              {activeTab === 'stats' && <StatsSection activeCampusId={activeCampusId} canWrite={canWrite} />}
            </>
          )}
        </div>
      </ModuleGate>
    </DashboardLayout>
  )
}
