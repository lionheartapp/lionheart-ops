'use client'

/**
 * Audit ref H5: Sidebar orchestrator.
 *
 * This file used to host ~500 LOC of state, effects, and handlers. It has
 * been split into four focused hooks that each own a single concern:
 *
 *   - useSidebarRouteSync: route → panel auto-expansion
 *   - useSidebarEvents: DOM event consumers (calendar/athletics/settings data)
 *   - useSidebarPermissionFlags: merged real + optimistic permission flags
 *   - useSidebarSelectionState: mutable secondary-panel state + handlers
 *
 * Sidebar.tsx is now a thin composition that wires those hooks into the
 * presentational subcomponents in ./sidebar/*.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ConfirmDialog from '@/components/ConfirmDialog'
import ReportBugDialog from '@/components/ReportBugDialog'
import ViewAsDialog from '@/components/ViewAsDialog'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { useModuleEnabled, useModules } from '@/lib/hooks/useModuleEnabled'

import SidebarLayout from './sidebar/SidebarLayout'
import MainNavContent from './sidebar/MainNavContent'
import SettingsPanel from './sidebar/SettingsPanel'
import EventsPanel from './sidebar/EventsPanel'
import CalendarPanel from './sidebar/CalendarPanel'
import AthleticsPanel from './sidebar/AthleticsPanel'
import { DEFAULT_CAMPUS_COLORS } from './sidebar/constants'
import { useSidebarRouteSync } from './sidebar/useSidebarRouteSync'
import { useSidebarEvents } from './sidebar/useSidebarEvents'
import { useSidebarPermissionFlags } from './sidebar/useSidebarPermissionFlags'
import { useSidebarSelectionState } from './sidebar/useSidebarSelectionState'

// ── Re-export types for import path preservation ──
// Files importing `type { AthleticsTab } from '@/components/Sidebar'` continue to work.
export type { SidebarProps, CalendarSidebarData, SettingsTab, AthleticsTab, MaintenanceTab, EventProjectSummary } from './sidebar/types'
import type { SidebarProps, SettingsTab } from './sidebar/types'

export default function Sidebar({
  userName = 'User',
  userEmail = 'user@school.edu',
  userAvatar,
  organizationName,
  organizationLogoUrl,
  onLogout,
  onSearchOpen,
}: SidebarProps): JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const pageSearchParams = useSearchParams()

  // ── UI state ──
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith('/settings'))
  const [eventsOpen, setEventsOpen] = useState(() =>
    pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning'),
  )
  const [athleticsOpen, setAthleticsOpen] = useState(() => pathname.startsWith('/athletics'))
  const [calendarOpen, setCalendarOpen] = useState(() => pathname.startsWith('/calendar'))
  const [bugDialogOpen, setBugDialogOpen] = useState(false)
  const [isViewAsOpen, setIsViewAsOpen] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  // ── Support section state (facility / IT / AV) ──
  type ReadonlyParams = { get(name: string): string | null } | null
  const isMaintenancePath = (p: string, params: ReadonlyParams): boolean =>
    p.startsWith('/maintenance') || (p === '/inventory' && params?.get('dept') === 'maintenance')
  const isITPath = (p: string, params: ReadonlyParams): boolean =>
    p.startsWith('/it') || (p === '/inventory' && params?.get('dept') === 'it')
  const isAVPath = (p: string, params: ReadonlyParams): boolean =>
    p.startsWith('/av') || (p === '/inventory' && !params?.get('dept'))

  const [facilitiesOpen, setFacilitiesOpen] = useState(() => isMaintenancePath(pathname, pageSearchParams))
  const [itOpen, setItOpen] = useState(() => isITPath(pathname, pageSearchParams))
  const [avOpen, setAvOpen] = useState(() => isAVPath(pathname, pageSearchParams))

  // ── Initial settings tab (from query string) ──
  const initialSettingsTab: SettingsTab = (() => {
    if (typeof window === 'undefined' || !pathname.startsWith('/settings')) return 'profile'
    const params = new URLSearchParams(window.location.search)
    return (params.get('tab') as SettingsTab) || 'profile'
  })()

  // ── Extracted hooks ──
  useSidebarRouteSync({
    pathname,
    pageSearchParams,
    setSettingsOpen,
    setEventsOpen,
    setCalendarOpen,
    setAthleticsOpen,
    setFacilitiesOpen,
    setItOpen,
    setAvOpen,
  })

  const selection = useSidebarSelectionState({ initialSettingsTab })
  const perms = useSidebarPermissionFlags()

  useSidebarEvents({
    setActiveSettingsTab: selection.setActiveSettingsTab,
    setCalendarData: selection.setCalendarData,
    setVisibleCalendarIds: selection.setVisibleCalendarIds,
    setCalendarDataReceived: selection.setCalendarDataReceived,
    setAthleticsCampuses: selection.setAthleticsCampuses,
    setAthleticsCampusId: selection.setAthleticsCampusId,
    setAthleticsHasSports: selection.setAthleticsHasSports,
  })

  // ── Module + campus data for athletics ──
  const { data: sidebarModules = [] } = useModules()
  const { data: sidebarCampusesRaw } = useQuery({
    ...queryOptions.campuses(),
    enabled: athleticsOpen,
  })
  const { enabled: athleticsEnabled, loading: athleticsModuleLoading } = useModuleEnabled('athletics')

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Detect super-admin + impersonation from hydrated localStorage
  useEffect(() => {
    const role = (localStorage.getItem('user-role') || '').toLowerCase().replace(/\s+/g, '-')
    setIsSuperAdmin(role === 'super-admin')
    setIsImpersonating(localStorage.getItem('is-impersonating') === 'true')
  }, [pathname])

  // Athletics campuses derived from modules + campus list
  useEffect(() => {
    if (!athleticsOpen) return
    const enabledIds = sidebarModules
      .filter((m) => m.moduleId === 'athletics' && m.campusId)
      .map((m) => m.campusId as string)
    const allCampuses = (sidebarCampusesRaw as { id: string; name: string; isActive: boolean }[] | undefined) ?? []
    const enabled = allCampuses.filter((c) => enabledIds.includes(c.id))
    if (enabled.length > 0) {
      selection.setAthleticsCampuses((prev) => {
        const prevIds = prev.map((c) => c.id).join(',')
        const nextIds = enabled.map((c) => c.id).join(',')
        if (prevIds === nextIds) return prev
        return enabled.map((c, i) => ({
          id: c.id,
          name: c.name,
          color: DEFAULT_CAMPUS_COLORS[i % DEFAULT_CAMPUS_COLORS.length],
        }))
      })
      if (!selection.athleticsCampusId) selection.setAthleticsCampusId(enabled[0].id)
    }
  }, [athleticsOpen, sidebarModules, sidebarCampusesRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  const athleticsEnabledCampusIds = useMemo(() => {
    return new Set(
      sidebarModules
        .filter((m) => m.moduleId === 'athletics' && Boolean(m.campusId))
        .map((m) => m.campusId as string),
    )
  }, [sidebarModules])

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

  // ── Determine secondary panel ──
  const athleticsSecondaryNeeded = athleticsOpen && selection.athleticsHasSports
  const secondaryOpen = settingsOpen || calendarOpen || athleticsSecondaryNeeded || eventsOpen
  const secondaryLabel = eventsOpen
    ? 'Events navigation'
    : athleticsSecondaryNeeded
      ? 'Athletics navigation'
      : calendarOpen
        ? 'Calendar navigation'
        : 'Settings navigation'

  const secondaryContent = eventsOpen ? (
    <EventsPanel pathname={pathname} setIsOpen={setIsOpen} />
  ) : athleticsSecondaryNeeded ? (
    <AthleticsPanel
      athleticsCampuses={selection.athleticsCampuses}
      athleticsCampusId={selection.athleticsCampusId}
      activeTab={selection.athleticsActiveTab}
      onCampusClick={selection.handleAthleticsCampusClick}
      onTabClick={selection.handleAthleticsTabClick}
    />
  ) : calendarOpen ? (
    <CalendarPanel
      calendarData={selection.calendarData}
      calendarDataReceived={selection.calendarDataReceived}
      visibleCalendarIds={selection.visibleCalendarIds}
      athleticsVisibleCampusIds={selection.athleticsVisibleCampusIds}
      athleticsEnabledCampusIds={athleticsEnabledCampusIds}
      canManageWorkspace={perms.canManageWorkspace}
      meetWithPeople={selection.meetWithPeople}
      onToggleVisibility={selection.toggleCalendarVisibility}
      onToggleAthleticsCalendar={selection.toggleAthleticsCalendar}
      onCreateCalendar={selection.handleCreateCalendar}
      onRenameSubmit={selection.handleCalendarRename}
      onColorSelect={selection.handleCalendarColorSelect}
      onDeleteCalendar={selection.setDeleteCalendar}
      onMeetWithAdd={selection.handleMeetWithAdd}
      onMeetWithRemove={selection.handleMeetWithRemove}
    />
  ) : (
    <SettingsPanel
      activeSettingsTab={selection.activeSettingsTab}
      canManageWorkspace={perms.canManageWorkspace}
      onTabClick={selection.handleSettingsTabClick}
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
      canWriteAthletics={perms.canWriteAthletics}
      facilitiesOpen={facilitiesOpen}
      setFacilitiesOpen={setFacilitiesOpen}
      isOnMaintenanceTeam={perms.isOnMaintenanceTeam}
      canManageMaintenance={perms.canManageMaintenance}
      canClaimMaintenance={perms.canClaimMaintenance}
      canSubmitMaintenance={perms.canSubmitMaintenance}
      canReadInventory={perms.canReadInventory}
      facilitiesGateCount={perms.facilitiesGateCount}
      itOpen={itOpen}
      setItOpen={setItOpen}
      isOnITTeam={perms.isOnITTeam}
      canManageIT={perms.canManageIT}
      canSubmitIT={perms.canSubmitIT}
      canSeeITDevices={perms.canSeeITDevices}
      canSeeITLifecycle={perms.canSeeITLifecycle}
      canSeeITSecurity={perms.canSeeITSecurity}
      canSeeITAdmin={perms.canSeeITAdmin}
      avOpen={avOpen}
      setAvOpen={setAvOpen}
      isOnAVTeam={perms.isOnAVTeam}
      canManageWorkspace={perms.canManageWorkspace}
      avGateCount={perms.avGateCount}
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
        isOpen={!!selection.deleteCalendar}
        onClose={() => selection.setDeleteCalendar(null)}
        onConfirm={selection.confirmDeleteCalendar}
        title="Delete Calendar"
        message={`Delete "${selection.deleteCalendar?.name}"? All events in this calendar will be permanently removed.`}
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
