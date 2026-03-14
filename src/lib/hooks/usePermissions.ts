'use client'

import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'

interface UserTeam {
  id: string
  slug: string
  name: string
}

interface Permissions {
  canManageWorkspace: boolean
  canWriteAthletics: boolean
  canManageUsers: boolean
  canManageMaintenance: boolean
  canClaimMaintenance: boolean
  canSubmitMaintenance: boolean
  canApproveQA: boolean
  canManageIT: boolean
  canSubmitIT: boolean
  canManageDevices: boolean
  canReadDevices: boolean
  canManageStudents: boolean
  canReadStudents: boolean
  canManageLoaners: boolean
  canCheckoutLoaner: boolean
  canCheckinLoaner: boolean
  canManageSync: boolean
  canViewIntelligence: boolean
  canConfigureDevices: boolean
  // Device Lifecycle
  canManageDeployment: boolean
  canProcessDeployment: boolean
  canManageSummer: boolean
  canManageRepairQueue: boolean
  canAssessDamage: boolean
  canExportDamage: boolean
  canConfigureMdm: boolean
  canSyncMdm: boolean
  canManageStudentPassword: boolean
  canRunAIDiagnostic: boolean
  // Account Provisioning
  canManageProvisioning: boolean
  canViewProvisioning: boolean
  canGenerateQR: boolean
  // IT Analytics & Reports
  canViewITAnalytics: boolean
  canViewITBoardReports: boolean
  // E-Rate + Content Filter
  canManageERate: boolean
  canViewERate: boolean
  canViewCIPAAudit: boolean
  canManageCIPAAudit: boolean
  canConfigureFilters: boolean
  canManageFilters: boolean
  canViewSecurityIncidents: boolean
  canCreateSecurityIncident: boolean
  canManageSecurityIncidents: boolean
  canReadInventory: boolean
  canWriteInventory: boolean
  legacyRole: string | null
  userTeams: UserTeam[]
}

/**
 * Check if user is on a team by slug (client-side, no DB call)
 */
export function isOnTeam(perms: Permissions | undefined, slug: string): boolean {
  return perms?.userTeams?.some((t) => t.slug === slug) ?? false
}

export function usePermissions() {
  const opts = queryOptions.permissions()
  return useQuery<Permissions>({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn as () => Promise<Permissions>,
    staleTime: opts.staleTime,
  })
}
