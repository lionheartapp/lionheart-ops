'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fadeInUp, staggerContainer } from '@/lib/animations'

import ModuleGate from '@/components/ModuleGate'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { queryOptions as sharedQueryOptions } from '@/lib/queries'
import { Dribbble, Users, CalendarDays, ClipboardList, Trophy } from 'lucide-react'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import AthleticsAddMenu from '@/components/athletics/AthleticsAddMenu'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'
import PagePadding from '@/components/PagePadding'
import type { AthleticsTab } from '@/components/Sidebar'

const AthleticsDashboard = dynamic(() => import('@/components/athletics/AthleticsDashboard'), {
  loading: () => <AthleticsTableSkeleton columns={4} rows={4} />,
})
const SportsSection = dynamic(() => import('@/components/athletics/SportsSection'), {
  loading: () => <AthleticsTableSkeleton columns={4} rows={5} />,
})
const TeamsSection = dynamic(() => import('@/components/athletics/TeamsSection'), {
  loading: () => <AthleticsTableSkeleton columns={5} rows={5} />,
})
const ScheduleSection = dynamic(() => import('@/components/athletics/ScheduleSection'), {
  loading: () => <AthleticsTableSkeleton columns={5} rows={5} />,
})
const TournamentsSection = dynamic(() => import('@/components/athletics/TournamentsSection'), {
  loading: () => <AthleticsTableSkeleton columns={5} rows={5} />,
})
const RosterSection = dynamic(() => import('@/components/athletics/RosterSection'), {
  loading: () => <AthleticsTableSkeleton columns={5} rows={5} />,
})
const StatsSection = dynamic(() => import('@/components/athletics/StatsSection'), {
  loading: () => <AthleticsTableSkeleton columns={5} rows={5} />,
})
const AthleticsOnboarding = dynamic(() => import('@/components/athletics/AthleticsOnboarding'), {
  loading: () => <AthleticsTableSkeleton columns={4} rows={4} />,
})
const AthleticsMegaImport = dynamic(() => import('@/components/athletics/AthleticsMegaImport'), {
  loading: () => null,
})
const LeaguesSection = dynamic(() => import('@/components/conferences/LeaguesSection'), {
  loading: () => <AthleticsTableSkeleton columns={4} rows={5} />,
})

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

  // Hydration guard + auth redirect
  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: perms } = usePermissions()
  const canWrite = perms?.canWriteAthletics ?? false
  const canManageUsers = perms?.canManageUsers ?? false
  const { data: rawCampuses, isLoading: campusesLoading } = useQuery(sharedQueryOptions.campuses())
  const campuses = (rawCampuses as Campus[] | undefined) ?? []
  const { data: rawCalendars } = useQuery(sharedQueryOptions.calendars())

  const dataLoading = modulesLoading || campusesLoading

  // Build campus → color map from master calendars (first calendar per campus wins)
  const campusColorMap = useMemo(() => {
    const calendars = (rawCalendars as CalendarBrief[] | undefined) ?? []
    const map = new Map<string, string>()
    for (const cal of calendars) {
      if (cal.campus?.id && !map.has(cal.campus.id)) {
        map.set(cal.campus.id, cal.color)
      }
    }
    return map
  }, [rawCalendars])

  const enabledCampusIds = modules
    .filter((m) => m.moduleId === 'athletics' && m.campusId)
    .map((m) => m.campusId as string)

  const enabledCampuses = campuses.filter((c) => enabledCampusIds.includes(c.id))

  // Viewpoint is owned by the global useActiveSchool hook — the sidebar's
  // SchoolSelector is the canonical picker. `null` means "All Schools"
  // (org-wide view); a concrete id scopes the athletics page to one school
  // and triggers the dual-school opponent-side flip in ScheduleSection.
  //
  // The legacy `athletics-campus-change` sidebar event (still fired by the
  // athletics-specific campus pills) is bridged below into this hook so both
  // UIs stay in sync without a second source of truth.
  const { activeSchoolId, setActiveSchoolId } = useActiveSchool()
  const activeCampusId = activeSchoolId

  const [activeTab, setActiveTab] = useState<AthleticsTab>('overview')
  const [manageSection, setManageSection] = useState<ManageSection>('sports')
  const [scheduleSection, setScheduleSection] = useState<ScheduleSection>('games')
  const [urlStateLoaded, setUrlStateLoaded] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)
  const [megaImportOpen, setMegaImportOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as AthleticsTab | null
    const manage = params.get('manage') as ManageSection | null
    const schedule = params.get('section') as ScheduleSection | null
    const validTabs: AthleticsTab[] = ['overview', 'manage', 'schedule', 'stats', 'leagues']
    const validManage: ManageSection[] = ['sports', 'teams', 'roster']
    const validSchedule: ScheduleSection[] = ['games', 'tournaments']

    if (tab && validTabs.includes(tab)) setActiveTab(tab)
    if (manage && validManage.includes(manage)) setManageSection(manage)
    if (schedule && validSchedule.includes(schedule)) setScheduleSection(schedule)
    setUrlStateLoaded(true)
  }, [])

  useEffect(() => {
    if (!urlStateLoaded || typeof window === 'undefined') return
    const url = new URL(window.location.href)

    if (activeTab === 'overview') {
      url.searchParams.delete('tab')
      url.searchParams.delete('manage')
      url.searchParams.delete('section')
    } else {
      url.searchParams.set('tab', activeTab)
      if (activeTab === 'manage') {
        url.searchParams.set('manage', manageSection)
        url.searchParams.delete('section')
      } else if (activeTab === 'schedule') {
        url.searchParams.set('section', scheduleSection)
        url.searchParams.delete('manage')
      } else {
        url.searchParams.delete('manage')
        url.searchParams.delete('section')
      }
    }

    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [activeTab, manageSection, scheduleSection, urlStateLoaded])

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('athletics-tab-change', {
        detail: { tab: activeTab },
      })
    )
  }, [activeTab])

  // Listen for sidebar tab navigation.
  // The current tab is mirrored into the URL so refresh returns to the same work surface.
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab
      if (tab) {
        setActiveTab(tab as AthleticsTab)
      }
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
    let resolvedTab: AthleticsTab = 'overview'
    if (tab === 'sports' || tab === 'teams' || tab === 'roster') {
      resolvedTab = 'manage'
      setManageSection(tab as ManageSection)
    } else if (tab === 'tournaments') {
      resolvedTab = 'schedule'
      setScheduleSection('tournaments')
    } else if (tab === 'schedule') {
      resolvedTab = 'schedule'
      setScheduleSection('games')
    } else {
      resolvedTab = tab as AthleticsTab
    }
    setActiveTab(resolvedTab)
  }, [])

  // Track whether we've dispatched sidebar data so we re-dispatch when data changes
  const lastDispatchRef = useRef<string>('')

  // Default color fallback for campuses without a master calendar
  const DEFAULT_CAMPUS_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6']

  // Dispatch sidebar data whenever campuses/modules load or change
  const dispatchSidebarData = useCallback(() => {
    const colorKeys = enabledCampuses.map((c) => campusColorMap.get(c.id) ?? '').join(',')
    const key = enabledCampuses.map((c) => c.id).join(',') + '|' + colorKeys + '|' + activeCampusId + '|' + hasSports
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
          hasSports,
        },
      })
    )
  }, [enabledCampuses, activeCampusId, campusColorMap, hasSports]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    dispatchSidebarData()
  }, [dispatchSidebarData])

  // Bridge legacy athletics-specific sidebar pills into the global viewpoint.
  // The pills dispatch `athletics-campus-change`; we forward that through
  // `setActiveSchoolId` so the global SchoolSelector, Dashboard, IT, etc. all
  // see the same selection. One source of truth — the hook.
  useEffect(() => {
    const handleCampusChange = (e: Event) => {
      const event = e as CustomEvent<{ campusId: string }>
      if (event.detail?.campusId) setActiveSchoolId(event.detail.campusId)
    }
    window.addEventListener('athletics-campus-change', handleCampusChange)
    return () => {
      window.removeEventListener('athletics-campus-change', handleCampusChange)
    }
  }, [setActiveSchoolId])

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

  return (
    <PagePadding className="px-6 sm:px-10">
    <>
      <ModuleGate moduleId="athletics">
        <MotionConfig reducedMotion="user">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5">
          {/* Section header — shows active tab name */}
          <div className="hidden lg:flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {{ overview: 'Today', manage: 'Teams & Rosters', schedule: 'Schedule', stats: 'Results', leagues: 'Leagues' }[activeTab] ?? 'Athletics'}
              </h1>
              <p className="text-sm text-stone-500">
                {{ overview: enabledCampuses.find((c) => c.id === activeCampusId)?.name || 'What needs attention across games, practices, and teams',
                   manage: 'Sports, teams, rosters, and season setup',
                   schedule: 'Games, practices, tournaments, and game-day timing',
                   stats: 'Standings, leaders, scores, and reports',
                   leagues: 'Athletic conferences and cross-school schedules',
                }[activeTab] ?? 'Manage sports teams, schedules, and rosters'}
              </p>
            </div>
            {!showOnboarding && canWrite && activeTab !== 'leagues' && (
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
                    {activeTab === 'overview' && (
                      <AthleticsDashboard activeCampusId={activeCampusId} canWrite={canWrite} onTabChange={handleTabChange} />
                    )}
                  </div>

                  {/* Manage — Sports / Teams / Roster */}
                  <div role="tabpanel" id="tabpanel-manage" aria-labelledby="tab-manage" className={activeTab === 'manage' ? '' : 'hidden'} aria-hidden={activeTab !== 'manage'}>
                    <div className="hidden lg:inline-flex gap-1 rounded-full bg-slate-100 p-1 mb-5">
                      {([
                        { key: 'sports' as ManageSection, label: 'Sports' },
                        { key: 'teams' as ManageSection, label: 'Teams' },
                        { key: 'roster' as ManageSection, label: 'Roster' },
                      ]).map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setManageSection(s.key)}
                          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                            manageSection === s.key
                              ? 'text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {manageSection === s.key && (
                            <motion.div
                              layoutId="athleticsManagePill"
                              className="absolute inset-0 rounded-full bg-slate-900"
                              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                            />
                          )}
                          <span className="relative z-10">{s.label}</span>
                        </button>
                      ))}
                    </div>
                    {activeTab === 'manage' && manageSection === 'sports' && (
                      <SportsSection canWrite={canWrite} />
                    )}
                    {activeTab === 'manage' && manageSection === 'teams' && (
                      <TeamsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    )}
                    {activeTab === 'manage' && manageSection === 'roster' && (
                      <RosterSection activeCampusId={activeCampusId} canWrite={canWrite} canManageUsers={canManageUsers} />
                    )}
                  </div>

                  {/* Schedule — Games & Practices / Tournaments */}
                  <div role="tabpanel" id="tabpanel-schedule" aria-labelledby="tab-schedule" className={activeTab === 'schedule' && canShowSchedule ? '' : 'hidden'} aria-hidden={activeTab !== 'schedule'}>
                    <div className="hidden lg:inline-flex gap-1 rounded-full bg-slate-100 p-1 mb-5">
                      {([
                        { key: 'games' as ScheduleSection, label: 'Games', desktopLabel: 'Games & Practices' },
                        { key: 'tournaments' as ScheduleSection, label: 'Tournaments', desktopLabel: 'Tournaments' },
                      ]).map((s) => (
                        <button
                          key={s.key}
                          onClick={() => setScheduleSection(s.key)}
                          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                            scheduleSection === s.key
                              ? 'text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {scheduleSection === s.key && (
                            <motion.div
                              layoutId="athleticsSchedulePill"
                              className="absolute inset-0 rounded-full bg-slate-900"
                              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                            />
                          )}
                          <span className="relative z-10 sm:hidden">{s.label}</span>
                          <span className="relative z-10 hidden sm:inline">{s.desktopLabel}</span>
                        </button>
                      ))}
                    </div>
                    {activeTab === 'schedule' && scheduleSection === 'games' && (
                      <ScheduleSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    )}
                    {activeTab === 'schedule' && scheduleSection === 'tournaments' && (
                      <TournamentsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    )}
                  </div>

                  {/* Stats */}
                  <div role="tabpanel" id="tabpanel-stats" aria-labelledby="tab-stats" className={activeTab === 'stats' && canShowStats ? '' : 'hidden'} aria-hidden={activeTab !== 'stats'}>
                    {activeTab === 'stats' && canShowStats && (
                      <StatsSection activeCampusId={activeCampusId} canWrite={canWrite} />
                    )}
                  </div>

                  {/* Leagues */}
                  <div role="tabpanel" id="tabpanel-leagues" aria-labelledby="tab-leagues" className={activeTab === 'leagues' ? '' : 'hidden'} aria-hidden={activeTab !== 'leagues'}>
                    {activeTab === 'leagues' && <LeaguesSection />}
                  </div>
                </>
              )}
            </>
          )}
        </div>
        </MotionConfig>
      </ModuleGate>

      {/* Mega import drawer */}
      {megaImportOpen && (
        <AthleticsMegaImport isOpen={megaImportOpen} onClose={() => setMegaImportOpen(false)} />
      )}
    </>
    </PagePadding>
  )
}
