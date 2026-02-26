import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import { audit, getIp } from '@/lib/services/auditService'

type RouteParams = {
  params: Promise<{ id: string }>
}

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
  name: z.string().trim().min(1).max(120).optional(),
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

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.ROLES_READ)

    return await runWithOrgContext(orgId, async () => {
      const role = await prisma.role.findFirst({
        where: { id, organizationId: orgId },
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
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch role:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch role'),
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = UpdateRoleSchema.parse(body)

    await assertCan(userContext.userId, PERMISSIONS.ROLES_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const role = await prisma.role.findFirst({
        where: { id, organizationId: orgId },
        select: { id: true, isSystem: true, name: true, slug: true },
      })

      if (!role) {
        return NextResponse.json(fail('NOT_FOUND', 'Role not found'), { status: 404 })
      }

      if (role.isSystem) {
        return NextResponse.json(fail('FORBIDDEN', 'System roles cannot be edited'), { status: 403 })
      }

      let nextSlug = role.slug
      if (input.name && input.name !== role.name) {
        nextSlug = toSlug(input.name)
        if (!nextSlug) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'Role name must include letters or numbers'),
            { status: 400 }
          )
        }
      }

      await prisma.$transaction(async (tx) => {
        if (input.name) {
          await tx.role.update({
            where: { id },
            data: {
              name: input.name,
              slug: nextSlug,
            },
          })
        }

        if (input.permissionIds) {
          const permissions = await tx.permission.findMany({
            where: { id: { in: input.permissionIds } },
            select: { id: true },
          })

          if (permissions.length !== input.permissionIds.length) {
            throw new Error('INVALID_PERMISSIONS')
          }

          await tx.rolePermission.deleteMany({ where: { roleId: id } })
          if (permissions.length > 0) {
            await tx.rolePermission.createMany({
              data: permissions.map((permission) => ({
                roleId: id,
                permissionId: permission.id,
              })),
              skipDuplicates: true,
            })
          }
        }
      })

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'role.update',
        resourceType:   'Role',
        resourceId:     id,
        resourceLabel:  input.name ?? role.name,
        changes:        {
          ...(input.name ? { name: input.name } : {}),
          ...(input.permissionIds ? { permissionCount: input.permissionIds.length } : {}),
        },
        ipAddress:      getIp(req),
      })

      return NextResponse.json(ok({ id }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid role update payload', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message === 'INVALID_PERMISSIONS') {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'One or more permissions are invalid'),
        { status: 400 }
      )
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        fail('CONFLICT', 'A role with this name/slug already exists'),
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to update role:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to update role'),
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    let reassignRoleId: string | null | undefined
    let userReassignments: Array<{ userId: string; roleId: string }> = []
    try {
      const body = await req.json()
      const parsed = DeleteRoleSchema.safeParse(body)
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

    await assertCan(userContext.userId, PERMISSIONS.ROLES_DELETE)

    return await runWithOrgContext(orgId, async () => {
      const role = await prisma.role.findFirst({
        where: { id, organizationId: orgId },
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

      await prisma.role.delete({ where: { id } })

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'role.delete',
        resourceType:   'Role',
        resourceId:     id,
        resourceLabel:  role.id,
        ipAddress:      getIp(req),
      })

      return NextResponse.json(ok({ id }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid delete role payload', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to delete role:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to delete role'),
      { status: 500 }
    )
  }
}
