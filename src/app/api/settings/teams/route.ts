import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission to view teams
    await assertCan(userContext.userId, PERMISSIONS.TEAMS_READ)

    return await runWithOrgContext(orgId, async () => {
      const teams = await prisma.team.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
        orderBy: { name: 'asc' },
      })

      // For each team, count users manually since teamIds is a string array
      const teamsWithCounts = await Promise.all(
        teams.map(async (team) => {
          const userCount = await prisma.user.count({
            where: {
              organizationId: orgId,
              teamIds: {
                has: team.slug,
              },
            },
          })
          
          return {
            ...team,
            _count: {
              members: userCount,
            },
          }
        })
      )

      return NextResponse.json(ok(teamsWithCounts))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch teams:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch teams'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    // Check permission to create teams
    await assertCan(userContext.userId, PERMISSIONS.TEAMS_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const team = await prisma.team.create({
        data: {
          organizationId: orgId,
          name: body.name,
          slug: body.slug,
          description: body.description,
        },
      })

      const userCount = await prisma.user.count({
        where: {
          organizationId: orgId,
          teamIds: {
            has: team.slug,
          },
        },
      })

      return NextResponse.json(
        ok({
          ...team,
          _count: {
            members: userCount,
          },
        }),
        { status: 201 }
      )
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to create team:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create team'),
      { status: 500 }
    )
  }
}
