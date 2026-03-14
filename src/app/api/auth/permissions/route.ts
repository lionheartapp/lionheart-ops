import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getUserPermissions, getUserTeamDetails, canSync, canAnySync } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { matchesPermission } from '@/lib/permissions'

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

    // Single DB query — all permission checks run in-memory against this array
    const [perms, userTeams] = await Promise.all([
      getUserPermissions(userContext.userId),
      getUserTeamDetails(userContext.userId),
    ])

    // Helper for legacy role (runs against same array, no extra DB call)
    let legacyRole = 'VIEWER'
    if (perms.includes('*:*')) {
      legacyRole = 'SUPER_ADMIN'
    } else if (
      perms.some((p) => matchesPermission(p, 'users:manage:roles')) &&
      perms.some((p) => matchesPermission(p, 'events:approve'))
    ) {
      legacyRole = 'ADMIN'
    } else if (perms.some((p) => matchesPermission(p, 'tickets:assign'))) {
      legacyRole = 'OPERATIONS'
    }

    const canReadStudents = canSync(perms, PERMISSIONS.STUDENTS_READ)
    const canReadStudentsOwnSchool = canSync(perms, PERMISSIONS.STUDENTS_READ_OWN_SCHOOL)

    return NextResponse.json(
      ok({
        canManageWorkspace: canAnySync(perms, WORKSPACE_MANAGE_PERMISSIONS),
        canWriteAthletics: canAnySync(perms, ATHLETICS_WRITE_PERMISSIONS),
        canManageUsers: canSync(perms, PERMISSIONS.USERS_READ),
        canManageMaintenance: canSync(perms, PERMISSIONS.MAINTENANCE_READ_ALL),
        canClaimMaintenance: canSync(perms, PERMISSIONS.MAINTENANCE_CLAIM),
        canSubmitMaintenance: canSync(perms, PERMISSIONS.MAINTENANCE_SUBMIT),
        canApproveQA: canSync(perms, PERMISSIONS.MAINTENANCE_APPROVE_QA),
        canManageIT: canSync(perms, PERMISSIONS.IT_TICKET_READ_ALL),
        canSubmitIT: canSync(perms, PERMISSIONS.IT_TICKET_SUBMIT),
        canManageDevices: canSync(perms, PERMISSIONS.IT_DEVICE_CREATE),
        canReadDevices: canSync(perms, PERMISSIONS.IT_DEVICE_READ),
        canManageStudents: canSync(perms, PERMISSIONS.STUDENTS_MANAGE),
        canReadStudents: canReadStudents || canReadStudentsOwnSchool,
        canManageLoaners: canSync(perms, PERMISSIONS.IT_LOANER_MANAGE),
        canCheckoutLoaner: canSync(perms, PERMISSIONS.IT_LOANER_CHECKOUT),
        canCheckinLoaner: canSync(perms, PERMISSIONS.IT_LOANER_CHECKIN),
        canManageSync: canSync(perms, PERMISSIONS.IT_DEVICE_SYNC),
        canViewIntelligence: canSync(perms, PERMISSIONS.IT_DEVICE_INTELLIGENCE),
        canConfigureDevices: canSync(perms, PERMISSIONS.IT_DEVICE_CONFIGURE),
        // Device Lifecycle
        canManageDeployment: canSync(perms, PERMISSIONS.IT_DEPLOYMENT_MANAGE),
        canProcessDeployment: canSync(perms, PERMISSIONS.IT_DEPLOYMENT_PROCESS),
        canManageSummer: canSync(perms, PERMISSIONS.IT_SUMMER_MANAGE),
        canManageRepairQueue: canSync(perms, PERMISSIONS.IT_REPAIR_QUEUE_MANAGE),
        canAssessDamage: canSync(perms, PERMISSIONS.IT_DAMAGE_ASSESS),
        canExportDamage: canSync(perms, PERMISSIONS.IT_DAMAGE_EXPORT),
        canConfigureMdm: canSync(perms, PERMISSIONS.IT_MDM_CONFIGURE),
        canSyncMdm: canSync(perms, PERMISSIONS.IT_MDM_SYNC),
        canManageStudentPassword: canSync(perms, PERMISSIONS.IT_STUDENT_PASSWORD),
        canRunAIDiagnostic: canSync(perms, PERMISSIONS.IT_AI_DIAGNOSTIC),
        // Account Provisioning
        canManageProvisioning: canSync(perms, PERMISSIONS.IT_PROVISIONING_MANAGE),
        canViewProvisioning: canSync(perms, PERMISSIONS.IT_PROVISIONING_VIEW),
        canGenerateQR: canSync(perms, PERMISSIONS.IT_QR_GENERATE),
        // IT Analytics & Reports
        canViewITAnalytics: canSync(perms, PERMISSIONS.IT_ANALYTICS_READ),
        canViewITBoardReports: canSync(perms, PERMISSIONS.IT_REPORTS_BOARD),
        // E-Rate + Content Filter
        canManageERate: canSync(perms, PERMISSIONS.IT_ERATE_MANAGE),
        canViewERate: canSync(perms, PERMISSIONS.IT_ERATE_VIEW),
        canViewCIPAAudit: canSync(perms, PERMISSIONS.IT_CIPA_AUDIT_VIEW),
        canManageCIPAAudit: canSync(perms, PERMISSIONS.IT_CIPA_AUDIT_MANAGE),
        canConfigureFilters: canSync(perms, PERMISSIONS.IT_FILTERS_CONFIGURE),
        canManageFilters: canSync(perms, PERMISSIONS.IT_FILTERS_MANAGE),
        // Security Incidents
        canViewSecurityIncidents: canSync(perms, PERMISSIONS.IT_INCIDENT_READ),
        canCreateSecurityIncident: canSync(perms, PERMISSIONS.IT_INCIDENT_CREATE),
        canManageSecurityIncidents: canSync(perms, PERMISSIONS.IT_INCIDENT_MANAGE),
        // Inventory
        canReadInventory: canSync(perms, PERMISSIONS.INVENTORY_READ),
        canWriteInventory: canSync(perms, PERMISSIONS.INVENTORY_CREATE),
        legacyRole,
        userTeams,
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
