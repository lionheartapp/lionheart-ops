import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { can } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getEventTeamPermissions } from '@/lib/services/eventTeamPermissions'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/events/projects/[id]/my-permissions
 *
 * Returns the current user's effective event-level permissions for this event.
 * Combines org-level role (admin = full access) with team-member permissions.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      // Org admins / super-admins bypass event-level permissions
      const isOrgAdmin = await can(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

      if (isOrgAdmin) {
        return NextResponse.json(ok({
          isOwner: false,
          isOrgAdmin: true,
          isTeamMember: true,
          canManageTasks: true,
          canManageSchedule: true,
          canViewBudget: true,
          canManageLogistics: true,
          canManageCheckin: true,
          canSendComms: true,
          canViewRegistrations: true,
          canManageDocuments: true,
        }))
      }

      // Check event-specific team permissions
      const eventPerms = await getEventTeamPermissions(ctx.userId, id)

      if (!eventPerms) {
        // Not on the team and not admin — just basic read access
        return NextResponse.json(ok({
          isOwner: false,
          isOrgAdmin: false,
          isTeamMember: false,
          canManageTasks: false,
          canManageSchedule: false,
          canViewBudget: false,
          canManageLogistics: false,
          canManageCheckin: false,
          canSendComms: false,
          canViewRegistrations: false,
          canManageDocuments: false,
        }))
      }

      return NextResponse.json(ok({
        ...eventPerms,
        isOrgAdmin: false,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
