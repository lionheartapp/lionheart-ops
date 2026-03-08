import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { can, canAny, getLegacyRole } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const WORKSPACE_MANAGE_PERMISSIONS = [
  PERMISSIONS.ROLES_CREATE,
  PERMISSIONS.ROLES_UPDATE,
  PERMISSIONS.ROLES_DELETE,
  PERMISSIONS.TEAMS_CREATE,
  PERMISSIONS.TEAMS_UPDATE,
  PERMISSIONS.TEAMS_DELETE,
  PERMISSIONS.USERS_MANAGE_ROLES,
  PERMISSIONS.USERS_INVITE,
  PERMISSIONS.SETTINGS_UPDATE,
]

const ATHLETICS_WRITE_PERMISSIONS = [
  PERMISSIONS.ATHLETICS_MANAGE,
  PERMISSIONS.ATHLETICS_TEAMS_MANAGE,
  PERMISSIONS.ATHLETICS_GAMES_CREATE,
  PERMISSIONS.ATHLETICS_PRACTICES_CREATE,
  PERMISSIONS.ATHLETICS_ROSTER_MANAGE,
  PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE,
  PERMISSIONS.ATHLETICS_STATS_MANAGE,
]

export async function GET(req: NextRequest) {
  try {
    const userContext = await getUserContext(req)

    const [
      canManageWorkspace,
      canWriteAthletics,
      canManageUsers,
      canManageMaintenance,
      canClaimMaintenance,
      canSubmitMaintenance,
      canApproveQA,
      canManageIT,
      canSubmitIT,
      canManageDevices,
      canReadDevices,
      canManageStudents,
      canReadStudents,
      canReadStudentsOwnSchool,
      canManageLoaners,
      canCheckoutLoaner,
      canCheckinLoaner,
      canManageSync,
      canViewIntelligence,
      canConfigureDevices,
      canManageDeployment,
      canProcessDeployment,
      canManageSummer,
      canManageRepairQueue,
      canAssessDamage,
      canExportDamage,
      canConfigureMdm,
      canSyncMdm,
      canManageStudentPassword,
      canRunAIDiagnostic,
      canManageProvisioning,
      canViewProvisioning,
      canGenerateQR,
      canViewITAnalytics,
      canViewITBoardReports,
      canManageERate,
      canViewERate,
      canViewCIPAAudit,
      canManageCIPAAudit,
      canConfigureFilters,
      canManageFilters,
      canViewSecurityIncidents,
      canCreateSecurityIncident,
      canManageSecurityIncidents,
    ] = await Promise.all([
      canAny(userContext.userId, WORKSPACE_MANAGE_PERMISSIONS),
      canAny(userContext.userId, ATHLETICS_WRITE_PERMISSIONS),
      can(userContext.userId, PERMISSIONS.USERS_READ),
      can(userContext.userId, PERMISSIONS.MAINTENANCE_READ_ALL),
      can(userContext.userId, PERMISSIONS.MAINTENANCE_CLAIM),
      can(userContext.userId, PERMISSIONS.MAINTENANCE_SUBMIT),
      can(userContext.userId, PERMISSIONS.MAINTENANCE_APPROVE_QA),
      can(userContext.userId, PERMISSIONS.IT_TICKET_READ_ALL),
      can(userContext.userId, PERMISSIONS.IT_TICKET_SUBMIT),
      can(userContext.userId, PERMISSIONS.IT_DEVICE_CREATE),
      can(userContext.userId, PERMISSIONS.IT_DEVICE_READ),
      can(userContext.userId, PERMISSIONS.STUDENTS_MANAGE),
      can(userContext.userId, PERMISSIONS.STUDENTS_READ),
      can(userContext.userId, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL),
      can(userContext.userId, PERMISSIONS.IT_LOANER_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_LOANER_CHECKOUT),
      can(userContext.userId, PERMISSIONS.IT_LOANER_CHECKIN),
      can(userContext.userId, PERMISSIONS.IT_DEVICE_SYNC),
      can(userContext.userId, PERMISSIONS.IT_DEVICE_INTELLIGENCE),
      can(userContext.userId, PERMISSIONS.IT_DEVICE_CONFIGURE),
      // Device Lifecycle permissions
      can(userContext.userId, PERMISSIONS.IT_DEPLOYMENT_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_DEPLOYMENT_PROCESS),
      can(userContext.userId, PERMISSIONS.IT_SUMMER_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_DAMAGE_ASSESS),
      can(userContext.userId, PERMISSIONS.IT_DAMAGE_EXPORT),
      can(userContext.userId, PERMISSIONS.IT_MDM_CONFIGURE),
      can(userContext.userId, PERMISSIONS.IT_MDM_SYNC),
      can(userContext.userId, PERMISSIONS.IT_STUDENT_PASSWORD),
      can(userContext.userId, PERMISSIONS.IT_AI_DIAGNOSTIC),
      // Account Provisioning
      can(userContext.userId, PERMISSIONS.IT_PROVISIONING_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_PROVISIONING_VIEW),
      can(userContext.userId, PERMISSIONS.IT_QR_GENERATE),
      // IT Analytics & Reports
      can(userContext.userId, PERMISSIONS.IT_ANALYTICS_READ),
      can(userContext.userId, PERMISSIONS.IT_REPORTS_BOARD),
      // E-Rate + Content Filter
      can(userContext.userId, PERMISSIONS.IT_ERATE_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_ERATE_VIEW),
      can(userContext.userId, PERMISSIONS.IT_CIPA_AUDIT_VIEW),
      can(userContext.userId, PERMISSIONS.IT_CIPA_AUDIT_MANAGE),
      can(userContext.userId, PERMISSIONS.IT_FILTERS_CONFIGURE),
      can(userContext.userId, PERMISSIONS.IT_FILTERS_MANAGE),
      // Security Incidents
      can(userContext.userId, PERMISSIONS.IT_INCIDENT_READ),
      can(userContext.userId, PERMISSIONS.IT_INCIDENT_CREATE),
      can(userContext.userId, PERMISSIONS.IT_INCIDENT_MANAGE),
    ])

    const legacyRole = await getLegacyRole(userContext.userId)

    return NextResponse.json(
      ok({
        canManageWorkspace,
        canWriteAthletics,
        canManageUsers,
        canManageMaintenance,
        canClaimMaintenance,
        canSubmitMaintenance,
        canApproveQA,
        canManageIT,
        canSubmitIT,
        canManageDevices,
        canReadDevices,
        canManageStudents,
        canReadStudents: canReadStudents || canReadStudentsOwnSchool,
        canManageLoaners,
        canCheckoutLoaner,
        canCheckinLoaner,
        canManageSync,
        canViewIntelligence,
        canConfigureDevices,
        // Device Lifecycle
        canManageDeployment,
        canProcessDeployment,
        canManageSummer,
        canManageRepairQueue,
        canAssessDamage,
        canExportDamage,
        canConfigureMdm,
        canSyncMdm,
        canManageStudentPassword,
        canRunAIDiagnostic,
        // Account Provisioning
        canManageProvisioning,
        canViewProvisioning,
        canGenerateQR,
        // E-Rate + Content Filter
        canManageERate,
        canViewERate,
        canViewCIPAAudit,
        canManageCIPAAudit,
        canConfigureFilters,
        canManageFilters,
        canViewSecurityIncidents,
        canCreateSecurityIncident,
        canManageSecurityIncidents,
        legacyRole,
      })
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('authorization') ||
        error.message.includes('token') ||
        error.message.includes('User not found'))
    ) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Unauthorized'), { status: 401 })
    }

    console.error('Failed to fetch auth permissions:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch auth permissions'),
      { status: 500 }
    )
  }
}
