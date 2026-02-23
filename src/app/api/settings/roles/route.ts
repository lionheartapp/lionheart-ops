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

    // Check permission to create roles
    await assertCan(userContext.userId, PERMISSIONS.ROLES_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: body.name,
          slug: body.slug,
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

      return NextResponse.json(ok(role), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to create role:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create role'),
      { status: 500 }
    )
  }
}
