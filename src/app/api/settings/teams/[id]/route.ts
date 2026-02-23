import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

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
        return NextResponse.json(
          fail('CONFLICT', 'Cannot delete a team that has assigned members'),
          { status: 409 }
        )
      }

      await prisma.team.delete({ where: { id } })
      return NextResponse.json(ok({ id }))
    })
  } catch (error) {
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
