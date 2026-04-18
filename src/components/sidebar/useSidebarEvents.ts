'use client'

/**
 * Audit ref H5: extracted from Sidebar.tsx.
 *
 * Wires up the DOM event consumers the sidebar needs:
 *   - settings-tab-request / settings-tab-change: keep the active settings
 *     tab highlighted when it's changed from another surface (mobile sheet,
 *     ProfileTab, etc.).
 *   - calendar-sidebar-data / calendar-visibility-change: receive the list
 *     of calendars + visibility state from the calendar page.
 *   - athletics-sidebar-data: receive enabled campuses from the athletics
 *     page. On mount, emit `ATHLETICS_SIDEBAR_REQUEST` so the page ships the
 *     data even when the sidebar mounts after the page.
 */

import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { CalendarSidebarData, SettingsTab } from './types'
import type { AthleticsCampus } from './types'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'

export interface SidebarEventConsumerOptions {
  setActiveSettingsTab: Dispatch<SetStateAction<SettingsTab>>
  setCalendarData: Dispatch<SetStateAction<CalendarSidebarData[]>>
  setVisibleCalendarIds: Dispatch<SetStateAction<Set<string>>>
  setCalendarDataReceived: Dispatch<SetStateAction<boolean>>
  setAthleticsCampuses: Dispatch<SetStateAction<AthleticsCampus[]>>
  setAthleticsCampusId: Dispatch<SetStateAction<string | null>>
}

export function useSidebarEvents(options: SidebarEventConsumerOptions): void {
  const {
    setActiveSettingsTab,
    setCalendarData,
    setVisibleCalendarIds,
    setCalendarDataReceived,
    setAthleticsCampuses,
    setAthleticsCampusId,
  } = options

  // Settings tab sync
  useEffect(() => {
    function handleTabEvent(e: Event) {
      const event = e as CustomEvent<{ tab: SettingsTab }>
      if (event.detail?.tab) setActiveSettingsTab(event.detail.tab)
    }
    window.addEventListener('settings-tab-request', handleTabEvent)
    window.addEventListener('settings-tab-change', handleTabEvent)
    return () => {
      window.removeEventListener('settings-tab-request', handleTabEvent)
      window.removeEventListener('settings-tab-change', handleTabEvent)
    }
  }, [setActiveSettingsTab])

  // Calendar sidebar data + visibility
  useEffect(() => {
    function handleCalendarData(e: Event) {
      const event = e as CustomEvent<{ calendars: CalendarSidebarData[]; visibleIds: string[] }>
      if (event.detail?.calendars) {
        setCalendarData(event.detail.calendars)
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
        setCalendarDataReceived(true)
      }
    }
    function handleVisibilityChange(e: Event) {
      const event = e as CustomEvent<{ visibleIds: string[] }>
      if (event.detail?.visibleIds) setVisibleCalendarIds(new Set(event.detail.visibleIds))
    }
    window.addEventListener('calendar-sidebar-data', handleCalendarData)
    window.addEventListener('calendar-visibility-change', handleVisibilityChange)
    return () => {
      window.removeEventListener('calendar-sidebar-data', handleCalendarData)
      window.removeEventListener('calendar-visibility-change', handleVisibilityChange)
    }
  }, [setCalendarData, setVisibleCalendarIds, setCalendarDataReceived])

  // Athletics sidebar data + mount-time pull
  useEffect(() => {
    function handleAthleticsData(e: Event) {
      const event = e as CustomEvent<{ campuses: AthleticsCampus[]; activeCampusId: string | null }>
      if (event.detail) {
        setAthleticsCampuses(event.detail.campuses)
        if (event.detail.activeCampusId) setAthleticsCampusId(event.detail.activeCampusId)
      }
    }
    window.addEventListener('athletics-sidebar-data', handleAthleticsData)
    emitAppEvent(AppEventName.ATHLETICS_SIDEBAR_REQUEST)
    return () => {
      window.removeEventListener('athletics-sidebar-data', handleAthleticsData)
    }
  }, [setAthleticsCampuses, setAthleticsCampusId])
}
