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
        return NextResponse.json(
          fail('CONFLICT', 'Cannot delete a role that is assigned to users'),
          { status: 409 }
        )
      }

      await prisma.role.delete({ where: { id } })
      return NextResponse.json(ok({ id }))
    })
  } catch (error) {
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
