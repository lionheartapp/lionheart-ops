'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import Link from 'next/link'
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
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  MoreHorizontal,
  Check,
  Pencil,
  Palette,
  Trash2,
} from 'lucide-react'

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
}

export type SettingsTab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus'

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

  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(() => {
    if (typeof window === 'undefined') return 'profile'
    const saved = localStorage.getItem('settings-active-tab')
    const validTabs: SettingsTab[] = ['profile', 'school-info', 'roles', 'teams', 'users', 'campus']
    if (saved && validTabs.includes(saved as SettingsTab)) return saved as SettingsTab
    return 'profile'
  })

  // Open settings panel when navigating to /settings, and restore saved tab
  // Use useLayoutEffect so the correct tab is set before paint (avoids flash)
  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/settings')) {
      setSettingsOpen(true)

      // Restore tab from localStorage on mount
      const saved = localStorage.getItem('settings-active-tab')
      const validTabs: SettingsTab[] = ['profile', 'school-info', 'roles', 'teams', 'users', 'campus']
      if (saved && validTabs.includes(saved as SettingsTab)) {
        setActiveSettingsTab(saved as SettingsTab)
      }
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
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set())
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    new Set(['ACADEMIC', 'STAFF', 'TIMETABLE', 'PARENT_FACING', 'ATHLETICS', 'GENERAL'])
  )

  // Three-dot menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [colorEditId, setColorEditId] = useState<string | null>(null)

  // Open calendar panel when navigating to /calendar
  useIsomorphicLayoutEffect(() => {
    if (pathname.startsWith('/calendar')) {
      setCalendarOpen(true)
      setSettingsOpen(false)
    } else {
      setCalendarOpen(false)
    }
  }, [pathname])

  // Listen for calendar data from the calendar page
  useEffect(() => {
    const handleCalendarData = (e: Event) => {
      const event = e as CustomEvent<{ calendars: CalendarSidebarData[]; visibleIds: string[] }>
      if (event.detail?.calendars) {
        setCalendarData(event.detail.calendars)
        setVisibleCalendarIds(new Set(event.detail.visibleIds))
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
    setRenamingId(cal.id)
    setRenameValue(cal.name)
  }

  const handleRenameSubmit = (calendarId: string) => {
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
    if (window.confirm(`Delete "${cal.name}"? All events in this calendar will be removed.`)) {
      window.dispatchEvent(
        new CustomEvent('calendar-delete', {
          detail: { calendarId: cal.id },
        })
      )
    }
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

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: Calendar, label: 'Calendar', href: '/calendar' },
  ]

  const handleSettingsClick = () => {
    if (!settingsOpen) {
      setSettingsOpen(true)
      setCalendarOpen(false)
      setActiveSettingsTab('profile')
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
    localStorage.setItem('settings-active-tab', tab)
    window.dispatchEvent(
      new CustomEvent('settings-tab-change', { detail: { tab } })
    )
  }

  // Check workspace permissions from localStorage
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const canManageWorkspace = userRole
    ? userRole.toLowerCase().includes('admin') || userRole.toLowerCase().includes('super')
    : false

  const generalTabs = [
    { id: 'profile' as SettingsTab, label: 'Account', icon: User },
  ]

  const workspaceTabs = [
    { id: 'school-info' as SettingsTab, label: 'School Information', icon: School },
    { id: 'roles' as SettingsTab, label: 'Roles', icon: Shield },
    { id: 'teams' as SettingsTab, label: 'Teams', icon: Users },
    { id: 'users' as SettingsTab, label: 'Members', icon: UserCog },
    { id: 'campus' as SettingsTab, label: 'Campus', icon: Building2 },
  ]

  const secondaryOpen = settingsOpen || calendarOpen

  const mainNavContent = (
    <>
      {/* Navigation Menu */}
      <nav className="p-4 pt-8 flex-1" role="navigation" aria-label="Main navigation">
        <ul className="space-y-2" role="list">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => {
                    setSettingsOpen(false)
                    setIsOpen(false)
                    // calendarOpen is managed by route detection in useIsomorphicLayoutEffect
                  }}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                    active && !secondaryOpen
                      ? 'bg-white/10 text-white font-medium border border-white/20'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                  aria-current={active && !secondaryOpen ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )

  const settingsNavContent = (
    <div className="flex flex-col h-full bg-[#f0f3f9]">
      {/* Settings Header */}
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Settings</h2>
      </div>

      {/* General Settings */}
      <div className="px-3 pt-4">
        <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                  isTabActive
                    ? 'bg-[#dde6f5] text-primary-600 font-medium'
                    : 'text-slate-500 hover:bg-[#e5eaf5] hover:text-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-primary-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Workspace Settings */}
      {canManageWorkspace && (
        <div className="px-3 pt-5 pb-4">
          <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase px-2 mb-2">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                    isTabActive
                      ? 'bg-[#dde6f5] text-primary-600 font-medium'
                      : 'text-slate-500 hover:bg-[#e5eaf5] hover:text-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-primary-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )

  const typeLabels: Record<string, string> = {
    ACADEMIC: 'Academic',
    STAFF: 'Staff',
    TIMETABLE: 'Timetable',
    PARENT_FACING: 'Parent-Facing',
    ATHLETICS: 'Athletics',
    GENERAL: 'General',
  }

  const calendarGrouped = calendarData.reduce<Record<string, CalendarSidebarData[]>>((acc, cal) => {
    const type = cal.calendarType
    if (!acc[type]) acc[type] = []
    acc[type].push(cal)
    return acc
  }, {})

  const calendarNavContent = (
    <div className="flex flex-col h-full bg-[#f0f3f9]">
      {/* Calendar Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Calendars</h2>
        <button
          onClick={handleCreateCalendar}
          className="p-1 rounded-md hover:bg-[#dde6f5] text-slate-400 hover:text-primary-600 transition-colors"
          title="Create calendar"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar List */}
      <div className="px-3 pt-4 flex-1 overflow-y-auto">
        {Object.entries(calendarGrouped).map(([type, cals]) => {
          const isExpanded = expandedTypes.has(type)
          return (
            <div key={type} className="mb-1">
              <button
                onClick={() => toggleCalendarType(type)}
                className="flex items-center gap-1.5 w-full px-2 py-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase hover:text-slate-600 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {typeLabels[type] || type}
                <span className="ml-auto text-slate-300 normal-case tracking-normal font-normal text-xs">
                  {cals.length}
                </span>
              </button>
              {isExpanded && (
                <div className="space-y-0.5">
                  {cals.map((cal) => {
                    const isVisible = visibleCalendarIds.has(cal.id)
                    const isRenaming = renamingId === cal.id
                    const isColorEditing = colorEditId === cal.id
                    const isMenuOpen = menuOpenId === cal.id

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
                                if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                              }}
                              onBlur={() => handleRenameSubmit(cal.id)}
                              className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-200 bg-white text-slate-700"
                              autoFocus
                            />
                          </div>
                        ) : isColorEditing ? (
                          <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <div
                                className="w-3 h-3 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="truncate">{cal.name}</span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                              {COLOR_PRESETS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => handleColorSelect(cal.id, c.value)}
                                  className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary-400"
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
                          <button
                            onClick={() => toggleCalendarVisibility(cal.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                              isVisible
                                ? 'text-slate-700 hover:bg-[#e5eaf5]'
                                : 'text-slate-400 hover:bg-[#e5eaf5]'
                            }`}
                          >
                            <div
                              className="w-3 h-3 rounded-sm flex-shrink-0 border"
                              style={{
                                backgroundColor: isVisible ? cal.color : 'transparent',
                                borderColor: cal.color,
                              }}
                            />
                            <span className="truncate">{cal.name}</span>
                            <span className="ml-auto flex items-center gap-1">
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                {isVisible ? (
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-slate-300" />
                                )}
                              </span>
                              <span
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMenuOpenId(isMenuOpen ? null : cal.id)
                                  setColorEditId(null)
                                }}
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                              </span>
                            </span>
                          </button>
                        )}

                        {/* Dropdown menu */}
                        {isMenuOpen && (
                          <div
                            className="absolute right-2 top-full z-50 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleRenameStart(cal)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              Rename
                            </button>
                            <button
                              onClick={() => handleColorChangeStart(cal.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-gray-50 transition-colors"
                            >
                              <Palette className="w-3.5 h-3.5 text-slate-400" />
                              Change Color
                            </button>
                            <button
                              onClick={() => handleDeleteCalendar(cal)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
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
          <div className="text-center py-8 text-slate-400 text-xs">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No calendars yet</p>
          </div>
        )}
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
          className="flex flex-col w-64 bg-[#111827] border-r border-white/10 h-full relative z-10"
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        {/* Secondary Navigation - slides in from behind (settings or calendar) */}
        <aside
          className={`flex flex-col w-60 bg-[#f0f3f9] border-r border-gray-200 h-full transition-all duration-300 ease-in-out overflow-hidden ${
            secondaryOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          aria-label={calendarOpen ? 'Calendar navigation' : 'Settings navigation'}
          aria-hidden={!secondaryOpen}
        >
          <div className="w-60 h-full">
            {calendarOpen ? calendarNavContent : settingsNavContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#111827] border-r border-white/10 flex flex-col transition-transform duration-300 z-navbar ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {calendarOpen ? calendarNavContent : settingsOpen ? settingsNavContent : mainNavContent}
      </aside>

      {/* Spacer for desktop layout - adjusts width based on secondary panel */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${
          secondaryOpen ? 'w-[496px]' : 'w-64'
        }`}
      />
    </>
  )
}
