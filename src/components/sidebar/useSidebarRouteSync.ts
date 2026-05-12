'use client'

/**
 * Audit ref H5: extracted from Sidebar.tsx.
 *
 * Syncs which secondary panel is "auto-expanded" (settings / events /
 * calendar / athletics / facilities / it / av) with the current route. Keeps
 * the sidebar in sync when users navigate via deep links or back/forward.
 */

import { useEffect, useLayoutEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export interface SidebarRouteSyncOptions {
  pathname: string
  pageSearchParams: { get(name: string): string | null } | null
  setSettingsOpen: Dispatch<SetStateAction<boolean>>
  setEventsOpen: Dispatch<SetStateAction<boolean>>
  setCalendarOpen: Dispatch<SetStateAction<boolean>>
  setAthleticsOpen: Dispatch<SetStateAction<boolean>>
  setMessagingOpen: Dispatch<SetStateAction<boolean>>
  setFacilitiesOpen: Dispatch<SetStateAction<boolean>>
  setItOpen: Dispatch<SetStateAction<boolean>>
  setAvOpen: Dispatch<SetStateAction<boolean>>
}

type ReadonlyParams = { get(name: string): string | null } | null

function isMaintenancePath(p: string, params: ReadonlyParams): boolean {
  return p.startsWith('/maintenance') || (p === '/inventory' && params?.get('dept') === 'maintenance')
}

function isITPath(p: string, params: ReadonlyParams): boolean {
  return p.startsWith('/it') || (p === '/inventory' && params?.get('dept') === 'it')
}

function isAVPath(p: string, params: ReadonlyParams): boolean {
  return p.startsWith('/av') || (p === '/inventory' && !params?.get('dept'))
}

export function useSidebarRouteSync(options: SidebarRouteSyncOptions): void {
  const {
    pathname,
    pageSearchParams,
    setSettingsOpen,
    setEventsOpen,
    setCalendarOpen,
    setAthleticsOpen,
    setMessagingOpen,
    setFacilitiesOpen,
    setItOpen,
    setAvOpen,
  } = options

  // Single effect that derives all panel states from the current route.
  // This replaces the previous per-panel effects that could leave stale
  // state when the sidebar persists across navigations (shared layout).
  useIsomorphicLayoutEffect(() => {
    const isSettings = pathname.startsWith('/settings')
    const isEvents = pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')
    const isCalendar = pathname.startsWith('/calendar')
    const isAthletics = pathname.startsWith('/athletics')
    const isMessaging = pathname.startsWith('/messaging')
    const isMaintenance = isMaintenancePath(pathname, pageSearchParams)
    const isIT = isITPath(pathname, pageSearchParams)
    const isAV = isAVPath(pathname, pageSearchParams)

    setSettingsOpen(isSettings)
    setEventsOpen(isEvents)
    setCalendarOpen(isCalendar)
    setAthleticsOpen(isAthletics)
    setMessagingOpen(isMessaging)
    setFacilitiesOpen(isMaintenance)
    setItOpen(isIT)
    setAvOpen(isAV)
  }, [pathname, pageSearchParams, setSettingsOpen, setEventsOpen, setCalendarOpen, setAthleticsOpen, setMessagingOpen, setFacilitiesOpen, setItOpen, setAvOpen])
}
