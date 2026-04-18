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
    setFacilitiesOpen,
    setItOpen,
    setAvOpen,
  } = options

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/settings')) {
      setSettingsOpen(true)
      setAthleticsOpen(false)
      setEventsOpen(false)
    }
  }, [pathname, setSettingsOpen, setAthleticsOpen, setEventsOpen])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/events') || pathname.startsWith('/calendar') || pathname.startsWith('/planning')) {
      setEventsOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
    }
  }, [pathname, setEventsOpen, setSettingsOpen, setAthleticsOpen])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/calendar')) {
      setCalendarOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
    } else {
      setCalendarOpen(false)
    }
  }, [pathname, setCalendarOpen, setSettingsOpen, setAthleticsOpen])

  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/athletics')) {
      setAthleticsOpen(true)
      setSettingsOpen(false)
      setCalendarOpen(false)
      setEventsOpen(false)
    } else {
      setAthleticsOpen(false)
    }
  }, [pathname, setAthleticsOpen, setSettingsOpen, setCalendarOpen, setEventsOpen])

  useIsomorphicLayoutEffect(() => {
    if (isMaintenancePath(pathname, pageSearchParams)) {
      setFacilitiesOpen(true)
      setItOpen(false)
      setAvOpen(false)
    }
  }, [pathname, pageSearchParams, setFacilitiesOpen, setItOpen, setAvOpen])

  useIsomorphicLayoutEffect(() => {
    if (isITPath(pathname, pageSearchParams)) {
      setItOpen(true)
      setFacilitiesOpen(false)
      setAvOpen(false)
    }
  }, [pathname, pageSearchParams, setItOpen, setFacilitiesOpen, setAvOpen])

  useIsomorphicLayoutEffect(() => {
    if (isAVPath(pathname, pageSearchParams)) {
      setAvOpen(true)
      setFacilitiesOpen(false)
      setItOpen(false)
    }
  }, [pathname, pageSearchParams, setAvOpen, setFacilitiesOpen, setItOpen])
}
