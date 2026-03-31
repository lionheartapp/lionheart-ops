import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { clearPermissionCache } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * GET /api/settings/users/[id]/permissions
 *
 * Returns all permissions with their status for a specific user:
 * - inherited: permission comes from role
 * - granted: user-level override granting the permission
 * - revoked: user-level override revoking the permission, or not granted at all
 */
export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  // Fetch target user with role permissions and user overrides
  const user = await prisma.user.findFirst({
    where: { id: params.id, organizationId: orgId, deletedAt: null },
    include: {
      userRole: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      userPermissions: {
        include: { permission: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  // Build set of permission IDs that come from the role
  const rolePermissionIds = new Set<string>()
  let roleHasWildcard = false
  if (user.userRole) {
    user.userRole.permissions.forEach((rp) => {
      rolePermissionIds.add(rp.permissionId)
      // Check if role has the wildcard (*:*) permission
      if (rp.permission.resource === '*' && rp.permission.action === '*') {
        roleHasWildcard = true
      }
    })
  }

  // Build map of user overrides by permissionId
  const userOverrideMap = new Map<string, boolean>()
  user.userPermissions.forEach((up) => {
    userOverrideMap.set(up.permissionId, up.granted)
  })

  // Fetch all available permissions (exclude wildcard)
  const allPermissions = await prisma.permission.findMany({
    where: { resource: { not: '*' } },
    select: { id: true, resource: true, action: true, scope: true, description: true },
    orderBy: [{ resource: 'asc' }, { action: 'asc' }, { scope: 'asc' }],
  })

  // Build response with status for each permission
  const permissionsWithStatus = allPermissions.map((perm) => {
    const fromRole = rolePermissionIds.has(perm.id) || roleHasWildcard
    const hasOverride = userOverrideMap.has(perm.id)

    let status: 'inherited' | 'granted' | 'revoked' | 'none'
    let isEnabled: boolean

    if (hasOverride) {
      const granted = userOverrideMap.get(perm.id)!
      status = granted ? 'granted' : 'revoked'
      isEnabled = granted
    } else if (fromRole) {
      status = 'inherited'
      isEnabled = true
    } else {
      status = 'none'
      isEnabled = false
    }

    return {
      id: perm.id,
      resource: perm.resource,
      action: perm.action,
      scope: perm.scope,
      description: perm.description,
      status,
      isEnabled,
    }
  })

  return NextResponse.json(ok({
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    roleId: user.roleId,
    roleName: user.userRole?.name || null,
    permissions: permissionsWithStatus,
  }))
}, { permission: PERMISSIONS.USERS_MANAGE_PERMISSIONS })

const SavePermissionsSchema = z.object({
  overrides: z.array(z.object({
    permissionId: z.string(),
    granted: z.boolean(),
  })),
})

/**
 * PUT /api/settings/users/[id]/permissions
 *
 * Save per-user permission overrides. Only include overrides that differ
 * from the user's role defaults:
 * - { permissionId, granted: true } = grant a permission the role doesn't have
 * - { permissionId, granted: false } = revoke a permission the role has
 */
export const PUT = withAuth<z.infer<typeof SavePermissionsSchema>, { id: string }>(async ({ orgId, params, body }) => {
  // Verify user exists in this org
  const targetUser = await prisma.user.findFirst({
    where: { id: params.id, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })

  if (!targetUser) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  // Validate all permission IDs exist
  if (body.overrides.length > 0) {
    const validPerms = await prisma.permission.findMany({
      where: { id: { in: body.overrides.map((o) => o.permissionId) } },
      select: { id: true },
    })

    if (validPerms.length !== body.overrides.length) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'One or more permission IDs are invalid'),
        { status: 400 }
      )
    }
  }

  // Atomic: delete all current overrides, then create new ones
  await prisma.$transaction([
    prisma.userPermission.deleteMany({
      where: { userId: params.id },
    }),
    ...(body.overrides.length > 0
      ? [prisma.userPermission.createMany({
          data: body.overrides.map((override) => ({
            userId: params.id,
            permissionId: override.permissionId,
            granted: override.granted,
            updatedAt: new Date(),
          })),
        })]
      : []),
  ])

  // Clear permission cache so changes take effect immediately
  clearPermissionCache(params.id)

  return NextResponse.json(ok({ message: 'Permissions updated' }))
}, { permission: PERMISSIONS.USERS_MANAGE_PERMISSIONS, schema: SavePermissionsSchema })
