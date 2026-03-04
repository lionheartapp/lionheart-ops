'use client'

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import PrefetchLink from '@/components/PrefetchLink'
import ConfirmDialog from '@/components/ConfirmDialog'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Menu,
  X,
  User,
  School,
  Shield,
  Users,
  UserCog,
  Building2,
  Calendar,
  CalendarClock,
  Trophy,
  Puzzle,
  Dribbble,
  CalendarDays,
  ClipboardList,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Check,
  Pencil,
  Palette,
  Trash2,
} from 'lucide-react'
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled'
import CampusShapeIndicator, { buildCampusShapeMap, getShapeIndex } from '@/components/calendar/CampusShapeIndicator'
import MeetWithSection from '@/components/calendar/MeetWithSection'
import type { MeetWithPerson } from '@/lib/hooks/useMeetWith'
import { MEET_WITH_COLORS } from '@/lib/hooks/useMeetWith'

const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
]

export interface SidebarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  onLogout?: () => void
}

export interface CalendarSidebarData {
  id: string
  name: string
  color: string
  calendarType: string
  isActive: boolean
  createdById?: string | null
  campus?: { id: string; name: string } | null
}

export type SettingsTab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus' | 'add-ons'
export type AthleticsTab = 'sports' | 'teams' | 'schedule' | 'roster' | 'tournaments' | 'stats'

interface AthleticsCampus {
  id: string
  name: string
}

