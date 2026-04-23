'use client'

/**
 * Audit ref H5: extracted from Sidebar.tsx.
 *
 * Owns the mutable state the sidebar's secondary panels drive:
 *   - `visibleCalendarIds`: which user-defined calendars are toggled on
 *   - `athleticsVisibleCampusIds`: which athletics campus calendars are on
 *   - `meetWithPeople`: up to 5 people the user is "comparing calendars with"
 *   - `calendarData` / `calendarDataReceived`: mirror of the calendar page's
 *     master list, received via the `calendar-sidebar-data` event
 *   - `athleticsCampuses` / `athleticsCampusId`: athletics campus selection
 *   - `activeSettingsTab`: which settings sub-tab is highlighted
 *   - `athleticsActiveTab`: current athletics tab
 *
 * All mutations broadcast via the typed event bus so the matching page can
 * react without a prop drill.
 */

import { useCallback, useState } from 'react'
import type { CalendarSidebarData, SettingsTab } from './types'
import type { AthleticsCampus } from './types'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import { AppEventName, emitAppEvent } from '@/lib/events/app-bus'

export interface SidebarSelectionStateOptions {
  initialSettingsTab: SettingsTab
}

export interface SidebarSelectionState {
  // Calendar
  calendarData: CalendarSidebarData[]
  setCalendarData: React.Dispatch<React.SetStateAction<CalendarSidebarData[]>>
  calendarDataReceived: boolean
  setCalendarDataReceived: React.Dispatch<React.SetStateAction<boolean>>
  visibleCalendarIds: Set<string>
  setVisibleCalendarIds: React.Dispatch<React.SetStateAction<Set<string>>>
  deleteCalendar: CalendarSidebarData | null
  setDeleteCalendar: React.Dispatch<React.SetStateAction<CalendarSidebarData | null>>

  // Athletics
  athleticsCampuses: AthleticsCampus[]
  setAthleticsCampuses: React.Dispatch<React.SetStateAction<AthleticsCampus[]>>
  athleticsCampusId: string | null
  setAthleticsCampusId: React.Dispatch<React.SetStateAction<string | null>>
  athleticsActiveTab: string
  setAthleticsActiveTab: React.Dispatch<React.SetStateAction<string>>
  athleticsVisibleCampusIds: Set<string>
  setAthleticsVisibleCampusIds: React.Dispatch<React.SetStateAction<Set<string>>>
  athleticsHasSports: boolean
  setAthleticsHasSports: React.Dispatch<React.SetStateAction<boolean>>

  // Meet-with
  meetWithPeople: MeetWithPerson[]
  setMeetWithPeople: React.Dispatch<React.SetStateAction<MeetWithPerson[]>>

  // Settings
  activeSettingsTab: SettingsTab
  setActiveSettingsTab: React.Dispatch<React.SetStateAction<SettingsTab>>

  // Handlers
  toggleCalendarVisibility: (calendarId: string) => void
  toggleAthleticsCalendar: (campusId: string) => void
  handleMeetWithAdd: (person: MeetWithPerson) => void
  handleMeetWithRemove: (personId: string) => void
  handleSettingsTabClick: (tab: SettingsTab) => void
  handleAthleticsCampusClick: (campusId: string) => void
  handleAthleticsTabClick: (tab: string) => void
  handleCreateCalendar: () => void
  handleCalendarRename: (calendarId: string, name: string) => void
  handleCalendarColorSelect: (calendarId: string, color: string) => void
  confirmDeleteCalendar: () => void
}

