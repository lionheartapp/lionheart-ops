import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'
import { invalidateOrgCache } from '@/lib/cache/route-cache'
import { safeName } from '@/lib/sanitize'

const DeleteTeamSchema = z.object({
  reassignTeamId: z.string().trim().min(1).nullable().optional(),
  userReassignments: z
    .array(
      z.object({
        userId: z.string().trim().min(1),
        teamId: z.string().trim().min(1),
      })
    )
    .optional(),
})

const UpdateTeamSchema = z.object({
  // LIVE-001
  name: safeName({ max: 120 }).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  teamType: z.enum(['PRE_SCHOOL', 'ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).nullable().optional(),
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
  const team = await prisma.team.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      teamType: true,
    },
  })

  if (!team) {
    return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
  }

  return NextResponse.json(ok(team))
}, { permission: PERMISSIONS.TEAMS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateTeamSchema>, { id: string }>(async ({ orgId, ctx, body, params, req }) => {
  const team = await prisma.team.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, name: true, slug: true },
  })

  if (!team) {
    return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
  }

  let nextSlug = team.slug
  if (body.name && body.name !== team.name) {
    nextSlug = toSlug(body.name)
    if (!nextSlug) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Team name must include letters or numbers'),
        { status: 400 }
      )
    }
  }

  const updated = await prisma.team.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name, slug: nextSlug } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.teamType !== undefined ? { teamType: body.teamType } : {}),
    },
    select: { id: true, name: true, slug: true, description: true, teamType: true },
  })

  invalidateOrgCache(orgId, 'teams')

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'team.update',
    resourceType:   'Team',
    resourceId:     params.id,
    resourceLabel:  updated.name,
    changes:        {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.teamType !== undefined ? { teamType: body.teamType } : {}),
    },
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.TEAMS_UPDATE, schema: UpdateTeamSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ orgId, ctx, params, req }) => {
  let reassignTeamId: string | null | undefined
  let userReassignments: Array<{ userId: string; teamId: string }> = []
  try {
    const rawBody = await req.json()
    const parsed = DeleteTeamSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid delete team payload', parsed.error.issues),
        { status: 400 }
      )
    }
    reassignTeamId = parsed.data.reassignTeamId
    userReassignments = parsed.data.userReassignments || []
  } catch {
    reassignTeamId = undefined
  }

  const team = await prisma.team.findFirst({
    where: { id: params.id, organizationId: orgId },
    select: { id: true, slug: true },
  })

  if (!team) {
    return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
  }

  const assignedUserCount = await prisma.userTeam.count({
    where: { teamId: team.id },
  })

  if (assignedUserCount > 0) {
    if (!reassignTeamId && userReassignments.length === 0) {
      return NextResponse.json(
        fail('CONFLICT', 'Cannot delete a team that has assigned members without reassignment'),
        { status: 409 }
      )
    }

    if (reassignTeamId === team.id) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Reassignment team must be different'),
        { status: 400 }
      )
    }

    const memberships = await prisma.userTeam.findMany({
      where: { teamId: team.id },
      select: { userId: true },
    })

    const assignmentMap = new Map<string, string>()
    for (const item of userReassignments) {
      assignmentMap.set(item.userId, item.teamId)
    }

    const allTargetIds = new Set<string>()
    const missingAssignments: string[] = []

    for (const { userId } of memberships) {
      const targetId = assignmentMap.get(userId) ?? reassignTeamId ?? null
      if (!targetId) {
        missingAssignments.push(userId)
      } else {
        allTargetIds.add(targetId)
      }
    }

    if (missingAssignments.length > 0) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'All assigned members must be reassigned'),
        { status: 400 }
      )
    }

    if (allTargetIds.has(team.id)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Reassignment team must be different'),
        { status: 400 }
      )
    }

    const validTargets = await prisma.team.findMany({
      where: { id: { in: Array.from(allTargetIds) }, organizationId: orgId },
      select: { id: true },
    })
    if (validTargets.length !== allTargetIds.size) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Reassignment team not found'),
        { status: 404 }
      )
    }

    await prisma.$transaction(
      memberships.map(({ userId }) => {
        const targetId = assignmentMap.get(userId) ?? reassignTeamId!
        return prisma.userTeam.upsert({
          where: { userId_teamId: { userId, teamId: targetId } },
          create: { userId, teamId: targetId },
          update: {},
        })
      })
    )
  }

  await prisma.team.delete({ where: { id: params.id } })

  invalidateOrgCache(orgId, 'teams')

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
    action:         'team.delete',
    resourceType:   'Team',
    resourceId:     params.id,
    resourceLabel:  team.slug,
    changes:        assignedUserCount > 0 ? { reassignedMembers: assignedUserCount } : undefined,
    ipAddress:      getIp(req),
  })

  return NextResponse.json(ok({ id: params.id }))
}, { permission: PERMISSIONS.TEAMS_DELETE })
