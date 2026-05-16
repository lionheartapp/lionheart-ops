'use client'

import { useRef } from 'react'
import PrefetchLink from '@/components/PrefetchLink'
import {
  Home,
  CalendarClock,
  Trophy,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { useMessagingUnread } from '@/lib/hooks/useMessagingUnread'
import { useQueryClient } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import SupportSection from './SupportSection'
import UserMenu from './UserMenu'
import SchoolSelector from './SchoolSelector'

interface MainNavContentProps {
  pathname: string
  pageSearchParams: URLSearchParams
  organizationName?: string
  organizationLogoUrl?: string
  userName: string
  userEmail: string
  userAvatar?: string
  isSuperAdmin: boolean
  isImpersonating: boolean
  onLogout?: () => void
  onBugDialogOpen: () => void
  onViewAsOpen: () => void
  onSettingsClick: () => void
  onEventsClick: () => void
  onAthleticsClick: () => void
  setIsOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setAthleticsOpen: (open: boolean) => void
  setEventsOpen: (open: boolean) => void
  // Panel open state
  settingsOpen: boolean
  athleticsOpen: boolean
  eventsOpen: boolean
  // Messaging
  onMessagingClick: () => void
  setMessagingOpen: (open: boolean) => void
  messagingOpen: boolean
  messagingEnabled: boolean
  messagingModuleLoading: boolean
  // Athletics
  athleticsEnabled: boolean
  athleticsModuleLoading: boolean
  canWriteAthletics: boolean
  // Facilities
  facilitiesOpen: boolean
  setFacilitiesOpen: (fn: (prev: boolean) => boolean) => void
  isOnMaintenanceTeam: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canReadInventory: boolean
  facilitiesGateCount: { count: number } | undefined
  // IT
  itOpen: boolean
  setItOpen: (fn: (prev: boolean) => boolean) => void
  isOnITTeam: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canSeeITDevices: boolean
  canSeeITLifecycle: boolean
  canSeeITSecurity: boolean
  canSeeITAdmin: boolean
  // AV
  avOpen: boolean
  setAvOpen: (fn: (prev: boolean) => boolean) => void
  isOnAVTeam: boolean
  canManageWorkspace: boolean
  avGateCount: { count: number } | undefined
}

export default function MainNavContent({
  pathname,
  pageSearchParams,
  organizationName,
  organizationLogoUrl,
  userName,
  userEmail,
  userAvatar,
  isSuperAdmin,
  isImpersonating,
  onLogout,
  onBugDialogOpen,
  onViewAsOpen,
  onSettingsClick,
  onEventsClick,
  onMessagingClick,
  onAthleticsClick,
  setIsOpen,
  setSettingsOpen,
  setAthleticsOpen,
  setEventsOpen,
  setMessagingOpen,
  settingsOpen,
  athleticsOpen,
  eventsOpen,
  messagingOpen,
  messagingEnabled,
  messagingModuleLoading,
  athleticsEnabled,
  athleticsModuleLoading,
  canWriteAthletics,
  facilitiesOpen,
  setFacilitiesOpen,
  isOnMaintenanceTeam,
  canManageMaintenance,
  canClaimMaintenance,
  canSubmitMaintenance,
  canReadInventory,
  facilitiesGateCount,
  itOpen,
  setItOpen,
  isOnITTeam,
  canManageIT,
  canSubmitIT,
  canSeeITDevices,
  canSeeITLifecycle,
  canSeeITSecurity,
  canSeeITAdmin,
  avOpen,
  setAvOpen,
  isOnAVTeam,
  canManageWorkspace,
  avGateCount,
}: MainNavContentProps) {
  const queryClient = useQueryClient()
  const athleticsPrefetched = useRef(false)
  const messagingUnread = useMessagingUnread()

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const navItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: FileText, label: 'Forms', href: '/forms' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Organization Logo */}
      <div className="px-4 pt-8 pb-8 flex items-center justify-between">
        <div className="flex-1 min-w-0 flex items-center justify-center">
          {organizationLogoUrl ? (
            <img
              src={organizationLogoUrl}
              alt={`${organizationName || 'Organization'} logo`}
              className="h-10 max-w-[140px] object-contain"
            />
          ) : (
            <span className="text-base font-semibold text-slate-800 truncate">
              {organizationName || 'School'}
            </span>
          )}
        </div>
      </div>

      {/* Global school selector — hidden when org has <= 1 school */}
      <SchoolSelector />

      {/* Spacer below school selector */}
      <div className="pb-4" />

      {/* SVG gradient for active nav icons */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="sidebar-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Navigation Menu */}
      <nav className="p-4 pt-2 flex-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
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
                    setEventsOpen(false)
                    setIsOpen(false)
                  }}
                  className={`relative flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                    active && !settingsOpen && !athleticsOpen && !eventsOpen && !messagingOpen && !facilitiesOpen && !itOpen && !avOpen
                      ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                      : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                  }`}
                  aria-current={active && !settingsOpen && !athleticsOpen && !eventsOpen && !messagingOpen && !facilitiesOpen && !itOpen && !avOpen ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${active && !settingsOpen && !athleticsOpen && !eventsOpen && !messagingOpen && !facilitiesOpen && !itOpen && !avOpen ? 'text-primary-500' : 'text-slate-400'}`} strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </PrefetchLink>
              </li>
            )
          })}
          {/* Events */}
          <li>
            <button
              onClick={() => {
                onEventsClick()
                setIsOpen(false)
              }}
              className={`relative w-full flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                eventsOpen
                  ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                  : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
              }`}
              aria-current={eventsOpen ? 'page' : undefined}
            >
              <CalendarClock className={`w-5 h-5 flex-shrink-0 ${eventsOpen ? 'text-primary-500' : 'text-slate-400'}`} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-sm">Events</span>
            </button>
          </li>
          {/* Messaging */}
          {messagingModuleLoading ? (
            <li>
              <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg animate-pulse">
                <div className="w-5 h-5 rounded bg-white/10 flex-shrink-0" />
                <div className="h-3.5 w-20 rounded bg-white/10" />
              </div>
            </li>
          ) : messagingEnabled ? (
            <li>
              <button
                onClick={onMessagingClick}
                className={`relative w-full flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl cursor-pointer ${
                  messagingOpen
                    ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                    : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                }`}
                aria-current={messagingOpen ? 'page' : undefined}
              >
                <MessageSquare className={`w-5 h-5 flex-shrink-0 ${messagingOpen ? 'text-primary-500' : 'text-slate-400'}`} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm">Messaging</span>
                {messagingUnread > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] px-1" style={{ backgroundColor: '#E8654A' }}>
                    {messagingUnread > 9 ? '9+' : messagingUnread}
                  </span>
                )}
              </button>
            </li>
          ) : null}
          {/* Athletics */}
          {athleticsModuleLoading ? (
            <li>
              <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg animate-pulse">
                <div className="w-5 h-5 rounded bg-white/10 flex-shrink-0" />
                <div className="h-3.5 w-20 rounded bg-white/10" />
              </div>
            </li>
          ) : athleticsEnabled && canWriteAthletics ? (
            <li>
              <button
                onClick={() => {
                  onAthleticsClick()
                  setIsOpen(false)
                }}
                onMouseEnter={() => {
                  if (athleticsPrefetched.current) return
                  athleticsPrefetched.current = true
                  queryClient.prefetchQuery(queryOptions.campuses()).catch(() => {})
                  queryClient.prefetchQuery(queryOptions.modules()).catch(() => {})
                  queryClient.prefetchQuery(queryOptions.calendars()).catch(() => {})
                }}
                className={`relative w-full flex items-center gap-3 px-4 py-3 min-h-[44px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-xl ${
                  athleticsOpen
                    ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                    : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                }`}
                aria-current={athleticsOpen ? 'page' : undefined}
              >
                <Trophy className={`w-5 h-5 flex-shrink-0 ${athleticsOpen ? 'text-primary-500' : 'text-slate-400'}`} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-sm">Athletics</span>
              </button>
            </li>
          ) : null}
        </ul>

        {/* Support section */}
        <SupportSection
          pathname={pathname}
          pageSearchParams={pageSearchParams}
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
          setSettingsOpen={setSettingsOpen}
          setAthleticsOpen={setAthleticsOpen}
          setIsOpen={setIsOpen}
        />
      </nav>

      {/* Footer */}
      <UserMenu
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isSuperAdmin={isSuperAdmin}
        isImpersonating={isImpersonating}
        onSettingsClick={onSettingsClick}
        onLogout={onLogout}
        onBugDialogOpen={onBugDialogOpen}
        onViewAsOpen={onViewAsOpen}
        setIsOpen={setIsOpen}
      />
    </div>
  )
}
