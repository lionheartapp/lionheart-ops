import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'

const CreateRoleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
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

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission to view roles
    await assertCan(userContext.userId, PERMISSIONS.ROLES_READ)

    return await runWithOrgContext(orgId, async () => {
      const roles = await prisma.role.findMany({
        where: { organizationId: orgId },
        include: {
          _count: {
            select: {
              permissions: true,
              users: true,
            },
          },
        },
        orderBy: [
          { isSystem: 'desc' },
          { name: 'asc' },
        ],
      })

      return NextResponse.json(ok(roles))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch roles:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch roles'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = CreateRoleSchema.parse(body)

    // Check permission to create roles
    await assertCan(userContext.userId, PERMISSIONS.ROLES_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const slug = toSlug(input.slug || input.name)

      if (!slug) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Role name must include letters or numbers'),
          { status: 400 }
        )
      }

      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: input.name,
          slug,
          isSystem: false,
        },
        include: {
          _count: {
            select: {
              permissions: true,
              users: true,
            },
          },
        },
      })

      if (input.permissionIds && input.permissionIds.length > 0) {
        const permissions = await prisma.permission.findMany({
          where: { id: { in: input.permissionIds } },
          select: { id: true },
        })

        if (permissions.length !== input.permissionIds.length) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'One or more permissions are invalid'),
            { status: 400 }
          )
        }

        await prisma.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        })
      }

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'role.create',
        resourceType:   'Role',
        resourceId:     role.id,
        resourceLabel:  role.name,
        changes:        { name: input.name, slug, permissionCount: input.permissionIds?.length ?? 0 },
        ipAddress:      getIp(req),
      })

      return NextResponse.json(ok(role), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid role input', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
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
    console.error('Failed to create role:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create role'),
      { status: 500 }
    )
  }
}