export default function Sidebar({
  userName = 'User',
  userEmail = 'user@school.edu',
  userAvatar,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('profile')

  // Athletics sidebar state
  const [athleticsOpen, setAthleticsOpen] = useState(false)
  const [activeAthleticsTab, setActiveAthleticsTab] = useState<AthleticsTab>('sports')
  const [athleticsCampusId, setAthleticsCampusId] = useState<string | null>(null)
  const [athleticsCampuses, setAthleticsCampuses] = useState<AthleticsCampus[]>([])

  // Open settings panel when navigating to /settings
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/settings')) {
      setSettingsOpen(true)
      setAthleticsOpen(false)
    }
  }, [pathname])

  // Listen for settings tab change events from the settings page (both event types)
  useEffect(() => {
    const handleTabEvent = (e: Event) => {
      const event = e as CustomEvent<{ tab: SettingsTab }>
      if (event.detail?.tab) {
        setActiveSettingsTab(event.detail.tab)
      }
    }
    window.addEventListener('settings-tab-request', handleTabEvent)
    window.addEventListener('settings-tab-change', handleTabEvent)
    return () => {
      window.removeEventListener('settings-tab-request', handleTabEvent)
      window.removeEventListener('settings-tab-change', handleTabEvent)
    }
  }, [])

  // Calendar sidebar state
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarData, setCalendarData] = useState<CalendarSidebarData[]>([])
  const [calendarDataReceived, setCalendarDataReceived] = useState(false)
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['MASTER', 'MY SCHEDULE'])
  )

  // Campus → shape index map
  const campusShapeMap = useMemo(() => buildCampusShapeMap(calendarData), [calendarData])

  // Meet with state
  const [meetWithPeople, setMeetWithPeople] = useState<MeetWithPerson[]>([])

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

  // Three-dot menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameCancelledRef = useRef(false)
  const [colorEditId, setColorEditId] = useState<string | null>(null)
  const [deleteCalendar, setDeleteCalendar] = useState<CalendarSidebarData | null>(null)

  // Open calendar panel when navigating to /calendar
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/calendar')) {
      setCalendarOpen(true)
      setSettingsOpen(false)
      setAthleticsOpen(false)
    } else {
      setCalendarOpen(false)
    }
  }, [pathname])

  // Open athletics panel when navigating to /athletics
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/athletics')) {
      setAthleticsOpen(true)
      setSettingsOpen(false)
      setCalendarOpen(false)
    } else {
      setAthleticsOpen(false)
    }
  }, [pathname])

  // Listen for calendar data from the calendar page
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
      if (event.detail?.visibleIds) {
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
      }
    }
    window.addEventListener('calendar-sidebar-data', handleCalendarData)
    window.addEventListener('calendar-visibility-change', handleVisibilityChange)
    return () => {
      window.removeEventListener('calendar-sidebar-data', handleCalendarData)
      window.removeEventListener('calendar-visibility-change', handleVisibilityChange)
    }
  }, [])

  // Listen for athletics sidebar data from the athletics page
  useEffect(() => {
    const handleAthleticsData = (e: Event) => {
      const event = e as CustomEvent<{
        campuses: AthleticsCampus[]
        activeCampusId: string | null
        activeTab: AthleticsTab
      }>
      if (event.detail) {
        setAthleticsCampuses(event.detail.campuses)
        if (event.detail.activeCampusId) setAthleticsCampusId(event.detail.activeCampusId)
        if (event.detail.activeTab) setActiveAthleticsTab(event.detail.activeTab)
      }
    }
    const handleAthleticsTabRequest = (e: Event) => {
      const event = e as CustomEvent<{ tab: AthleticsTab }>
      if (event.detail?.tab) setActiveAthleticsTab(event.detail.tab)
    }
    window.addEventListener('athletics-sidebar-data', handleAthleticsData)
    window.addEventListener('athletics-tab-request', handleAthleticsTabRequest)
    return () => {
      window.removeEventListener('athletics-sidebar-data', handleAthleticsData)
      window.removeEventListener('athletics-tab-request', handleAthleticsTabRequest)
    }
  }, [])

  const toggleCalendarVisibility = (calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev)
      if (next.has(calendarId)) next.delete(calendarId)
      else next.add(calendarId)
      // Notify the calendar page
      window.dispatchEvent(
        new CustomEvent('calendar-toggle', { detail: { calendarId } })
      )
      return next
    })
  }

  const toggleCalendarType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const handleCreateCalendar = () => {
    window.dispatchEvent(new CustomEvent('calendar-create-request'))
  }

  const handleRenameStart = (cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    renameCancelledRef.current = false
    setRenamingId(cal.id)
    setRenameValue(cal.name)
  }

  const handleRenameSubmit = (calendarId: string) => {
    if (renameCancelledRef.current) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      window.dispatchEvent(
        new CustomEvent('calendar-update', {
          detail: { calendarId, data: { name: trimmed } },
        })
      )
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameCancel = () => {
    renameCancelledRef.current = true
    setRenamingId(null)
    setRenameValue('')
  }

  const handleColorChangeStart = (calendarId: string) => {
    setMenuOpenId(null)
    setColorEditId(calendarId)
  }

  const handleColorSelect = (calendarId: string, color: string) => {
    window.dispatchEvent(
      new CustomEvent('calendar-update', {
        detail: { calendarId, data: { color } },
      })
    )
    setColorEditId(null)
  }

  const handleDeleteCalendar = (cal: CalendarSidebarData) => {
    setMenuOpenId(null)
    setDeleteCalendar(cal)
  }

  const confirmDeleteCalendar = () => {
    if (!deleteCalendar) return
    window.dispatchEvent(
      new CustomEvent('calendar-delete', {
        detail: { calendarId: deleteCalendar.id },
      })
    )
    setDeleteCalendar(null)
  }

  // Close menu/color picker when clicking outside
  useEffect(() => {
    if (!menuOpenId && !colorEditId) return
    const handleClickOutside = () => {
      setMenuOpenId(null)
      setColorEditId(null)
    }
    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpenId, colorEditId])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const { enabled: athleticsEnabled } = useModuleEnabled('athletics')

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: Calendar, label: 'Calendar', href: '/calendar' },
    { icon: CalendarClock, label: 'Planning', href: '/planning' },
  ]

  const handleAthleticsClick = () => {
    if (!athleticsOpen) {
      setAthleticsOpen(true)
      setSettingsOpen(false)
      setCalendarOpen(false)
      router.push('/athletics')
    } else {
      setAthleticsOpen(false)
      router.push('/dashboard')
    }
  }

  const handleAthleticsTabClick = (tab: AthleticsTab) => {
    setActiveAthleticsTab(tab)
    window.dispatchEvent(
      new CustomEvent('athletics-tab-change', { detail: { tab } })
    )
  }

  const handleAthleticsCampusClick = (campusId: string) => {
    setAthleticsCampusId(campusId)
    window.dispatchEvent(
      new CustomEvent('athletics-campus-change', { detail: { campusId } })
    )
  }

  const handleSettingsClick = () => {
    if (!settingsOpen) {
      setSettingsOpen(true)
      setCalendarOpen(false)
      setAthleticsOpen(false)
      // Keep the last-used settings tab (stored in localStorage) instead of resetting
      router.push('/settings')
    } else {
      setSettingsOpen(false)
      router.push('/dashboard')
    }
  }

  const handleBackFromSettings = () => {
    setSettingsOpen(false)
    router.push('/dashboard')
  }

  const handleSettingsTabClick = (tab: SettingsTab) => {
    setActiveSettingsTab(tab)
    window.dispatchEvent(
      new CustomEvent('settings-tab-change', { detail: { tab } })
    )
  }

  // Check workspace permissions from localStorage (optimistic — server enforces real perms)
  const ADMIN_ROLES = ['super admin', 'administrator', 'super-admin', 'admin']
  const [canManageWorkspace, setCanManageWorkspace] = useState(false)
  useEffect(() => {
    const role = localStorage.getItem('user-role')
    setCanManageWorkspace(role ? ADMIN_ROLES.includes(role.toLowerCase()) : false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generalTabs = [
    { id: 'profile' as SettingsTab, label: 'Account', icon: User },
  ]

  const workspaceTabs = [
    { id: 'school-info' as SettingsTab, label: 'School Information', icon: School },
    { id: 'roles' as SettingsTab, label: 'Roles', icon: Shield },
    { id: 'teams' as SettingsTab, label: 'Teams', icon: Users },
    { id: 'users' as SettingsTab, label: 'Members', icon: UserCog },
    { id: 'campus' as SettingsTab, label: 'Campus', icon: Building2 },
    { id: 'add-ons' as SettingsTab, label: 'Add-ons', icon: Puzzle },
  ]

  const secondaryOpen = settingsOpen || calendarOpen || athleticsOpen

  const mainNavContent = (
    <>
      {/* Navigation Menu */}
      <nav className="p-4 pt-8 lg:flex-1" role="navigation" aria-label="Main navigation">
        <ul className="space-y-2" role="list">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <PrefetchLink
                  href={item.href}
                  onClick={() => {
                    setSettingsOpen(false)
                    setAthleticsOpen(false)
                    setIsOpen(false)
                    // calendarOpen is managed by route detection in useIsomorphicLayoutEffect
                  }}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                    active && !settingsOpen && !athleticsOpen
                      ? 'bg-white/10 text-white font-medium border border-white/20'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                  aria-current={active && !settingsOpen && !athleticsOpen ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </PrefetchLink>
              </li>
            )
          })}
          {/* Athletics — toggle secondary sidebar (like Settings) */}
          {athleticsEnabled && (
            <li>
              <button
                onClick={() => {
                  handleAthleticsClick()
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                  athleticsOpen
                    ? 'bg-white/10 text-white font-medium border border-white/20'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'
                }`}
                aria-current={athleticsOpen ? 'page' : undefined}
              >
                <Trophy className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm">Athletics</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  )

  const settingsNavContent = (
    <div className="flex flex-col h-full bg-[#f0f3f9]">
      {/* Settings Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Settings</h2>
      </div>

      {/* General Settings */}
      <div className="px-3 pt-4">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-2 mb-2">
          General
        </p>
        <nav className="space-y-0.5" aria-label="General settings sections">
          {generalTabs.map((tab) => {
            const Icon = tab.icon
            const isTabActive = activeSettingsTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleSettingsTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  isTabActive
                    ? 'bg-[#dde6f5] text-primary-600 font-medium'
                    : 'text-gray-500 hover:bg-[#e5eaf5] hover:text-gray-700'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-primary-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Workspace Settings */}
      {canManageWorkspace && (
        <div className="px-3 pt-5 pb-4">
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-2 mb-2">
            Workspace
          </p>
          <nav className="space-y-0.5" aria-label="Workspace settings sections">
            {workspaceTabs.map((tab) => {
              const Icon = tab.icon
              const isTabActive = activeSettingsTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSettingsTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isTabActive
                      ? 'bg-[#dde6f5] text-primary-600 font-medium'
                      : 'text-gray-500 hover:bg-[#e5eaf5] hover:text-gray-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )

  // Group calendars into MASTER (non-personal) and MY SCHEDULE (personal)
  const masterCalendars = calendarData.filter((c) => c.calendarType !== 'PERSONAL')
  const personalCalendars = calendarData.filter((c) => c.calendarType === 'PERSONAL')

  const calendarSections = [
    { key: 'MASTER', label: 'Master', cals: masterCalendars },
    { key: 'MY SCHEDULE', label: 'My Schedule', cals: personalCalendars },
  ]

  const calendarNavContent = (
    <div className="flex flex-col h-full bg-[#f0f3f9]">
      {/* Calendar Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Calendars</h2>
        {canManageWorkspace && (
          <button
            onClick={handleCreateCalendar}
            className="p-1 rounded-md hover:bg-[#dde6f5] text-gray-400 hover:text-primary-600 transition-colors"
            title="Create calendar"
            aria-label="Create calendar"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Calendar List — grouped by MASTER / MY SCHEDULE */}
      <div className="px-3 pt-4 flex-1 overflow-y-auto">
        {!calendarDataReceived && calendarData.length === 0 && (
          <div className="space-y-3 px-2 animate-pulse">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-28 bg-gray-200 rounded" />
            </div>
            <div className="h-3 w-20 bg-gray-200 rounded mt-4" />
            <div className="space-y-2 pl-2">
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        )}
        {calendarSections.map(({ key, label, cals }) => {
          // Hide MASTER section if no calendars; always show MY SCHEDULE
          if (cals.length === 0 && key !== 'MY SCHEDULE') return null
          const isMySchedule = key === 'MY SCHEDULE'
          const isExpanded = isMySchedule || expandedTypes.has(key)
          return (
            <div key={key} className="mb-1">
              {isMySchedule ? (
                /* MY SCHEDULE — flat section label, no collapsible dropdown */
                <div className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  {label}
                </div>
              ) : (
                <button
                  onClick={() => toggleCalendarType(key)}
                  className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-gray-400 uppercase hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {label}
                  <span className="ml-auto text-gray-300 normal-case tracking-normal font-normal text-xs">
                    {cals.length}
                  </span>
                </button>
              )}
              {isExpanded && (
                <div className="space-y-0.5">
                  {cals.length === 0 && isMySchedule && (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-gray-400">Your personal calendar will appear here</p>
                    </div>
                  )}
                  {cals.map((cal) => {
                    const isVisible = visibleCalendarIds.has(cal.id)
                    const isRenaming = renamingId === cal.id
                    const isColorEditing = colorEditId === cal.id
                    const isMenuOpen = menuOpenId === cal.id
                    // Show three-dot menu for admins or own personal calendars
                    // (API only returns the current user's personal calendar, so PERSONAL = own)
                    const canEditCal = canManageWorkspace || cal.calendarType === 'PERSONAL'

                    return (
                      <div key={cal.id} className="relative group">
                        {isRenaming ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: cal.color }}
                            />
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(cal.id)
                                if (e.key === 'Escape') handleRenameCancel()
                              }}
                              onBlur={() => handleRenameSubmit(cal.id)}
                              className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-gray-700"
                              autoFocus
                            />
                          </div>
                        ) : isColorEditing ? (
                          <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => handleColorSelect(cal.id, c.value)}
                                  className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-400"
                                  style={{ backgroundColor: c.value }}
                                  title={c.name}
                                >
                                  {cal.color === c.value && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleCalendarVisibility(cal.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                toggleCalendarVisibility(cal.id)
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition cursor-pointer ${
                              isVisible
                                ? 'text-gray-700 hover:bg-[#e5eaf5]'
                                : 'text-gray-400 hover:bg-[#e5eaf5]'
                            }`}
                            title={cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}
                          >
                            <div
                              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-colors"
                              style={{
                                backgroundColor: isVisible ? cal.color : 'transparent',
                                border: isVisible ? 'none' : `2px solid ${cal.color}`,
                              }}
                            >
                              {isVisible && <Check className="w-3 h-3 text-white" />}
                            </div>
                            {cal.campus && (
                              <CampusShapeIndicator
                                shapeIndex={getShapeIndex(campusShapeMap, cal.campus.id)}
                                color={cal.color}
                                size={12}
                              />
                            )}
                            <span className="truncate">{cal.calendarType === 'PERSONAL' ? 'My Calendar' : cal.name}</span>
                            {canEditCal && (
                              <button
                                type="button"
                                tabIndex={0}
                                aria-label={`Calendar options for ${cal.name}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 rounded hover:bg-gray-200/50 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setColorEditId(null)
                                  if (renamingId) handleRenameCancel()
                                  setMenuOpenId(isMenuOpen ? null : cal.id)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setColorEditId(null)
                                    if (renamingId) handleRenameCancel()
                                    setMenuOpenId(isMenuOpen ? null : cal.id)
                                  }
                                }}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div
                            role="menu"
                            aria-label={`Options for ${cal.name}`}
                            className="absolute right-2 bottom-0 translate-y-full z-modal w-40 bg-white rounded-lg shadow-medium border border-gray-200 py-1"
                            style={{ maxHeight: '200px' }}
                            ref={(el) => {
                              // Flip to above if overflowing bottom of viewport
                              if (el) {
                                const rect = el.getBoundingClientRect()
                                if (rect.bottom > window.innerHeight - 8) {
                                  el.style.bottom = 'auto'
                                  el.style.top = '0'
                                  el.style.transform = 'translateY(-100%)'
                                }
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              role="menuitem"
                              onClick={() => handleRenameStart(cal)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-400" />
                              Rename
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => handleColorChangeStart(cal.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Palette className="w-3.5 h-3.5 text-gray-400" />
                              Change Color
                            </button>
                            {canManageWorkspace && (
                              <button
                                role="menuitem"
                                onClick={() => handleDeleteCalendar(cal)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {calendarData.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-xs">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No calendars yet</p>
          </div>
        )}

        {/* Meet With Section */}
        {calendarDataReceived && (
          <div className="border-t border-gray-200 mt-2 pt-2">
            <MeetWithSection
              people={meetWithPeople}
              onAdd={handleMeetWithAdd}
              onRemove={handleMeetWithRemove}
            />
          </div>
        )}
      </div>
    </div>
  )

  const athleticsSubTabs: { id: AthleticsTab; label: string; icon: typeof Dribbble }[] = [
    { id: 'sports', label: 'Sports', icon: Dribbble },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    { id: 'roster', label: 'Roster', icon: ClipboardList },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ]

  const athleticsNavContent = (
    <div className="flex flex-col h-full bg-[#f0f3f9]">
      {/* Athletics Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-xs font-semibold tracking-wide text-gray-400 uppercase">Athletics</h2>
      </div>

      {/* Campuses */}
      {athleticsCampuses.length > 0 && (
        <div className="px-3 pt-4">
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-2 mb-2">
            Campuses
          </p>
          <nav className="space-y-0.5" aria-label="Athletics campuses">
            {athleticsCampuses.map((campus) => {
              const isActiveCampus = athleticsCampusId === campus.id
              return (
                <button
                  key={campus.id}
                  onClick={() => handleAthleticsCampusClick(campus.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    isActiveCampus
                      ? 'bg-[#dde6f5] text-primary-600 font-medium'
                      : 'text-gray-500 hover:bg-[#e5eaf5] hover:text-gray-700'
                  }`}
                >
                  <Building2 className={`w-4 h-4 flex-shrink-0 ${isActiveCampus ? 'text-primary-600' : 'text-gray-400'}`} />
                  {campus.name}
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Divider */}
      <div className="px-5 py-2">
        <div className="h-px bg-gray-200" />
      </div>

      {/* Navigation */}
      <div className="px-3 pb-4">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-2 mb-2">
          Navigation
        </p>
        <nav className="space-y-0.5" aria-label="Athletics navigation">
          {athleticsSubTabs.map((tab) => {
            const Icon = tab.icon
            const isTabActive = activeAthleticsTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleAthleticsTabClick(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  isTabActive
                    ? 'bg-[#dde6f5] text-primary-600 font-medium'
                    : 'text-gray-500 hover:bg-[#e5eaf5] hover:text-gray-700'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-primary-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-mobilenav p-2 min-h-[44px] min-w-[44px] rounded-lg bg-[#111827] border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary-400"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6 text-white" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-navbar cursor-pointer"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Desktop Layout: Main Nav + Settings Secondary Nav */}
      <div className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-64px)] z-sticky">
        {/* Main Navigation Sidebar */}
        <aside
          className="flex flex-col w-64 bg-[#111827] text-gray-100 border-r border-white/10 h-full relative z-10"
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        {/* Secondary Navigation - slides in from behind (settings or calendar) */}
        <aside
          className={`flex flex-col w-60 bg-[#f0f3f9] border-r border-gray-200 h-full transition-all duration-300 ease-in-out overflow-hidden ${
            secondaryOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          aria-label={athleticsOpen ? 'Athletics navigation' : calendarOpen ? 'Calendar navigation' : 'Settings navigation'}
          aria-hidden={!secondaryOpen}
        >
          <div className="w-60 h-full">
            {athleticsOpen ? athleticsNavContent : calendarOpen ? calendarNavContent : settingsNavContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#111827] text-gray-100 border-r border-white/10 flex flex-col transition-transform duration-300 z-navbar ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {mainNavContent}
        {(calendarOpen || settingsOpen || athleticsOpen) && (
          <div className="flex-1 overflow-y-auto border-t border-white/10">
            {athleticsOpen ? athleticsNavContent : calendarOpen ? calendarNavContent : settingsNavContent}
          </div>
        )}
      </aside>

      {/* Spacer for desktop layout - adjusts width based on secondary panel */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${
          secondaryOpen ? 'w-[496px]' : 'w-64'
        }`}
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
    </>
  )
}
