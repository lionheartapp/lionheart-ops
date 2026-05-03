import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'
import { invalidateSettingsCache, settingsCacheKey } from '@/lib/cache/settings-cache'
import { invalidateAllUserContexts } from '@/lib/cache/request-context-cache'
import { clearAllPermissionCaches } from '@/lib/auth/permissions'
import { safeName } from '@/lib/sanitize'

const DeleteRoleSchema = z.object({
  reassignRoleId: z.string().trim().min(1).nullable().optional(),
  userReassignments: z
    .array(
      z.object({
        userId: z.string().trim().min(1),
        roleId: z.string().trim().min(1),
      })
    )
    .optional(),
})

const UpdateRoleSchema = z.object({
  // LIVE-001: HTML-strip on the way in.
  name: safeName({ max: 120 }).optional(),
  permissionIds: z.array(z.string().trim().min(1)).optional(),
})

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const role = await prisma.role.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      isSystem: true,
      permissions: {
        select: {
          permissionId: true,
        },
      },
    },
  })

  if (!role) {
    return NextResponse.json(fail('NOT_FOUND', 'Role not found'), { status: 404 })
  }

  const permissionIds = role.permissions.map((item) => item.permissionId)

  return NextResponse.json(
    ok({
      id: role.id,
      name: role.name,
      slug: role.slug,
      isSystem: role.isSystem,
      permissionIds,
    })
  )
}, { permission: PERMISSIONS.ROLES_READ })

export const PATCH = withAuth<z.infer<typeof UpdateRoleSchema>, { id: string }>(async ({ orgId, ctx, req, params, body }) => {
  const role = await prisma.role.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, isSystem: true, name: true, slug: true },
  })

  if (!role) {
    return NextResponse.json(fail('NOT_FOUND', 'Role not found'), { status: 404 })
  }

  if (role.isSystem) {
    return NextResponse.json(fail('FORBIDDEN', 'System roles cannot be edited'), { status: 403 })
  }

  let nextSlug = role.slug
  if (body.name && body.name !== role.name) {
    nextSlug = toSlug(body.name)
    if (!nextSlug) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Role name must include letters or numbers'),
        { status: 400 }
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    if (body.name) {
      await tx.role.update({
        where: { id: params.id },
        data: {
          name: body.name,
          slug: nextSlug,
        },
      })
    }

    if (body.permissionIds) {
      const permissions = await tx.permission.findMany({
        where: { id: { in: body.permissionIds } },
        select: { id: true },
      })

      if (permissions.length !== body.permissionIds.length) {
        throw new Error('INVALID_PERMISSIONS')
      }

      await tx.rolePermission.deleteMany({ where: { roleId: params.id } })
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: params.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        })
      }
    }
  })

  invalidateSettingsCache(settingsCacheKey(orgId, 'roles'))

  // Role name or permissions changed — blast-radius is every user on this role.
  // Cheaper than tracking membership: clear all in-process auth caches.
  if (body.name || body.permissionIds) {
    invalidateAllUserContexts()
    clearAllPermissionCaches()
  }

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'role.update',
    resourceType:   'Role',
    resourceId:     params.id,
    resourceLabel:  body.name ?? role.name,
    changes:        {
      ...(body.name ? { name: body.name } : {}),
      ...(body.permissionIds ? { permissionCount: body.permissionIds.length } : {}),
    },
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok({ id: params.id }))
}, { permission: PERMISSIONS.ROLES_UPDATE, schema: UpdateRoleSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, ctx, req, params }) => {
  // DELETE body is optional — parse manually
  let reassignRoleId: string | null | undefined
  let userReassignments: Array<{ userId: string; roleId: string }> = []
  try {
    const rawBody = await req.json()
    const parsed = DeleteRoleSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid delete role payload', parsed.error.issues),
        { status: 400 }
      )
    }
    reassignRoleId = parsed.data.reassignRoleId
    userReassignments = parsed.data.userReassignments || []
  } catch {
    reassignRoleId = undefined
  }

  const role = await prisma.role.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: {
      id: true,
      isSystem: true,
      _count: {
        select: {
          users: true,
        },
      },
    },
  })

  if (!role) {
    return NextResponse.json(fail('NOT_FOUND', 'Role not found'), { status: 404 })
  }

  if (role.isSystem) {
    return NextResponse.json(fail('FORBIDDEN', 'System roles cannot be deleted'), { status: 403 })
  }

  if (role._count.users > 0) {
    if (!reassignRoleId && userReassignments.length === 0) {
      return NextResponse.json(
        fail('CONFLICT', 'Cannot delete a role that is assigned to users without reassignment'),
        { status: 409 }
      )
    }

    if (reassignRoleId === role.id) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Reassignment role must be different'),
        { status: 400 }
      )
    }

    const assignedUsers = await prisma.user.findMany({
      where: { organizationId: orgId, roleId: role.id },
      select: { id: true },
    })

    const assignedUserIds = assignedUsers.map((user) => user.id)
    const assignmentMap = new Map<string, string>()
    userReassignments.forEach((item) => {
      assignmentMap.set(item.userId, item.roleId)
    })

    const targets = new Set<string>()
    const missingAssignments: string[] = []

    assignedUserIds.forEach((userId) => {
      const target = assignmentMap.get(userId) || reassignRoleId
      if (!target) {
        missingAssignments.push(userId)
      } else {
        targets.add(target)
      }
    })

    if (missingAssignments.length > 0) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'All assigned users must be reassigned'),
        { status: 400 }
      )
    }

    if (targets.has(role.id)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Reassignment role must be different'),
        { status: 400 }
      )
    }

    const targetRoles = await prisma.role.findMany({
      where: { id: { in: Array.from(targets) }, organizationId: orgId },
      select: { id: true },
    })

    if (targetRoles.length !== targets.size) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Reassignment role not found'),
        { status: 404 }
      )
    }

    const updatesByRole = new Map<string, { userId: string; email: string }[]>()
    const assignedUsersWithEmail = await prisma.user.findMany({
      where: { id: { in: assignedUserIds }, organizationId: orgId },
      select: { id: true, email: true },
    })

    assignedUsersWithEmail.forEach(({ id: userId, email }) => {
      const target = assignmentMap.get(userId) || reassignRoleId
      if (!target) return
      const list = updatesByRole.get(target) || []
      list.push({ userId, email })
      updatesByRole.set(target, list)
    })

    await prisma.$transaction(
      Array.from(updatesByRole.entries()).flatMap(([targetRoleId, users]) =>
        users.map((user) =>
          prisma.user.update({
            where: {
              organizationId_email: {
                organizationId: orgId,
                email: user.email,
              },
            },
            data: { roleId: targetRoleId },
          })
        )
      )
    )
  }

  await prisma.role.delete({ where: { id: params.id } })

  invalidateSettingsCache(settingsCacheKey(orgId, 'roles'))

  // Any users that had this role were just reassigned — their cached roleName
  // is now wrong. Role delete is rare, so the broad invalidation is acceptable.
  invalidateAllUserContexts()
  clearAllPermissionCaches()

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'role.delete',
    resourceType:   'Role',
    resourceId:     params.id,
    resourceLabel:  role.id,
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok({ id: params.id }))
}, { permission: PERMISSIONS.ROLES_DELETE })
