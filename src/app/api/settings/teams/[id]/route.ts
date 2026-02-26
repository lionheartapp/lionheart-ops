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
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
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

    await assertCan(userContext.userId, PERMISSIONS.TEAMS_READ)

    return await runWithOrgContext(orgId, async () => {
      const team = await prisma.team.findFirst({
        where: { id, organizationId: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      })

      if (!team) {
        return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
      }

      return NextResponse.json(ok(team))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch team:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch team'),
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
    const input = UpdateTeamSchema.parse(body)

    await assertCan(userContext.userId, PERMISSIONS.TEAMS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const team = await prisma.team.findFirst({
        where: { id, organizationId: orgId },
        select: { id: true, name: true, slug: true },
      })

      if (!team) {
        return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
      }

      let nextSlug = team.slug
      if (input.name && input.name !== team.name) {
        nextSlug = toSlug(input.name)
        if (!nextSlug) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'Team name must include letters or numbers'),
            { status: 400 }
          )
        }
      }

      const updated = await prisma.team.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name, slug: nextSlug } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
        select: { id: true, name: true, slug: true, description: true },
      })

      // No need to update user records when slug changes — the junction table
      // references teamId (UUID), not slug. The slug change is purely on Team.

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'team.update',
        resourceType:   'Team',
        resourceId:     id,
        resourceLabel:  updated.name,
        changes:        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
        ipAddress:      getIp(req),
      })

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid team update payload', error.issues),
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
        fail('CONFLICT', 'A team with this name/slug already exists'),
        { status: 409 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to update team:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to update team'),
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    let reassignTeamId: string | null | undefined
    let userReassignments: Array<{ userId: string; teamId: string }> = []
    try {
      const body = await req.json()
      const parsed = DeleteTeamSchema.safeParse(body)
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

    await assertCan(userContext.userId, PERMISSIONS.TEAMS_DELETE)

    return await runWithOrgContext(orgId, async () => {
      const team = await prisma.team.findFirst({
        where: { id, organizationId: orgId },
        select: { id: true, slug: true },
      })

      if (!team) {
        return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
      }

      // Count current members via junction table
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

        // Fetch all current members of this team
        const memberships = await prisma.userTeam.findMany({
          where: { teamId: team.id },
          select: { userId: true },
        })

        // Build per-user target team ID map
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

        // Validate all target teams exist and belong to this org
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

        // Upsert reassignment memberships (ignore if they already belong to target team)
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

        // Junction rows for the deleted team are removed automatically via CASCADE
      }

      await prisma.team.delete({ where: { id } })

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'team.delete',
        resourceType:   'Team',
        resourceId:     id,
        resourceLabel:  team.slug,
        changes:        assignedUserCount > 0 ? { reassignedMembers: assignedUserCount } : undefined,
        ipAddress:      getIp(req),
      })

      return NextResponse.json(ok({ id }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid delete team payload', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to delete team:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to delete team'),
      { status: 500 }
    )
  }
}
