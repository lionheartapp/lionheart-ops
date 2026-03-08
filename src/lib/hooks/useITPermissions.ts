'use client'

import { usePermissions } from '@/lib/hooks/usePermissions'

export function useITPermissions() {
  const { data: perms } = usePermissions()

  const canManageLoaners = perms?.canManageLoaners ?? false
  const canCheckoutLoaner = perms?.canCheckoutLoaner ?? false
  const canCheckinLoaner = perms?.canCheckinLoaner ?? false
  const canAccessLoaners = canManageLoaners || canCheckoutLoaner || canCheckinLoaner

  const canManageDeployment = perms?.canManageDeployment ?? false
  const canProcessDeployment = perms?.canProcessDeployment ?? false
  const canAccessDeployment = canManageDeployment || canProcessDeployment

  const canManageProvisioning = perms?.canManageProvisioning ?? false
  const canViewProvisioning = perms?.canViewProvisioning ?? false
  const canAccessProvisioning = canManageProvisioning || canViewProvisioning

  const canManageERate = perms?.canManageERate ?? false
  const canViewERate = canManageERate || (perms?.canViewERate ?? false)

  const canViewCIPAAudit = perms?.canViewCIPAAudit ?? false
  const canConfigureFilters = perms?.canConfigureFilters ?? false
  const canManageFilters = perms?.canManageFilters ?? false
  const canViewContentFilters = canViewCIPAAudit || canConfigureFilters || canManageFilters

  return {
    loaded: !!perms,
    // Core IT
    canManage: perms?.canManageIT ?? false,
    canSubmit: perms?.canSubmitIT ?? false,
    // Devices
    canReadDevices: perms?.canReadDevices ?? false,
    canManageDevices: perms?.canManageDevices ?? false,
    // Students
    canReadStudents: perms?.canReadStudents ?? false,
    canManageStudents: perms?.canManageStudents ?? false,
    // Loaners
    canManageLoaners,
    canCheckoutLoaner,
    canCheckinLoaner,
    canAccessLoaners,
    // Sync
    canManageSync: perms?.canManageSync ?? false,
    // Intelligence
    canViewIntelligence: perms?.canViewIntelligence ?? false,
    canConfigureDevices: perms?.canConfigureDevices ?? false,
    // Deployment
    canManageDeployment,
    canProcessDeployment,
    canAccessDeployment,
    // Provisioning
    canManageProvisioning,
    canViewProvisioning,
    canAccessProvisioning,
    // Analytics & Reports
    canViewITAnalytics: perms?.canViewITAnalytics ?? false,
    canViewITBoardReports: perms?.canViewITBoardReports ?? false,
    // E-Rate
    canManageERate,
    canViewERate,
    // Content Filters
    canViewCIPAAudit,
    canConfigureFilters,
    canManageFilters,
    canViewContentFilters,
    // Security Incidents
    canViewSecurityIncidents: perms?.canViewSecurityIncidents ?? false,
    canCreateSecurityIncident: perms?.canCreateSecurityIncident ?? false,
    canManageSecurityIncidents: perms?.canManageSecurityIncidents ?? false,
  }
}
