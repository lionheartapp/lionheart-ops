'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { queryOptions as sharedQueryOptions } from '@/lib/queries'
import { Dribbble, Users, CalendarDays, ClipboardList, Trophy } from 'lucide-react'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import SportsSection from '@/components/athletics/SportsSection'
import TeamsSection from '@/components/athletics/TeamsSection'
import ScheduleSection from '@/components/athletics/ScheduleSection'
import TournamentsSection from '@/components/athletics/TournamentsSection'
import RosterSection from '@/components/athletics/RosterSection'
import StatsSection from '@/components/athletics/StatsSection'
import AthleticsOnboarding from '@/components/athletics/AthleticsOnboarding'
import AthleticsAddMenu from '@/components/athletics/AthleticsAddMenu'
import AthleticsMegaImport from '@/components/athletics/AthleticsMegaImport'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'
import AthleticsDashboard from '@/components/athletics/AthleticsDashboard'
import type { AthleticsTab } from '@/components/Sidebar'

type ManageSection = 'sports' | 'teams' | 'roster'
type ScheduleSection = 'games' | 'tournaments'

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
  usePageTitle('Athletics')
  useTrackModuleVisit('athletics')
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

  const [activeTab, setActiveTab] = useState<AthleticsTab>('overview')
  const [manageSection, setManageSection] = useState<ManageSection>('sports')
  const [scheduleSection, setScheduleSection] = useState<ScheduleSection>('games')
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [megaImportOpen, setMegaImportOpen] = useState(false)

  // Listen for sidebar tab navigation
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab
      if (tab) setActiveTab(tab as AthleticsTab)
    }
    window.addEventListener('athletics-tab-change', handleTabChange)
    return () => window.removeEventListener('athletics-tab-change', handleTabChange)
  }, [])

  // ── Data queries for onboarding / progressive tab visibility ──────
  const { data: onboardSports, isSuccess: sportsLoaded } = useQuery(sharedQueryOptions.athleticsSports())
  const { data: onboardSeasons } = useQuery(sharedQueryOptions.athleticsSeasons())
  const { data: onboardTeams } = useQuery(sharedQueryOptions.athleticsTeams())
  const hasSports = ((onboardSports as unknown[]) ?? []).length > 0
  const hasSeasons = ((onboardSeasons as unknown[]) ?? []).length > 0
  const hasTeams = ((onboardTeams as unknown[]) ?? []).length > 0

  // Show onboarding when there are zero sports on first load.
  // Once shown, keep it visible until the user completes or skips (avoids mid-flow disappearance).
  // Wait until sports query has loaded to avoid flashing onboarding for orgs that have data.
  const [onboardingStarted, setOnboardingStarted] = useState(false)
  useEffect(() => {
    if (sportsLoaded && !hasSports && !onboardingDismissed) setOnboardingStarted(true)
  }, [sportsLoaded, hasSports, onboardingDismissed])
  const showOnboarding = onboardingStarted && !onboardingDismissed

  // Progressive visibility: only allow schedule/stats if prerequisites are met
  const canShowSchedule = onboardingDismissed || hasTeams
  const canShowStats = onboardingDismissed || hasTeams

  // Helper to navigate from other components (e.g. dashboard "View all" → schedule tab)
  const handleTabChange = useCallback((tab: string) => {
    // Map old tab names to new structure
    if (tab === 'sports' || tab === 'teams' || tab === 'roster') {
      setActiveTab('manage')
      setManageSection(tab as ManageSection)
    } else if (tab === 'tournaments') {
      setActiveTab('schedule')
      setScheduleSection('tournaments')
    } else if (tab === 'schedule') {
      setActiveTab('schedule')
      setScheduleSection('games')
    } else {
      setActiveTab(tab as AthleticsTab)
    }
  }, [])

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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-stone-200 border-t-primary-500 animate-spin" />
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
        <MotionConfig reducedMotion="user">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Athletics</h1>
              <p className="text-sm text-stone-500">
                {enabledCampuses.find((c) => c.id === activeCampusId)?.name || 'Manage sports teams, schedules, and rosters'}
              </p>
            </div>
            {!showOnboarding && canWrite && (
              <AthleticsAddMenu onTabChange={handleTabChange} onImportAll={() => setMegaImportOpen(true)} />
            )}
          </div>

          {/* Onboarding flow OR full tabbed UI */}
          {showOnboarding ? (
            <AthleticsOnboarding
              activeCampusId={activeCampusId}
              canWrite={canWrite}
              onComplete={() => setOnboardingDismissed(true)}
            />
          ) : (
            <>
              {/* Loading skeleton while campuses/modules load */}
              {dataLoading ? (
                <AthleticsTableSkeleton columns={5} rows={5} />
              ) : (
                <>
                  {/* Overview */}
                  <div role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview" className={activeTab === 'overview' ? '' : 'hidden'} aria-hidden={activeTab !== 'overview'}>
                    <AthleticsDashboard activeCampusId={activeCampusId} canWrite={canWrite} onTabChange={handleTabChange} />
                  </div>

                  {/* Manage — Sports / Teams / Roster */}
                  <div role="tabpanel" id="tabpanel-manage" aria-labelledby="tab-manage" className={activeTab === 'manage' ? '' : 'hidden'} aria-hidden={activeTab !== 'manage'}>
                    <div className="flex gap-1 mb-5">
                      {([
                        { key: 'sports' as ManageSection, label: 'Sports' },
                        { key: 'teams' as ManageSection, label: 'Teams' },
                        { key: 'roster' as ManageSection, label: 'Roster' },
                      ]).map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setManageSection(s.key)}
                          className={`px-5 py-2.5 text-sm font-semibold rounded-full transition cursor-pointer ${
                            manageSection === s.key
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className={manageSection === 'sports' ? '' : 'hidden'}>
                      <SportsSection canWrite={canWrite} />
                    </div>
                    <div className={manageSection === 'teams' ? '' : 'hidden'}>
                      <TeamsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    </div>
                    <div className={manageSection === 'roster' ? '' : 'hidden'}>
                      <RosterSection activeCampusId={activeCampusId} canWrite={canWrite} canManageUsers={canManageUsers} />
                    </div>
                  </div>

                  {/* Schedule — Games & Practices / Tournaments */}
                  <div role="tabpanel" id="tabpanel-schedule" aria-labelledby="tab-schedule" className={activeTab === 'schedule' && canShowSchedule ? '' : 'hidden'} aria-hidden={activeTab !== 'schedule'}>
                    <div className="flex gap-1 mb-5">
                      {([
                        { key: 'games' as ScheduleSection, label: 'Games & Practices' },
                        { key: 'tournaments' as ScheduleSection, label: 'Tournaments' },
                      ]).map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setScheduleSection(s.key)}
                          className={`px-5 py-2.5 text-sm font-semibold rounded-full transition cursor-pointer ${
                            scheduleSection === s.key
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className={scheduleSection === 'games' ? '' : 'hidden'}>
                      <ScheduleSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    </div>
                    <div className={scheduleSection === 'tournaments' ? '' : 'hidden'}>
                      <TournamentsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div role="tabpanel" id="tabpanel-stats" aria-labelledby="tab-stats" className={activeTab === 'stats' && canShowStats ? '' : 'hidden'} aria-hidden={activeTab !== 'stats'}>
                    <StatsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </MotionConfig>
      </ModuleGate>

      {/* Mega import drawer */}
      <AthleticsMegaImport isOpen={megaImportOpen} onClose={() => setMegaImportOpen(false)} />
    </DashboardLayout>
  )
}
