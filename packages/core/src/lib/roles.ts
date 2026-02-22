/**
 * Roles & Permissions Matrix (Super Admin, Admin, Member).
 * Teams define department (IT, Maintenance, etc.); roles define global permissions.
 *
 * Capability matrix:
 * - Visibility: Super Admin & Admin = Full; Member = Limited (team-scoped).
 * - Workspace Info: Super Admin = View & Edit; Admin = View Only; Member = Hidden.
 * - Subscriptions/Purchases: Super Admin only.
 * - Create New Members: Super Admin, Admin.
 * - Assign Admin Role: Super Admin, Admin.
 * - Assign / Reassign Super Admin: Super Admin only.
 */

import type { UserRole } from '@prisma/client'

/** Role is Super Admin (full authority, billing, assign Super Admin). */
export function isSuperAdmin(role: string | null | undefined): role is 'SUPER_ADMIN' {
  return role === 'SUPER_ADMIN'
}

/** Role is Admin (daily management, no billing, cannot assign Super Admin). */
export function isAdmin(role: string | null | undefined): role is 'ADMIN' {
  return role === 'ADMIN'
}

/** Role is Admin or Super Admin (can manage users, see full workspace). */
export function isAdminOrSuperAdmin(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/** Member-level: not Admin or Super Admin (limited visibility, team-scoped). */
export function isMemberLevel(role: string | null | undefined): boolean {
  return !isAdminOrSuperAdmin(role)
}

/** Subscriptions/Purchases: Super Admin only */
export function canManageBilling(role: string | null | undefined): boolean {
  return isSuperAdmin(role)
}

/** Workspace info: Super Admin = View & Edit; Admin = View Only; Member = Hidden */
export function canEditWorkspaceInfo(role: string | null | undefined): boolean {
  return isSuperAdmin(role)
}

export function canViewWorkspaceInfo(role: string | null | undefined): boolean {
  return isSuperAdmin(role) || isAdmin(role)
}

/** Create new members: Super Admin, Admin */
export function canCreateMembers(role: string | null | undefined): boolean {
  return isAdminOrSuperAdmin(role)
}

/** Assign Admin role: Super Admin, Admin. Assign Super Admin / Reassign Super Admin: Super Admin only */
export function canAssignRole(
  actorRole: string | null | undefined,
  targetRole: UserRole | string
): boolean {
  const target = String(targetRole).toUpperCase()
  if (target === 'SUPER_ADMIN') return isSuperAdmin(actorRole)
  if (target === 'ADMIN') return isAdminOrSuperAdmin(actorRole)
  return isAdminOrSuperAdmin(actorRole)
}

/** Singleton Rule: org must have at least one SUPER_ADMIN. Call before demoting or deleting a Super Admin. */
export async function ensureAtLeastOneSuperAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  organizationId: string,
  excludeUserId: string
): Promise<void> {
  const count = await prisma.user.count({
    where: {
      organizationId,
      role: 'SUPER_ADMIN',
      id: { not: excludeUserId },
    },
  })
  if (count < 1) {
    throw new Error(
      'Cannot demote or remove the last Super Admin. Assign another user as Super Admin first.'
    )
  }
}
