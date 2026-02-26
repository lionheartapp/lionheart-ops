'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'

export interface SidebarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  onLogout?: () => void
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
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('profile')

  // Open settings panel when navigating to /settings
  useEffect(() => {
    if (pathname.startsWith('/settings')) {
      setSettingsOpen(true)
    }
  }, [pathname])

  // Listen for settings tab change events from the settings page
  useEffect(() => {
    const handleTabRequest = (e: Event) => {
      const event = e as CustomEvent<{ tab: SettingsTab }>
      if (event.detail?.tab) {
        setActiveSettingsTab(event.detail.tab)
      }
    }
    window.addEventListener('settings-tab-request', handleTabRequest)
    return () => window.removeEventListener('settings-tab-request', handleTabRequest)
  }, [])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
  ]

  const handleSettingsClick = () => {
    if (!settingsOpen) {
      setSettingsOpen(true)
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
                  }}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-[#111827] ${
                    active && !settingsOpen
                      ? 'bg-white/10 text-white font-medium border border-white/20'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                  aria-current={active && !settingsOpen ? 'page' : undefined}
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
                    ? 'bg-[#dde6f5] text-blue-600 font-medium'
                    : 'text-slate-500 hover:bg-[#e5eaf5] hover:text-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-blue-600' : 'text-slate-400'}`} />
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
                      ? 'bg-[#dde6f5] text-blue-600 font-medium'
                      : 'text-slate-500 hover:bg-[#e5eaf5] hover:text-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isTabActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 min-h-[44px] min-w-[44px] rounded-lg bg-[#111827] border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Desktop Layout: Main Nav + Settings Secondary Nav */}
      <div className="hidden lg:flex fixed left-0 top-16 h-[calc(100vh-64px)] z-20">
        {/* Main Navigation Sidebar */}
        <aside
          className="flex flex-col w-64 bg-[#111827] border-r border-white/10 h-full relative z-10"
          aria-label="Sidebar navigation"
        >
          {mainNavContent}
        </aside>

        {/* Settings Secondary Navigation - slides in from behind */}
        <aside
          className={`flex flex-col w-60 bg-[#f0f3f9] border-r border-gray-200 h-full transition-all duration-300 ease-in-out overflow-hidden ${
            settingsOpen ? 'max-w-60 opacity-100' : 'max-w-0 opacity-0'
          }`}
          aria-label="Settings navigation"
          aria-hidden={!settingsOpen}
        >
          <div className="w-60 h-full">
            {settingsNavContent}
          </div>
        </aside>
      </div>

      {/* Mobile Layout: Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-16 h-[calc(100vh-64px)] w-64 bg-[#111827] border-r border-white/10 flex flex-col transition-transform duration-300 z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {settingsOpen ? settingsNavContent : mainNavContent}
      </aside>

      {/* Spacer for desktop layout - adjusts width based on settings panel */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${
          settingsOpen ? 'w-[524px]' : 'w-64'
        }`}
      />
    </>
  )
}
