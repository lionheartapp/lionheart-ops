import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan, clearPermissionCache } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

/**
 * GET /api/settings/users/[id]/permissions
 *
 * Returns all permissions with their status for a specific user:
 * - inherited: permission comes from role
 * - granted: user-level override granting the permission
 * - revoked: user-level override revoking the permission, or not granted at all
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.USERS_MANAGE_PERMISSIONS)

    return await runWithOrgContext(orgId, async () => {
      // Fetch target user with role permissions and user overrides
      const user = await prisma.user.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch user permissions:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch user permissions'), { status: 500 })
  }
}

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
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.USERS_MANAGE_PERMISSIONS)

    const input = SavePermissionsSchema.parse(body)

    return await runWithOrgContext(orgId, async () => {
      // Verify user exists in this org
      const targetUser = await prisma.user.findFirst({
        where: { id, organizationId: orgId, deletedAt: null },
        select: { id: true },
      })

      if (!targetUser) {
        return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
      }

      // Validate all permission IDs exist
      if (input.overrides.length > 0) {
        const validPerms = await prisma.permission.findMany({
          where: { id: { in: input.overrides.map((o) => o.permissionId) } },
          select: { id: true },
        })

        if (validPerms.length !== input.overrides.length) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'One or more permission IDs are invalid'),
            { status: 400 }
          )
        }
      }

      // Atomic: delete all current overrides, then create new ones
      await prisma.$transaction([
        prisma.userPermission.deleteMany({
          where: { userId: id },
        }),
        ...(input.overrides.length > 0
          ? [prisma.userPermission.createMany({
              data: input.overrides.map((override) => ({
                userId: id,
                permissionId: override.permissionId,
                granted: override.granted,
                updatedAt: new Date(),
              })),
            })]
          : []),
      ])

      // Clear permission cache so changes take effect immediately
      clearPermissionCache(id)

      return NextResponse.json(ok({ message: 'Permissions updated' }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to save user permissions:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to save permissions'), { status: 500 })
  }
}
