import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { cacheOrgWide } from '@/lib/cache/route-cache'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    const fetchAll = !q || q.length < 2

    return await runWithOrgContext(orgId, async () => {
      const fetchUsers = () => prisma.user.findMany({
        where: {
          id: { not: ctx.userId },
          status: 'ACTIVE',
          ...(fetchAll ? {} : {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          jobTitle: true,
        },
        take: fetchAll ? 100 : 10,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      })

      // Only cache the "all users" path; free-text search keys would be unbounded.
      const users = fetchAll
        ? await cacheOrgWide(orgId, 'people-search:all', fetchUsers, { ttlMs: 60000 })
        : await fetchUsers()

      return NextResponse.json(ok(users))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', 'You do not have permission to perform this action'), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
