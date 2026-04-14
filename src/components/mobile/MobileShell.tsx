'use client'

import { type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import MobileTabBar from './MobileTabBar'
import MobileHeader from './MobileHeader'
import { MobileHeaderProvider } from './MobileHeaderContext'
import PullToRefresh from './PullToRefresh'
import MobilePageTransition from './MobilePageTransition'
import { useSidebarPermissions } from '@/lib/hooks/useSidebarPermissions'

interface MobileShellProps {
  children: ReactNode
  userName?: string
  userEmail?: string
  userAvatar?: string | null
  onLogout?: () => void
  onSearchOpen: () => void
}

/**
 * Single entry point for all mobile-specific UI. Lazy-loaded so the entire
 * mobile bundle (tab bar, sheets, pull-to-refresh, page transitions) is
 * code-split away from the desktop path.
 */
export default function MobileShell({
  children,
  userName,
  userEmail,
  userAvatar,
  onLogout,
  onSearchOpen,
}: MobileShellProps) {
  const queryClient = useQueryClient()
  const perms = useSidebarPermissions()

  return (
    <MobileHeaderProvider>
      {/* Header */}
      <MobileHeader
        onSearchOpen={onSearchOpen}
        userAvatar={userAvatar}
        userName={userName}
      />

      {/* Scrollable content with pull-to-refresh */}
      <PullToRefresh onRefresh={async () => { await queryClient.invalidateQueries() }}>
        <div className="relative pl-4 pr-4 flex flex-col min-h-full pt-[calc(44px+var(--safe-area-top)+8px)] pb-[calc(56px+var(--safe-area-bottom)+16px)]">
          <MobilePageTransition>
            {children}
          </MobilePageTransition>
        </div>
      </PullToRefresh>

      {/* Tab bar */}
      <MobileTabBar
        athleticsEnabled={perms.athleticsEnabled}
        canWriteAthletics={perms.canWriteAthletics}
        showFacilities={perms.showFacilities}
        showIT={perms.showIT}
        showAV={perms.showAV}
        hasAnySupportAccess={perms.hasAnySupportAccess}
        facilitiesGateCount={perms.facilitiesGateCount}
        avGateCount={perms.avGateCount}
        canManageMaintenance={perms.canManageMaintenance}
        canClaimMaintenance={perms.canClaimMaintenance}
        canSubmitMaintenance={perms.canSubmitMaintenance}
        canReadInventory={perms.canReadInventory}
        isOnMaintenanceTeam={perms.isOnMaintenanceTeam}
        canManageIT={perms.canManageIT}
        canSubmitIT={perms.canSubmitIT}
        canSeeITDevices={perms.canSeeITDevices}
        isOnITTeam={perms.isOnITTeam}
        isOnAVTeam={perms.isOnAVTeam}
        canManageWorkspace={perms.canManageWorkspace}
        userName={userName || 'User'}
        userEmail={userEmail || ''}
        userAvatar={userAvatar || undefined}
        isSuperAdmin={perms.isSuperAdmin}
        onLogout={onLogout}
      />
    </MobileHeaderProvider>
  )
}
