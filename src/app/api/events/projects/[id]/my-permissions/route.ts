import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getEventTeamPermissions } from '@/lib/services/eventTeamPermissions'

/**
 * GET /api/events/projects/[id]/my-permissions
 *
 * Returns the current user's effective event-level permissions for this event.
 * Combines org-level role (admin = full access) with team-member permissions.
 */
// @authOnly Any signed-in user may ask what they can do on this event; response is scoped to ctx.userId.
export const GET = withAuth(async ({ ctx, params, permissions }) => {
  // Org admins / super-admins bypass event-level permissions
  const isOrgAdmin = await permissions.can(PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

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
  const eventPerms = await getEventTeamPermissions(ctx.userId, params.id)

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
