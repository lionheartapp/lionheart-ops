/**
 * Event Team Permissions
 *
 * Checks whether a user has a specific event-level permission
 * based on their EventTeamMember record.
 *
 * Rules:
 * - The event creator (owner) always has full access.
 * - Org admins/super-admins bypass event-level permissions entirely
 *   (handled by the caller via org-level assertCan).
 * - Team members default to viewer (all permissions false).
 * - Non-team-members see nothing unless they have org-level perms.
 */

import { rawPrisma } from '@/lib/db'
import type { EventMemberPermissionKey } from '@/lib/types/event-project'

export interface EventTeamPermissions {
  isOwner: boolean
  isTeamMember: boolean
  canManageTasks: boolean
  canManageSchedule: boolean
  canViewBudget: boolean
  canManageLogistics: boolean
  canManageCheckin: boolean
  canSendComms: boolean
  canViewRegistrations: boolean
  canManageDocuments: boolean
}

/**
 * Get the full set of event-level permissions for a user on a specific event.
 * Returns null if the user is not on the team and not the creator.
 */
export async function getEventTeamPermissions(
  userId: string,
  eventProjectId: string,
): Promise<EventTeamPermissions | null> {
  // Fetch the event project to check ownership
  const eventProject = await rawPrisma.eventProject.findUnique({
    where: { id: eventProjectId },
    select: { createdById: true },
  })
  if (!eventProject) return null

  const isOwner = eventProject.createdById === userId

  // Owners get full access
  if (isOwner) {
    return {
      isOwner: true,
      isTeamMember: true,
      canManageTasks: true,
      canManageSchedule: true,
      canViewBudget: true,
      canManageLogistics: true,
      canManageCheckin: true,
      canSendComms: true,
      canViewRegistrations: true,
      canManageDocuments: true,
    }
  }

  // Check team membership
  const member = await rawPrisma.eventTeamMember.findUnique({
    where: { eventProjectId_userId: { eventProjectId, userId } },
    select: {
      canManageTasks: true,
      canManageSchedule: true,
      canViewBudget: true,
      canManageLogistics: true,
      canManageCheckin: true,
      canSendComms: true,
      canViewRegistrations: true,
      canManageDocuments: true,
    },
  })

  if (!member) return null

  return {
    isOwner: false,
    isTeamMember: true,
    canManageTasks: member.canManageTasks,
    canManageSchedule: member.canManageSchedule,
    canViewBudget: member.canViewBudget,
    canManageLogistics: member.canManageLogistics,
    canManageCheckin: member.canManageCheckin,
    canSendComms: member.canSendComms,
    canViewRegistrations: member.canViewRegistrations,
    canManageDocuments: member.canManageDocuments,
  }
}

/**
 * Quick check: does a user have a specific event-level permission?
 * Returns true if they're the owner or have the specific permission toggled on.
 */
export async function canEventMember(
  userId: string,
  eventProjectId: string,
  permission: EventMemberPermissionKey,
): Promise<boolean> {
  const perms = await getEventTeamPermissions(userId, eventProjectId)
  if (!perms) return false
  if (perms.isOwner) return true
  return perms[permission]
}
