/**
 * Permission Authorization Helpers
 * 
 * Use these functions to check if a user has permission to perform actions.
 * All checks are cached for performance.
 */

import { rawPrisma as prisma } from '@/lib/db'
import { matchesPermission } from '../permissions'

// Simple in-memory cache for permission checks (30 second TTL)
const permissionCache = new Map<string, { permissions: string[]; expires: number }>()
const CACHE_TTL = 30 * 1000 // 30 seconds

/**
 * Get all permissions for a user (cached)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  // Check cache
  const cached = permissionCache.get(userId)
  if (cached && cached.expires > Date.now()) {
    return cached.permissions
  }

  // Fetch from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRole: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  })

  if (!user || !user.userRole) {
    return []
  }

  // Build permission strings
  const permissions = user.userRole.permissions.map((rp) => {
    const { resource, action, scope } = rp.permission
    if (!scope || scope === 'global') {
      return `${resource}:${action}`
    }
    return `${resource}:${action}:${scope}`
  })

  // Cache for next time
  permissionCache.set(userId, {
    permissions,
    expires: Date.now() + CACHE_TTL,
  })

  return permissions
}

/**
 * Clear permission cache for a user (call after role changes)
 */
export function clearPermissionCache(userId: string): void {
  permissionCache.delete(userId)
}

/**
 * Clear all permission caches
 */
export function clearAllPermissionCaches(): void {
  permissionCache.clear()
}

/**
 * Check if user has a specific permission
 */
export async function can(userId: string, permission: string): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  
  return userPermissions.some((userPerm) => 
    matchesPermission(userPerm, permission)
  )
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function canAny(userId: string, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  
  return permissions.some((reqPerm) =>
    userPermissions.some((userPerm) => matchesPermission(userPerm, reqPerm))
  )
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function canAll(userId: string, permissions: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  
  return permissions.every((reqPerm) =>
    userPermissions.some((userPerm) => matchesPermission(userPerm, reqPerm))
  )
}

/**
 * Assert user has permission (throws error if not)
 */
export async function assertCan(
  userId: string,
  permission: string,
  message?: string
): Promise<void> {
  const hasPermission = await can(userId, permission)
  
  if (!hasPermission) {
    throw new Error(message || `Insufficient permissions: ${permission}`)
  }
}

/**
 * Get user's team IDs
 */
export async function getUserTeams(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamIds: true },
  })

  return user?.teamIds || []
}

/**
 * Check if user is on a specific team
 */
export async function isOnTeam(userId: string, teamSlug: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamIds: true },
  })

  return user?.teamIds.includes(teamSlug) || false
}

/**
 * Backward compatibility: Get legacy role from new permission system
 * Used during migration period
 */
export async function getLegacyRole(userId: string): Promise<string> {
  const permissions = await getUserPermissions(userId)
  
  // Check for super admin
  if (permissions.includes('*:*')) {
    return 'SUPER_ADMIN'
  }
  
  // Check for admin (has user management and event approval)
  if (
    permissions.some((p) => matchesPermission(p, 'users:manage:roles')) &&
    permissions.some((p) => matchesPermission(p, 'events:approve'))
  ) {
    return 'ADMIN'
  }
  
  // Check for operations (can assign tickets)
  if (permissions.some((p) => matchesPermission(p, 'tickets:assign'))) {
    return 'OPERATIONS'
  }
  
  // Default to viewer
  return 'VIEWER'
}

/**
 * Check if user can access a resource based on scope
 * 
 * @param userId - User making the request
 * @param permission - Permission to check (e.g., "tickets:update")
 * @param resourceOwnerId - ID of user who owns the resource
 * @param resourceTeamIds - Team IDs associated with the resource
 */
export async function canAccessResource(
  userId: string,
  permission: string,
  resourceOwnerId?: string,
  resourceTeamIds?: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId)
  const userTeams = await getUserTeams(userId)

  // Check for wildcard or 'all' scope permission
  const hasAllAccess = userPermissions.some((userPerm) =>
    matchesPermission(userPerm, `${permission}:all`)
  )
  if (hasAllAccess) return true

  // Check for team scope
  if (resourceTeamIds && resourceTeamIds.length > 0) {
    const hasTeamAccess = userPermissions.some((userPerm) =>
      matchesPermission(userPerm, `${permission}:team`)
    )
    const isOnResourceTeam = resourceTeamIds.some((teamId) =>
      userTeams.includes(teamId)
    )
    if (hasTeamAccess && isOnResourceTeam) return true
  }

  // Check for own scope
  if (resourceOwnerId === userId) {
    const hasOwnAccess = userPermissions.some((userPerm) =>
      matchesPermission(userPerm, `${permission}:own`)
    )
    if (hasOwnAccess) return true
  }

  return false
}
