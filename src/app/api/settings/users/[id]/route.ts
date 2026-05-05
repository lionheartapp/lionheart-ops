import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp, sanitize } from '@/lib/services/auditService'
import { invalidateUserContext } from '@/lib/cache/request-context-cache'
import { invalidateOrgCache } from '@/lib/cache/route-cache'
import { clearPermissionCache } from '@/lib/auth/permissions'

export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const user = await prisma.user.findFirst({
    where: {
      id: params.id,
      organizationId: orgId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      campusScope: true,
      campusId: true,
      schoolId: true,
      avatar: true,
      jobTitle: true,
      employmentType: true,
      phone: true,
      status: true,
      createdAt: true,
      campus: {
        select: { id: true, name: true },
      },
      school: {
        select: { id: true, name: true },
      },
      teams: {
        select: { team: { select: { id: true, name: true, slug: true } } },
      },
      userRole: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  // Backward-compat: emit `schoolScope` alias alongside the new `campusScope`
  const userWithCompat = { ...user, schoolScope: user.campusScope }
  return NextResponse.json(ok(userWithCompat))
}, { permission: PERMISSIONS.USERS_READ })

export const PATCH = withAuth<unknown, { id: string }>(async ({ req, orgId, ctx, params, permissions }) => {
  const body = await req.json()

  const targetUser = await prisma.user.findFirst({
    where: {
      id: params.id,
      organizationId: orgId,
    },
    select: {
      id: true,
      organizationId: true,
    },
  })

  if (!targetUser) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  const roleOrTeamChange = body.roleId !== undefined || body.teamIds !== undefined || body.status !== undefined
  if (roleOrTeamChange) {
    const allowed = await permissions.can(PERMISSIONS.USERS_MANAGE_ROLES)
    if (!allowed) {
      return NextResponse.json(
        fail('FORBIDDEN', 'Insufficient permissions to change role, teams, or status'),
        { status: 403 }
      )
    }
  }

  if (body.roleId) {
    const role = await prisma.role.findFirst({
      where: { id: String(body.roleId), organizationId: orgId },
      select: { id: true },
    })
    if (!role) {
      return NextResponse.json(fail('BAD_REQUEST', 'Invalid role for this organization'), {
        status: 400,
      })
    }
  }

  const email = body.email ? String(body.email).trim().toLowerCase() : undefined
  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : undefined
  const lastName = body.lastName !== undefined ? String(body.lastName).trim() : undefined
  // Accept both `campusScope` (preferred) and legacy `schoolScope`.
  // `null` is now the org-wide default (replaces the old 'GLOBAL' enum value).
  const rawCampusScope = body.campusScope ?? body.schoolScope
  const allowedCampusScopes = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL'] as const
  const campusScope: (typeof allowedCampusScopes)[number] | null | undefined =
    rawCampusScope === null
      ? null
      : allowedCampusScopes.includes(rawCampusScope as (typeof allowedCampusScopes)[number])
        ? (rawCampusScope as (typeof allowedCampusScopes)[number])
        : undefined

  // Get current email for compound constraint update
  const currentUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { email: true },
  })

  if (!currentUser) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  // If teams are being updated, replace memberships atomically
  if (body.teamIds !== undefined) {
    const newTeamIds: string[] = Array.isArray(body.teamIds) ? body.teamIds.map(String) : []
    await prisma.$transaction([
      prisma.userTeam.deleteMany({ where: { userId: params.id } }),
      ...(newTeamIds.length > 0
        ? [prisma.userTeam.createMany({
            data: newTeamIds.map((teamId: string) => ({ userId: params.id, teamId })),
          })]
        : []),
    ])

    // Team membership changes flip the cached teams-list _count.members.
    invalidateOrgCache(orgId, 'teams')
  }

  const updated = await prisma.user.update({
    where: {
      organizationId_email: {
        organizationId: orgId,
        email: currentUser.email,
      },
    },
    data: {
      ...(email !== undefined ? { email } : {}),
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(firstName !== undefined || lastName !== undefined
        ? { name: `${firstName ?? ''} ${lastName ?? ''}`.trim() }
        : {}),
      ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).trim() : null } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle ? String(body.jobTitle).trim() : null } : {}),
      ...(campusScope !== undefined ? { campusScope } : {}),
      ...(body.employmentType !== undefined ? { employmentType: body.employmentType || null } : {}),
      ...(body.roleId !== undefined ? { roleId: body.roleId || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.campusId !== undefined ? { campusId: body.campusId || null } : {}),
      ...(body.schoolId !== undefined ? { schoolId: body.schoolId || null } : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      campusScope: true,
      campusId: true,
      schoolId: true,
      avatar: true,
      jobTitle: true,
      employmentType: true,
      phone: true,
      status: true,
      createdAt: true,
      campus: {
        select: { id: true, name: true },
      },
      school: {
        select: { id: true, name: true },
      },
      teams: {
        select: { team: { select: { id: true, name: true, slug: true } } },
      },
      userRole: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  // Backward-compat: emit `schoolScope` alias alongside the new `campusScope`
  const updatedWithCompat = { ...updated, schoolScope: updated.campusScope }

  // Invalidate in-process caches — role/email/status may have changed.
  invalidateUserContext(params.id)
  clearPermissionCache(params.id)

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'user.update',
    resourceType:   'User',
    resourceId:     params.id,
    resourceLabel:  updated.email,
    changes:        sanitize(body as Record<string, unknown>),
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok(updatedWithCompat))
}, { permission: PERMISSIONS.USERS_UPDATE })

export const DELETE = withAuth<unknown, { id: string }>(async ({ req, orgId, ctx, params }) => {
  if (params.id === ctx.userId) {
    return NextResponse.json(fail('BAD_REQUEST', 'You cannot delete your own account'), {
      status: 400,
    })
  }

  const targetUser = await prisma.user.findFirst({
    where: {
      id: params.id,
      organizationId: orgId,
    },
    select: {
      id: true,
      email: true,
    },
  })

  if (!targetUser) {
    return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
  }

  await prisma.user.delete({
    where: {
      organizationId_email: {
        organizationId: orgId,
        email: targetUser.email,
      },
    },
  })

  // Invalidate in-process caches — deleted user's cache entry is now dead data.
  invalidateUserContext(params.id)
  clearPermissionCache(params.id)

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'user.delete',
    resourceType:   'User',
    resourceId:     params.id,
    resourceLabel:  targetUser.email,
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok({ id: params.id }))
}, { permission: PERMISSIONS.USERS_DELETE })
