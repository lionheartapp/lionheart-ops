'use client'

import { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home,
  CalendarClock,
  Wrench,
  Settings,
  Trophy,
} from 'lucide-react'
import { haptic } from '@/lib/haptics'
import SupportSheet from './SupportSheet'
import ProfileSheet from './ProfileSheet'
import EventsSheet from './EventsSheet'
import SettingsSheet from './SettingsSheet'
import AthleticsSheet from './AthleticsSheet'

interface MobileTabBarProps {
  // Athletics
  athleticsEnabled: boolean
  canWriteAthletics: boolean
  // Support visibility
  showFacilities: boolean
  showIT: boolean
  showAV: boolean
  hasAnySupportAccess: boolean
  // Counts
  facilitiesGateCount?: { count: number }
  avGateCount?: { count: number }
  // Support sub-permissions
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canReadInventory: boolean
  isOnMaintenanceTeam: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canSeeITDevices: boolean
  isOnITTeam: boolean
  isOnAVTeam: boolean
  canManageWorkspace: boolean
  // User info
  userName: string
  userEmail: string
  userAvatar?: string
  isSuperAdmin: boolean
  onLogout?: () => void
}

type SheetAction = 'support' | 'profile' | 'events' | 'settings' | 'athletics'

interface TabItem {
  id: string
  icon: typeof Home
  label: string
  href?: string
  action?: SheetAction
  /** Route prefixes that make this tab show as active */
  activeRoutes?: string[]
}

export default function MobileTabBar({
  athleticsEnabled,
  canWriteAthletics,
  showFacilities,
  showIT,
  showAV,
  hasAnySupportAccess,
  facilitiesGateCount,
  avGateCount,
  canManageMaintenance,
  canClaimMaintenance,
  canSubmitMaintenance,
  canReadInventory,
  isOnMaintenanceTeam,
  canManageIT,
  canSubmitIT,
  canSeeITDevices,
  isOnITTeam,
  isOnAVTeam,
  canManageWorkspace,
  userName,
  userEmail,
  userAvatar,
  isSuperAdmin,
  onLogout,
}: MobileTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [openSheet, setOpenSheet] = useState<SheetAction | null>(null)

  // Build tab list dynamically based on permissions
  const tabs: TabItem[] = [
    { id: 'home', icon: Home, label: 'Home', href: '/dashboard' },
    {
      id: 'events',
      icon: CalendarClock,
      label: 'Events',
      action: 'events',
      activeRoutes: ['/events', '/calendar', '/planning'],
    },
  ]

  // Athletics takes a tab slot when enabled
  if (athleticsEnabled && canWriteAthletics) {
    tabs.push({
      id: 'athletics',
      icon: Trophy,
      label: 'Athletics',
      action: 'athletics',
      activeRoutes: ['/athletics'],
    })
  }

  // Support tab (opens bottom sheet)
  if (hasAnySupportAccess) {
    tabs.push({
      id: 'support',
      icon: Wrench,
      label: 'Support',
      action: 'support',
      activeRoutes: ['/maintenance', '/it', '/facilities'],
    })
  }

  // Settings (opens bottom sheet with all tabs)
  tabs.push({
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    action: 'settings',
    activeRoutes: ['/settings'],
  })

  const isActive = useCallback(
    (tab: TabItem): boolean => {
      if (tab.id === 'home') return pathname === '/dashboard' || pathname === '/'
      if (tab.activeRoutes) {
        return tab.activeRoutes.some((r) => pathname.startsWith(r))
      }
      if (tab.href) return pathname.startsWith(tab.href)
      return false
    },
    [pathname],
  )

  const totalBadgeCount = (facilitiesGateCount?.count ?? 0) + (avGateCount?.count ?? 0)

  const handleTabPress = (tab: TabItem) => {
    haptic('light')
    if (tab.action) {
      setOpenSheet(tab.action)
    } else if (tab.href) {
      router.push(tab.href)
    }
  }

  return (
    <>
      {/* Tab Bar */}
      <nav
        className="mobile-tab-bar lg:hidden fixed bottom-0 inset-x-0 z-mobilenav"
        style={{
          background: 'rgba(253, 252, 249, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(17, 15, 10, 0.06)',
          paddingBottom: 'var(--safe-area-bottom)',
        }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* SVG gradient definition for active tab icons */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <linearGradient id="tab-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>

        <div className="flex items-center justify-around h-14">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab)

            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab)}
                className="relative flex flex-col items-center justify-center flex-1 h-full min-w-[44px] min-h-[44px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-lg transition-colors"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative">
                  <Icon
                    className="w-[22px] h-[22px]"
                    style={active ? { stroke: 'url(#tab-icon-gradient)' } : undefined}
                    strokeWidth={active ? 2.2 : 1.8}
                    aria-hidden="true"
                  />
                  {/* Badge for support tab */}
                  {tab.id === 'support' && totalBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary-500 text-white">
                      {totalBadgeCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 leading-tight ${
                    active ? 'font-semibold text-primary-600' : 'font-medium text-slate-400'
                  }`}
                >
                  {tab.label}
                </span>
                {/* Active indicator dot */}
                {active && (
                  <motion.div
                    layoutId="mobile-tab-indicator"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                    style={{ background: 'linear-gradient(90deg, #3B82F6, #6366F1)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Events Bottom Sheet */}
      <EventsSheet
        open={openSheet === 'events'}
        onClose={() => setOpenSheet(null)}
      />

      {/* Athletics Bottom Sheet */}
      {athleticsEnabled && canWriteAthletics && (
        <AthleticsSheet
          open={openSheet === 'athletics'}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {/* Support Bottom Sheet */}
      <SupportSheet
        open={openSheet === 'support'}
        onClose={() => setOpenSheet(null)}
        showFacilities={showFacilities}
        showIT={showIT}
        showAV={showAV}
        facilitiesGateCount={facilitiesGateCount}
        avGateCount={avGateCount}
        canManageMaintenance={canManageMaintenance}
        canClaimMaintenance={canClaimMaintenance}
        canSubmitMaintenance={canSubmitMaintenance}
        canReadInventory={canReadInventory}
        isOnMaintenanceTeam={isOnMaintenanceTeam}
        canManageIT={canManageIT}
        canSubmitIT={canSubmitIT}
        canSeeITDevices={canSeeITDevices}
        isOnITTeam={isOnITTeam}
        isOnAVTeam={isOnAVTeam}
        canManageWorkspace={canManageWorkspace}
      />

      {/* Settings Bottom Sheet */}
      <SettingsSheet
        open={openSheet === 'settings'}
        onClose={() => setOpenSheet(null)}
        canManageWorkspace={canManageWorkspace}
      />

      {/* Profile Bottom Sheet */}
      <ProfileSheet
        open={openSheet === 'profile'}
        onClose={() => setOpenSheet(null)}
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        isSuperAdmin={isSuperAdmin}
        onLogout={onLogout}
      />
    </>
  )
}