export function useSidebarSelectionState(
  options: SidebarSelectionStateOptions,
): SidebarSelectionState {
  const { initialSettingsTab } = options

  // Calendar state
  const [calendarData, setCalendarData] = useState<CalendarSidebarData[]>([])
  const [calendarDataReceived, setCalendarDataReceived] = useState(false)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [deleteCalendar, setDeleteCalendar] = useState<CalendarSidebarData | null>(null)

  // Athletics state
  const [athleticsCampuses, setAthleticsCampuses] = useState<AthleticsCampus[]>([])
  const [athleticsCampusId, setAthleticsCampusId] = useState<string | null>(null)
  const [athleticsActiveTab, setAthleticsActiveTab] = useState<string>('overview')
  const [athleticsVisibleCampusIds, setAthleticsVisibleCampusIds] = useState<Set<string>>(new Set())
  const [athleticsHasSports, setAthleticsHasSports] = useState(false)

  // Meet-with state
  const [meetWithPeople, setMeetWithPeople] = useState<MeetWithPerson[]>([])

  // Settings tab
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(initialSettingsTab)

  // ── Handlers ──
  const toggleCalendarVisibility = useCallback((calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      emitAppEvent(AppEventName.CALENDAR_TOGGLE, { calendarId })
      return next
    })
  }, [])

  const toggleAthleticsCalendar = useCallback((campusId: string) => {
    setAthleticsVisibleCampusIds((prev) => {
      const next = new Set(prev)
      if (next.has(campusId)) next.delete(campusId)
      else next.add(campusId)
      emitAppEvent(AppEventName.ATHLETICS_CALENDAR_TOGGLE, {
        campusId,
        visible: !prev.has(campusId),
      })
      return next
    })
  }, [])

  const handleMeetWithAdd = useCallback((person: MeetWithPerson) => {
    setMeetWithPeople((prev) => {
      if (prev.length >= 5 || prev.some((p) => p.id === person.id)) return prev
      const next = [...prev, person]
      emitAppEvent(AppEventName.MEET_WITH_CHANGE, { people: next })
      return next
    })
  }, [])

  const handleMeetWithRemove = useCallback((personId: string) => {
    setMeetWithPeople((prev) => {
      const next = prev.filter((p) => p.id !== personId)
      emitAppEvent(AppEventName.MEET_WITH_CHANGE, { people: next })
      return next
    })
  }, [])

  const handleSettingsTabClick = useCallback((tab: SettingsTab) => {
    setActiveSettingsTab(tab)
    emitAppEvent(AppEventName.SETTINGS_TAB_CHANGE, { tab })
  }, [])

  const handleAthleticsCampusClick = useCallback((campusId: string) => {
    setAthleticsCampusId(campusId)
    emitAppEvent(AppEventName.ATHLETICS_CAMPUS_CHANGE, { campusId })
  }, [])

  const handleAthleticsTabClick = useCallback((tab: string) => {
    setAthleticsActiveTab(tab)
    emitAppEvent(AppEventName.ATHLETICS_TAB_CHANGE, { tab })
  }, [])

  const handleCreateCalendar = useCallback(() => {
    emitAppEvent(AppEventName.CALENDAR_CREATE_REQUEST)
  }, [])

  const handleCalendarRename = useCallback((calendarId: string, name: string) => {
    emitAppEvent(AppEventName.CALENDAR_UPDATE, { calendarId, data: { name } })
  }, [])

  const handleCalendarColorSelect = useCallback((calendarId: string, color: string) => {
    emitAppEvent(AppEventName.CALENDAR_UPDATE, { calendarId, data: { color } })
  }, [])

  const confirmDeleteCalendar = useCallback(() => {
    if (!deleteCalendar) return
    emitAppEvent(AppEventName.CALENDAR_DELETE, { calendarId: deleteCalendar.id })
    setDeleteCalendar(null)
  }, [deleteCalendar])

  return {
    calendarData,
    setCalendarData,
    calendarDataReceived,
    setCalendarDataReceived,
    visibleCalendarIds,
    setVisibleCalendarIds,
    deleteCalendar,
    setDeleteCalendar,
    athleticsCampuses,
    setAthleticsCampuses,
    athleticsCampusId,
    setAthleticsCampusId,
    athleticsActiveTab,
    setAthleticsActiveTab,
    athleticsVisibleCampusIds,
    setAthleticsVisibleCampusIds,
    athleticsHasSports,
    setAthleticsHasSports,
    meetWithPeople,
    setMeetWithPeople,
    activeSettingsTab,
    setActiveSettingsTab,
    toggleCalendarVisibility,
    toggleAthleticsCalendar,
    handleMeetWithAdd,
    handleMeetWithRemove,
    handleSettingsTabClick,
    handleAthleticsCampusClick,
    handleAthleticsTabClick,
    handleCreateCalendar,
    handleCalendarRename,
    handleCalendarColorSelect,
    confirmDeleteCalendar,
  }
}
