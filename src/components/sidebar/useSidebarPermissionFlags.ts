'use client'

/**
 * Audit ref H5: extracted from Sidebar.tsx.
 *
 * Returns the flattened permission flags the sidebar needs, falling back to
 * `localStorage.user-role` + `user-team-slugs` for the brief window between
 * first paint and when the real permissions payload lands. The optimistic
 * pass keeps the sidebar from flashing "no access" for a user who does have
 * access.
 */

import { useEffect, useState } from 'react'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { usePendingGateCount } from '@/lib/hooks/useEventProject'

export interface SidebarPermissionFlags {
  isSuperAdmin: boolean
  canManageWorkspace: boolean
  canManageForms: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canReadInventory: boolean
  canWriteAthletics: boolean
  canSeeITDevices: boolean
  canSeeITLifecycle: boolean
  canSeeITSecurity: boolean
  canSeeITAdmin: boolean
  isOnMaintenanceTeam: boolean
  isOnITTeam: boolean
  isOnAVTeam: boolean
  facilitiesGateCount: { count: number } | undefined
  avGateCount: { count: number } | undefined
}

function readOptimisticRole(): string {
  if (typeof window === 'undefined') return ''
  return (localStorage.getItem('user-role') || '').toLowerCase()
}

function readOptimisticTeamSlugs(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('user-team-slugs') || '[]') as string[]
  } catch {
    return []
  }
}

export function useSidebarPermissionFlags(): SidebarPermissionFlags {
  const { data: perms } = usePermissions()
  const [loadBadgeCounts, setLoadBadgeCounts] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setLoadBadgeCounts(true), 10_000)
    return () => window.clearTimeout(timeout)
  }, [])

  const optimisticRole = readOptimisticRole()
  const optimisticIsAdmin =
    optimisticRole.includes('admin') || optimisticRole.includes('super')
  const optimisticTeamSlugs = readOptimisticTeamSlugs()

  // Persist canonical team slugs from the real perms payload so next load
  // hydrates with the right optimistic team membership.
  useEffect(() => {
    if (perms?.userTeams) {
      const slugs = perms.userTeams.map((t) => t.slug)
      localStorage.setItem('user-team-slugs', JSON.stringify(slugs))
    }
  }, [perms?.userTeams])

  const isSuperAdmin = perms?.isSuperAdmin ?? (optimisticRole === 'super-admin')
  const canManageWorkspace = perms?.canManageWorkspace ?? optimisticIsAdmin
  const canManageForms = perms?.canManageForms ?? optimisticIsAdmin
  const canManageMaintenance = perms?.canManageMaintenance ?? optimisticIsAdmin
  const canClaimMaintenance = perms?.canClaimMaintenance ?? optimisticIsAdmin
  const canSubmitMaintenance = perms?.canSubmitMaintenance ?? true
  const canManageIT = perms?.canManageIT ?? optimisticIsAdmin
  const canSubmitIT = perms?.canSubmitIT ?? true
  const canReadDevices = perms?.canReadDevices ?? optimisticIsAdmin
  const canReadStudents = perms?.canReadStudents ?? optimisticIsAdmin
  const canReadInventory = perms?.canReadInventory ?? optimisticIsAdmin

  const canAccessLoaners =
    (perms?.canManageLoaners ?? false) ||
    (perms?.canCheckoutLoaner ?? false) ||
    (perms?.canCheckinLoaner ?? false)
  const canAccessDeployment =
    (perms?.canManageDeployment ?? false) || (perms?.canProcessDeployment ?? false)
  const canAccessProvisioning =
    (perms?.canManageProvisioning ?? false) || (perms?.canViewProvisioning ?? false)
  const canViewContentFilters =
    (perms?.canViewCIPAAudit ?? false) ||
    (perms?.canConfigureFilters ?? false) ||
    (perms?.canManageFilters ?? false)
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

  const isOnMaintenanceTeam = perms
    ? isOnTeam(perms, 'maintenance')
    : optimisticTeamSlugs.includes('maintenance')
  const isOnITTeam = perms
    ? isOnTeam(perms, 'it-support')
    : optimisticTeamSlugs.includes('it-support')
  const isOnAVTeam = perms
    ? isOnTeam(perms, 'av-production')
    : optimisticTeamSlugs.includes('av-production')

  const canApproveFacilitiesGate = isOnMaintenanceTeam || canManageMaintenance
  const canApproveAVGate = isOnAVTeam || canManageWorkspace
  const { data: facilitiesGateCount } = usePendingGateCount('facilities', loadBadgeCounts && canApproveFacilitiesGate)
  const { data: avGateCount } = usePendingGateCount('av', loadBadgeCounts && canApproveAVGate)

  return {
    isSuperAdmin,
    canManageWorkspace,
    canManageForms,
    canManageMaintenance,
    canClaimMaintenance,
    canSubmitMaintenance,
    canManageIT,
    canSubmitIT,
    canReadInventory,
    // Athletics: show only for users with an athletics-specific role (not plain admins)
    canWriteAthletics: perms
      ? perms.canWriteAthletics && perms.legacyRole !== 'ADMIN'
      : false,
    canSeeITDevices,
    canSeeITLifecycle,
    canSeeITSecurity,
    canSeeITAdmin,
    isOnMaintenanceTeam,
    isOnITTeam,
    isOnAVTeam,
    facilitiesGateCount,
    avGateCount,
  }
}
