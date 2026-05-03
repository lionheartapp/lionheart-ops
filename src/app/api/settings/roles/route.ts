import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'
import { getCached, invalidateSettingsCache, settingsCacheKey } from '@/lib/cache/settings-cache'
import { safeName } from '@/lib/sanitize'

// LIVE-001: name fields are user-supplied display strings — `safeName()` strips
// HTML before persisting so they can never become a stored-XSS sink in
// downstream consumers (emails, CSV exports, audit log messages, anywhere
// that uses dangerouslySetInnerHTML).
const CreateRoleSchema = z.object({
  name: safeName({ max: 120 }),
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

export const GET = withAuth(async ({ orgId }) => {
  const cacheKey = settingsCacheKey(orgId, 'roles')
  const roles = await getCached(cacheKey, () =>
    prisma.role.findMany({
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
  )

  return NextResponse.json(ok(roles))
}, { permission: PERMISSIONS.ROLES_READ })

export const POST = withAuth<z.infer<typeof CreateRoleSchema>>(async ({ orgId, ctx, req, body }) => {
  const slug = toSlug(body.slug || body.name)

  if (!slug) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Role name must include letters or numbers'),
      { status: 400 }
    )
  }

  const role = await prisma.role.create({
    data: {
      organizationId: orgId,
      name: body.name,
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

  if (body.permissionIds && body.permissionIds.length > 0) {
    const permissions = await prisma.permission.findMany({
      where: { id: { in: body.permissionIds } },
      select: { id: true },
    })

    if (permissions.length !== body.permissionIds.length) {
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

  invalidateSettingsCache(settingsCacheKey(orgId, 'roles'))

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'role.create',
    resourceType:   'Role',
    resourceId:     role.id,
    resourceLabel:  role.name,
    changes:        { name: body.name, slug, permissionCount: body.permissionIds?.length ?? 0 },
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok(role), { status: 201 })
}, { permission: PERMISSIONS.ROLES_CREATE, schema: CreateRoleSchema })
