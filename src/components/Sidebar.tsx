'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ConfirmDialog from '@/components/ConfirmDialog'
import ReportBugDialog from '@/components/ReportBugDialog'
import ViewAsDialog from '@/components/ViewAsDialog'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { useModuleEnabled, useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { usePendingGateCount } from '@/lib/hooks/useEventProject'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'

import SidebarLayout from './sidebar/SidebarLayout'
import MainNavContent from './sidebar/MainNavContent'
import SettingsPanel from './sidebar/SettingsPanel'
import EventsPanel from './sidebar/EventsPanel'
import CalendarPanel from './sidebar/CalendarPanel'
import AthleticsPanel from './sidebar/AthleticsPanel'
import { DEFAULT_CAMPUS_COLORS } from './sidebar/constants'

// ── Re-export types for import path preservation ──
// Files importing `type { AthleticsTab } from '@/components/Sidebar'` continue to work.
export type { SidebarProps, CalendarSidebarData, SettingsTab, AthleticsTab, MaintenanceTab, EventProjectSummary } from './sidebar/types'
import type { SidebarProps, CalendarSidebarData, SettingsTab, AthleticsCampus, EventProjectSummary } from './sidebar/types'

export default function Sidebar({
  userName = 'User',
  userEmail = 'user@school.edu',
  userAvatar,
  organizationName,
  organizationLogoUrl,
  onLogout,
  onSearchOpen,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const pageSearchParams = useSearchParams()
  const queryClient = useQueryClient()

  // ── UI state ──
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith('/settings'))
  const [eventsOpen, setEventsOpen] = useState(() =>
    pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')
  )
  const [athleticsOpen, setAthleticsOpen] = useState(() => pathname.startsWith('/athletics'))
  const [calendarOpen, setCalendarOpen] = useState(() => pathname.startsWith('/calendar'))
  const [bugDialogOpen, setBugDialogOpen] = useState(false)
  const [isViewAsOpen, setIsViewAsOpen] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  // ── Settings tab state ──
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined' || !pathname.startsWith('/settings')) return 'profile'
    const params = new URLSearchParams(window.location.search)
    return (params.get('tab') as SettingsTab) || 'profile'
  })

  // ── Support section state ──
  const isMaintenancePath = (p: string, params?: URLSearchParams) =>
    p.startsWith('/maintenance') || (p === '/inventory' && params?.get('dept') === 'maintenance')
  const isITPath = (p: string, params?: URLSearchParams) =>
    p.startsWith('/it') || (p === '/inventory' && params?.get('dept') === 'it')
  const isAVPath = (p: string, params?: URLSearchParams) =>
    p.startsWith('/av') || (p === '/inventory' && !params?.get('dept'))

  const [facilitiesOpen, setFacilitiesOpen] = useState(() => isMaintenancePath(pathname, pageSearchParams))
  const [itOpen, setItOpen] = useState(() => isITPath(pathname, pageSearchParams))
  const [avOpen, setAvOpen] = useState(() => isAVPath(pathname, pageSearchParams))

  // ── Athletics state ──
  const [athleticsCampusId, setAthleticsCampusId] = useState<string | null>(null)
  const [athleticsCampuses, setAthleticsCampuses] = useState<AthleticsCampus[]>([])
  const [athleticsActiveTab, setAthleticsActiveTab] = useState<string>('overview')
  const { data: sidebarModules = [] } = useModules()
  const { data: sidebarCampusesRaw } = useQuery({
    ...queryOptions.campuses(),
    enabled: athleticsOpen,
  })

  // ── Calendar state ──
  const [calendarData, setCalendarData] = useState<CalendarSidebarData[]>([])
  const [calendarDataReceived, setCalendarDataReceived] = useState(false)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [athleticsVisibleCampusIds, setAthleticsVisibleCampusIds] = useState<Set<string>>(new Set())
  const [meetWithPeople, setMeetWithPeople] = useState<MeetWithPerson[]>([])
  const [deleteCalendar, setDeleteCalendar] = useState<CalendarSidebarData | null>(null)

  // ── Detect super-admin + impersonation ──
  useEffect(() => {
    const role = (localStorage.getItem('user-role') || '').toLowerCase().replace(/\s+/g, '-')
    setIsSuperAdmin(role === 'super-admin')
    setIsImpersonating(localStorage.getItem('is-impersonating') === 'true')
  }, [pathname])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ── Athletics campuses from query ──
  useEffect(() => {
    if (!athleticsOpen) return
    const enabledIds = sidebarModules
      .filter((m) => m.moduleId === 'athletics' && m.campusId)
      .map((m) => m.campusId as string)
    const allCampuses = (sidebarCampusesRaw as { id: string; name: string; isActive: boolean }[] | undefined) ?? []
    const enabled = allCampuses.filter((c) => enabledIds.includes(c.id))
    if (enabled.length > 0) {
      setAthleticsCampuses((prev) => {
        const prevIds = prev.map((c) => c.id).join(',')
        const nextIds = enabled.map((c) => c.id).join(',')
        if (prevIds === nextIds) return prev
        return enabled.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: DEFAULT_CAMPUS_COLORS[i % DEFAULT_CAMPUS_COLORS.length],
        }))
      })
      if (!athleticsCampusId) setAthleticsCampusId(enabled[0].id)
    }
  }, [athleticsOpen, sidebarModules, sidebarCampusesRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Route-based panel auto-expansion ──
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/settings')) { setSettingsOpen(true); setAthleticsOpen(false); setEventsOpen(false) }
  }, [pathname])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')) {
      setEventsOpen(true); setSettingsOpen(false); setAthleticsOpen(false)
    }
  }, [pathname])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/calendar')) { setCalendarOpen(true); setSettingsOpen(false); setAthleticsOpen(false) }
    else setCalendarOpen(false)
  }, [pathname])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/athletics')) { setAthleticsOpen(true); setSettingsOpen(false); setCalendarOpen(false); setEventsOpen(false) }
    else setAthleticsOpen(false)
  }, [pathname])

  useIsomorphicLayoutEffect(() => {
    if (isMaintenancePath(pathname, pageSearchParams)) { setFacilitiesOpen(true); setItOpen(false); setAvOpen(false) }
  }, [pathname, pageSearchParams])

  useIsomorphicLayoutEffect(() => {
    if (isITPath(pathname, pageSearchParams)) { setItOpen(true); setFacilitiesOpen(false); setAvOpen(false) }
  }, [pathname, pageSearchParams])

  useIsomorphicLayoutEffect(() => {
    if (isAVPath(pathname, pageSearchParams)) { setAvOpen(true); setFacilitiesOpen(false); setItOpen(false) }
  }, [pathname, pageSearchParams])

  // ── Settings tab sync ──
  useEffect(() => {
    const handleTabEvent = (e: Event) => {
      const event = e as CustomEvent<{ tab: SettingsTab }>
      if (event.detail?.tab) setActiveSettingsTab(event.detail.tab)
    }
    window.addEventListener('settings-tab-request', handleTabEvent)
    window.addEventListener('settings-tab-change', handleTabEvent)
    return () => {
      window.removeEventListener('settings-tab-request', handleTabEvent)
      window.removeEventListener('settings-tab-change', handleTabEvent)
    }
  }, [])

  // ── Calendar event listeners ──
  useEffect(() => {
    const handleCalendarData = (e: Event) => {
      const event = e as CustomEvent<{ calendars: CalendarSidebarData[]; visibleIds: string[] }>
      if (event.detail?.calendars) {
        setCalendarData(event.detail.calendars)
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
        setCalendarDataReceived(true)
      }
    }
    const handleVisibilityChange = (e: Event) => {
      const event = e as CustomEvent<{ visibleIds: string[] }>
      if (event.detail?.visibleIds) setVisibleCalendarIds(new Set(event.detail.visibleIds))
    }
    window.addEventListener('calendar-sidebar-data', handleCalendarData)
    window.addEventListener('calendar-visibility-change', handleVisibilityChange)
    return () => {
      window.removeEventListener('calendar-sidebar-data', handleCalendarData)
      window.removeEventListener('calendar-visibility-change', handleVisibilityChange)
    }
  }, [])

  // ── Athletics event listeners ──
  useEffect(() => {
    const handleAthleticsData = (e: Event) => {
      const event = e as CustomEvent<{ campuses: AthleticsCampus[]; activeCampusId: string | null }>
      if (event.detail) {
        setAthleticsCampuses(event.detail.campuses)
        if (event.detail.activeCampusId) setAthleticsCampusId(event.detail.activeCampusId)
      }
    }
    window.addEventListener('athletics-sidebar-data', handleAthleticsData)
    window.dispatchEvent(new CustomEvent('athletics-sidebar-request'))
    return () => { window.removeEventListener('athletics-sidebar-data', handleAthleticsData) }
  }, [])

  // ── Permissions (optimistic + real) ──
  const { data: perms } = usePermissions()

  const optimisticRole = (() => {
    if (typeof window === 'undefined') return ''
    return (localStorage.getItem('user-role') || '').toLowerCase()
  })()
  const optimisticIsAdmin = optimisticRole.includes('admin') || optimisticRole.includes('super')
  const optimisticTeamSlugs = (() => {
    if (typeof window === 'undefined') return [] as string[]
    try { return JSON.parse(localStorage.getItem('user-team-slugs') || '[]') as string[] }
    catch { return [] as string[] }
  })()

  useEffect(() => {
    if (perms?.userTeams) {
      const slugs = perms.userTeams.map((t) => t.slug)
      localStorage.setItem('user-team-slugs', JSON.stringify(slugs))
    }
  }, [perms?.userTeams])

  const canManageWorkspace = perms?.canManageWorkspace ?? optimisticIsAdmin
  const canManageMaintenance = perms?.canManageMaintenance ?? optimisticIsAdmin
  const canClaimMaintenance = perms?.canClaimMaintenance ?? optimisticIsAdmin
  const canSubmitMaintenance = perms?.canSubmitMaintenance ?? true
  const canManageIT = perms?.canManageIT ?? optimisticIsAdmin
  const canSubmitIT = perms?.canSubmitIT ?? true
  const canReadDevices = perms?.canReadDevices ?? optimisticIsAdmin
  const canReadStudents = perms?.canReadStudents ?? optimisticIsAdmin
  const canAccessLoaners = (perms?.canManageLoaners ?? false) || (perms?.canCheckoutLoaner ?? false) || (perms?.canCheckinLoaner ?? false)
  const canAccessDeployment = (perms?.canManageDeployment ?? false) || (perms?.canProcessDeployment ?? false)
  const canAccessProvisioning = (perms?.canManageProvisioning ?? false) || (perms?.canViewProvisioning ?? false)
  const canViewContentFilters = (perms?.canViewCIPAAudit ?? false) || (perms?.canConfigureFilters ?? false) || (perms?.canManageFilters ?? false)
  const canViewSecurityIncidents = perms?.canViewSecurityIncidents ?? false
  const canViewIntelligence = perms?.canViewIntelligence ?? false
  const canViewITAnalytics = perms?.canViewITAnalytics ?? false
  const canViewITBoardReports = perms?.canViewITBoardReports ?? false
  const canViewERate = (perms?.canManageERate ?? false) || (perms?.canViewERate ?? false)
  const canManageSync = perms?.canManageSync ?? false
  const canSeeITDevices = canReadDevices || canReadStudents || canAccessLoaners
  const canSeeITLifecycle = canAccessDeployment || canAccessProvisioning || canManageIT
  const canSeeITSecurity = canViewContentFilters || canViewSecurityIncidents || canViewIntelligence
  const canSeeITAdmin = canViewITAnalytics || canViewITBoardReports || canViewERate || canManageSync
  const canReadInventory = perms?.canReadInventory ?? optimisticIsAdmin

  const isOnMaintenanceTeam = perms ? isOnTeam(perms, 'maintenance') : optimisticTeamSlugs.includes('maintenance')
  const isOnITTeam = perms ? isOnTeam(perms, 'it-support') : optimisticTeamSlugs.includes('it-support')
  const isOnAVTeam = perms ? isOnTeam(perms, 'av-production') : optimisticTeamSlugs.includes('av-production')

  const canApproveFacilitiesGate = isOnMaintenanceTeam || canManageMaintenance
  const canApproveAVGate = isOnAVTeam || canManageWorkspace
  const { data: facilitiesGateCount } = usePendingGateCount('facilities', canApproveFacilitiesGate)
  const { data: avGateCount } = usePendingGateCount('av', canApproveAVGate)

  const { enabled: athleticsEnabled, loading: athleticsModuleLoading } = useModuleEnabled('athletics')

  // ── Calendar handlers ──
  const toggleCalendarVisibility = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      window.dispatchEvent(new CustomEvent('calendar-toggle', { detail: { calendarId } }))
      return next
    })
  }, [])

  const athleticsEnabledCampusIds = useMemo(() => {
    return new Set(
      sidebarModules
        .filter((m: any) => m.moduleId === 'athletics' && m.campusId)
        .map((m: any) => m.campusId as string)
    )
  }, [sidebarModules])

  const toggleAthleticsCalendar = useCallback((campusId: string) => {
    setAthleticsVisibleCampusIds((prev) => {
      const next = new Set(prev)
      if (next.has(campusId)) next.delete(campusId)
      else next.add(campusId)
      window.dispatchEvent(new CustomEvent('athletics-calendar-toggle', { detail: { campusId, visible: !prev.has(campusId) } }))
      return next
    })
  }, [])

  const handleMeetWithAdd = useCallback((person: MeetWithPerson) => {
    setMeetWithPeople((prev) => {
      if (prev.length >= 5 || prev.some((p) => p.id === person.id)) return prev
      const next = [...prev, person]
      window.dispatchEvent(new CustomEvent('meet-with-change', { detail: { people: next } }))
      return next
    })
  }, [])

  const handleMeetWithRemove = useCallback((personId: string) => {
    setMeetWithPeople((prev) => {
      const next = prev.filter((p) => p.id !== personId)
      window.dispatchEvent(new CustomEvent('meet-with-change', { detail: { people: next } }))
      return next
    })
  }, [])

  // ── Navigation handlers ──
  const handleEventsClick = useCallback(() => {
    if (!eventsOpen) {
      setEventsOpen(true); setSettingsOpen(false); setAthleticsOpen(false); setCalendarOpen(false)
      router.push('/events')
    } else {
      setEventsOpen(false)
    }
  }, [eventsOpen, router])

  const handleAthleticsClick = useCallback(() => {
    if (!athleticsOpen) {
      setAthleticsOpen(true); setSettingsOpen(false); setCalendarOpen(false); setEventsOpen(false)
      router.push('/athletics')
    } else {
      setAthleticsOpen(false)
    }
  }, [athleticsOpen, router])

  const handleSettingsClick = useCallback(() => {
    if (!settingsOpen) {
      setSettingsOpen(true); setCalendarOpen(false); setAthleticsOpen(false); setEventsOpen(false)
      router.push('/settings')
    } else {
      setSettingsOpen(false)
    }
  }, [settingsOpen, router])

  const handleSettingsTabClick = useCallback((tab: SettingsTab) => {
    setActiveSettingsTab(tab)
    window.dispatchEvent(new CustomEvent('settings-tab-change', { detail: { tab } }))
  }, [])

  const handleAthleticsCampusClick = useCallback((campusId: string) => {
    setAthleticsCampusId(campusId)
    window.dispatchEvent(new CustomEvent('athletics-campus-change', { detail: { campusId } }))
  }, [])

  const handleAthleticsTabClick = useCallback((tab: string) => {
    setAthleticsActiveTab(tab)
    window.dispatchEvent(new CustomEvent('athletics-tab-change', { detail: { tab } }))
  }, [])

  const handleCreateCalendar = useCallback(() => {
    window.dispatchEvent(new CustomEvent('calendar-create-request'))
  }, [])

  const handleCalendarRename = useCallback((calendarId: string, name: string) => {
    window.dispatchEvent(new CustomEvent('calendar-update', { detail: { calendarId, data: { name } } }))
  }, [])

  const handleCalendarColorSelect = useCallback((calendarId: string, color: string) => {
    window.dispatchEvent(new CustomEvent('calendar-update', { detail: { calendarId, data: { color } } }))
  }, [])

  const confirmDeleteCalendar = useCallback(() => {
    if (!deleteCalendar) return
    window.dispatchEvent(new CustomEvent('calendar-delete', { detail: { calendarId: deleteCalendar.id } }))
    setDeleteCalendar(null)
  }, [deleteCalendar])

  // ── Determine secondary panel ──
  // Only show the athletics secondary nav when there are 2+ campuses to switch between
  const athleticsSecondaryNeeded = athleticsOpen && athleticsCampuses.length >= 2
  const secondaryOpen = settingsOpen || calendarOpen || athleticsSecondaryNeeded || eventsOpen
  const secondaryLabel = eventsOpen ? 'Events navigation' : athleticsSecondaryNeeded ? 'Athletics navigation' : calendarOpen ? 'Calendar navigation' : 'Settings navigation'

  const secondaryContent = eventsOpen ? (
    <EventsPanel pathname={pathname} setIsOpen={setIsOpen} />
  ) : athleticsSecondaryNeeded ? (
    <AthleticsPanel
      athleticsCampuses={athleticsCampuses}
      athleticsCampusId={athleticsCampusId}
      activeTab={athleticsActiveTab}
      onCampusClick={handleAthleticsCampusClick}
      onTabClick={handleAthleticsTabClick}
    />
  ) : calendarOpen ? (
    <CalendarPanel
      calendarData={calendarData}
      calendarDataReceived={calendarDataReceived}
      visibleCalendarIds={visibleCalendarIds}
      athleticsVisibleCampusIds={athleticsVisibleCampusIds}
      athleticsEnabledCampusIds={athleticsEnabledCampusIds}
      canManageWorkspace={canManageWorkspace}
      meetWithPeople={meetWithPeople}
      onToggleVisibility={toggleCalendarVisibility}
      onToggleAthleticsCalendar={toggleAthleticsCalendar}
      onCreateCalendar={handleCreateCalendar}
      onRenameSubmit={handleCalendarRename}
      onColorSelect={handleCalendarColorSelect}
      onDeleteCalendar={setDeleteCalendar}
      onMeetWithAdd={handleMeetWithAdd}
      onMeetWithRemove={handleMeetWithRemove}
    />
  ) : (
    <SettingsPanel
      activeSettingsTab={activeSettingsTab}
      canManageWorkspace={canManageWorkspace}
      onTabClick={handleSettingsTabClick}
    />
  )

  const mainNavContent = (
    <MainNavContent
      pathname={pathname}
      pageSearchParams={pageSearchParams}
      organizationName={organizationName}
      organizationLogoUrl={organizationLogoUrl}
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      isSuperAdmin={isSuperAdmin}
      isImpersonating={isImpersonating}
      onSearchOpen={onSearchOpen}
      onLogout={onLogout}
      onBugDialogOpen={() => setBugDialogOpen(true)}
      onViewAsOpen={() => setIsViewAsOpen(true)}
      onSettingsClick={handleSettingsClick}
      onEventsClick={handleEventsClick}
      onAthleticsClick={handleAthleticsClick}
      setIsOpen={setIsOpen}
      setSettingsOpen={setSettingsOpen}
      setAthleticsOpen={setAthleticsOpen}
      setEventsOpen={setEventsOpen}
      settingsOpen={settingsOpen}
      athleticsOpen={athleticsOpen}
      eventsOpen={eventsOpen}
      athleticsEnabled={athleticsEnabled}
      athleticsModuleLoading={athleticsModuleLoading}
      canWriteAthletics={perms?.canWriteAthletics ?? false}
      facilitiesOpen={facilitiesOpen}
      setFacilitiesOpen={setFacilitiesOpen}
      isOnMaintenanceTeam={isOnMaintenanceTeam}
      canManageMaintenance={canManageMaintenance}
      canClaimMaintenance={canClaimMaintenance}
      canSubmitMaintenance={canSubmitMaintenance}
      canReadInventory={canReadInventory}
      facilitiesGateCount={facilitiesGateCount}
      itOpen={itOpen}
      setItOpen={setItOpen}
      isOnITTeam={isOnITTeam}
      canManageIT={canManageIT}
      canSubmitIT={canSubmitIT}
      canSeeITDevices={canSeeITDevices}
      canSeeITLifecycle={canSeeITLifecycle}
      canSeeITSecurity={canSeeITSecurity}
      canSeeITAdmin={canSeeITAdmin}
      avOpen={avOpen}
      setAvOpen={setAvOpen}
      isOnAVTeam={isOnAVTeam}
      canManageWorkspace={canManageWorkspace}
      avGateCount={avGateCount}
    />
  )

  return (
    <>
      <SidebarLayout
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        secondaryOpen={secondaryOpen}
        secondaryLabel={secondaryLabel}
        mainNavContent={mainNavContent}
        secondaryContent={secondaryContent}
      />

      {/* Calendar delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteCalendar}
        onClose={() => setDeleteCalendar(null)}
        onConfirm={confirmDeleteCalendar}
        title="Delete Calendar"
        message={`Delete "${deleteCalendar?.name}"? All events in this calendar will be permanently removed.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Bug report dialog */}
      <ReportBugDialog isOpen={bugDialogOpen} onClose={() => setBugDialogOpen(false)} />

      {/* View As dialog */}
      <ViewAsDialog isOpen={isViewAsOpen} onClose={() => setIsViewAsOpen(false)} />
    </>
  )
}
