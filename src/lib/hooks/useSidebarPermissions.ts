'use client'

import { useEffect } from 'react'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled'
import { usePendingGateCount } from '@/lib/hooks/useEventProject'

/**
 * Extracted from Sidebar.tsx — shared permission logic for both desktop
 * Sidebar and mobile MobileTabBar. Prevents duplicating 50+ lines of
 * permission derivation.
 */
export function useSidebarPermissions() {
  const { data: perms } = usePermissions()

  // Optimistic role from localStorage (fast render before API response)
  const optimisticRole = (() => {
    if (typeof window === 'undefined') return ''
    return (localStorage.getItem('user-role') || '').toLowerCase()
  })()
  const optimisticIsAdmin = optimisticRole.includes('admin') || optimisticRole.includes('super')
  const optimisticTeamSlugs = (() => {
    if (typeof window === 'undefined') return [] as string[]
    try { return JSON.parse(localStorage.getItem('user-team-slugs') || '[]') as string[] }
    catch { return [] as string[] }
  })()

  // Persist team slugs for next optimistic render
  useEffect(() => {
    if (perms?.userTeams) {
      const slugs = perms.userTeams.map((t) => t.slug)
      localStorage.setItem('user-team-slugs', JSON.stringify(slugs))
    }
  }, [perms?.userTeams])

  const canManageWorkspace = perms?.canManageWorkspace ?? optimisticIsAdmin
  const canManageMaintenance = perms?.canManageMaintenance ?? optimisticIsAdmin
  const canClaimMaintenance = perms?.canClaimMaintenance ?? optimisticIsAdmin
  const canSubmitMaintenance = perms?.canSubmitMaintenance ?? true
  const canManageIT = perms?.canManageIT ?? optimisticIsAdmin
  const canSubmitIT = perms?.canSubmitIT ?? true
  const canReadDevices = perms?.canReadDevices ?? optimisticIsAdmin
  const canReadStudents = perms?.canReadStudents ?? optimisticIsAdmin
  const canAccessLoaners = (perms?.canManageLoaners ?? false) || (perms?.canCheckoutLoaner ?? false) || (perms?.canCheckinLoaner ?? false)
  const canAccessDeployment = (perms?.canManageDeployment ?? false) || (perms?.canProcessDeployment ?? false)
  const canAccessProvisioning = (perms?.canManageProvisioning ?? false) || (perms?.canViewProvisioning ?? false)
  const canViewContentFilters = (perms?.canViewCIPAAudit ?? false) || (perms?.canConfigureFilters ?? false) || (perms?.canManageFilters ?? false)
  const canViewSecurityIncidents = perms?.canViewSecurityIncidents ?? false
  const canViewIntelligence = perms?.canViewIntelligence ?? false
  const canViewITAnalytics = perms?.canViewITAnalytics ?? false
  const canViewITBoardReports = perms?.canViewITBoardReports ?? false
  const canViewERate = (perms?.canManageERate ?? false) || (perms?.canViewERate ?? false)
  const canManageSync = perms?.canManageSync ?? false
  const canSeeITDevices = canReadDevices || canReadStudents || canAccessLoaners
  const canSeeITLifecycle = canAccessDeployment || canAccessProvisioning || canManageIT
  const canSeeITSecurity = canViewContentFilters || canViewSecurityIncidents || canViewIntelligence
  const canSeeITAdmin = canViewITAnalytics || canViewITBoardReports || canViewERate || canManageSync
  const canReadInventory = perms?.canReadInventory ?? optimisticIsAdmin

  const isOnMaintenanceTeam = perms ? isOnTeam(perms, 'maintenance') : optimisticTeamSlugs.includes('maintenance')
  const isOnITTeam = perms ? isOnTeam(perms, 'it-support') : optimisticTeamSlugs.includes('it-support')
  const isOnAVTeam = perms ? isOnTeam(perms, 'av-production') : optimisticTeamSlugs.includes('av-production')

  const canApproveFacilitiesGate = isOnMaintenanceTeam || canManageMaintenance
  const canApproveAVGate = isOnAVTeam || canManageWorkspace
  const { data: facilitiesGateCount } = usePendingGateCount('facilities', canApproveFacilitiesGate)
  const { data: avGateCount } = usePendingGateCount('av', canApproveAVGate)

  const { enabled: athleticsEnabled, loading: athleticsModuleLoading } = useModuleEnabled('athletics')
  const canWriteAthletics = perms?.canWriteAthletics ?? optimisticIsAdmin

  // Derived: does the user have ANY support section access?
  const showFacilities = isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance || canSubmitMaintenance
  const showIT = isOnITTeam || canManageIT || canSubmitIT
  const showAV = isOnAVTeam || canManageWorkspace
  const hasAnySupportAccess = showFacilities || showIT || showAV

  return {
    // Workspace
    canManageWorkspace,
    // Facilities
    canManageMaintenance,
    canClaimMaintenance,
    canSubmitMaintenance,
    canReadInventory,
    isOnMaintenanceTeam,
    facilitiesGateCount,
    showFacilities,
    // IT
    canManageIT,
    canSubmitIT,
    canSeeITDevices,
    canSeeITLifecycle,
    canSeeITSecurity,
    canSeeITAdmin,
    isOnITTeam,
    showIT,
    // AV
    isOnAVTeam,
    avGateCount,
    showAV,
    // Athletics
    athleticsEnabled,
    athleticsModuleLoading,
    canWriteAthletics,
    // Derived
    hasAnySupportAccess,
    // For Sidebar compatibility (pass-through)
    canReadDevices,
    canReadStudents,
    canAccessLoaners,
    canAccessDeployment,
    canAccessProvisioning,
    canViewContentFilters,
    canViewSecurityIncidents,
    canViewIntelligence,
    canViewITAnalytics,
    canViewITBoardReports,
    canViewERate,
    canManageSync,
    isSuperAdmin: optimisticIsAdmin,
  }
}
