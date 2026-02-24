import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'

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

      if (nextSlug !== team.slug) {
        const usersToUpdate = await prisma.user.findMany({
          where: {
            organizationId: orgId,
            teamIds: {
              has: team.slug,
            },
          },
          select: { id: true, email: true, teamIds: true },
        })

        await prisma.$transaction(
          usersToUpdate.map((user) => {
            const nextTeams = user.teamIds.map((slug) =>
              slug === team.slug ? nextSlug : slug
            )
            return prisma.user.update({
              where: {
                organizationId_email: {
                  organizationId: orgId,
                  email: user.email,
                },
              },
              data: { teamIds: nextTeams },
            })
          })
        )
      }

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
        select: {
          id: true,
          slug: true,
        },
      })

      if (!team) {
        return NextResponse.json(fail('NOT_FOUND', 'Team not found'), { status: 404 })
      }

      const assignedUserCount = await prisma.user.count({
        where: {
          organizationId: orgId,
          teamIds: {
            has: team.slug,
          },
        },
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

        const usersToUpdate = await prisma.user.findMany({
          where: {
            organizationId: orgId,
            teamIds: {
              has: team.slug,
            },
          },
          select: {
            id: true,
            email: true,
            teamIds: true,
          },
        })

        const assignmentMap = new Map<string, string>()
        userReassignments.forEach((item) => {
          assignmentMap.set(item.userId, item.teamId)
        })

        const targets = new Set<string>()
        const missingAssignments: string[] = []

        usersToUpdate.forEach((user) => {
          const target = assignmentMap.get(user.id) || reassignTeamId
          if (!target) {
            missingAssignments.push(user.id)
          } else {
            targets.add(target)
          }
        })

        if (missingAssignments.length > 0) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'All assigned members must be reassigned'),
            { status: 400 }
          )
        }

        if (targets.has(team.id)) {
          return NextResponse.json(
            fail('VALIDATION_ERROR', 'Reassignment team must be different'),
            { status: 400 }
          )
        }

        const targetTeams = await prisma.team.findMany({
          where: { id: { in: Array.from(targets) }, organizationId: orgId },
          select: { id: true, slug: true },
        })

        if (targetTeams.length !== targets.size) {
          return NextResponse.json(
            fail('NOT_FOUND', 'Reassignment team not found'),
            { status: 404 }
          )
        }

        const targetSlugMap = new Map(
          targetTeams.map((target) => [target.id, target.slug])
        )

        await prisma.$transaction(
          usersToUpdate.map((user) => {
            const targetId = assignmentMap.get(user.id) || reassignTeamId
            const targetSlug = targetId ? targetSlugMap.get(targetId) : null
            if (!targetSlug) {
              return prisma.user.update({
                where: {
                  organizationId_email: {
                    organizationId: orgId,
                    email: user.email,
                  },
                },
                data: { teamIds: user.teamIds.filter((slug) => slug !== team.slug) },
              })
            }

            const nextTeams = user.teamIds.filter((slug) => slug !== team.slug)
            if (!nextTeams.includes(targetSlug)) {
              nextTeams.push(targetSlug)
            }
            return prisma.user.update({
              where: {
                organizationId_email: {
                  organizationId: orgId,
                  email: user.email,
                },
              },
              data: { teamIds: nextTeams },
            })
          })
        )
      }

      await prisma.team.delete({ where: { id } })
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
