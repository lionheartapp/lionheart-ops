import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
// eslint-disable-next-line no-restricted-imports -- Auth campus hydration uses getUserContext first, then manually scopes reads by ctx.organizationId.
import { rawPrisma } from '@/lib/db'
import { cachePerUser } from '@/lib/cache/route-cache'

/**
 * GET /api/auth/me/campuses
 *
 * Returns the campus(es) the current user can see.
 *
 * NEW ONTOLOGY (Phase 1b): Users are pinned to a single campus via
 * `User.campusId` (the old UserCampusAssignment junction has been dropped).
 *
 * - If the user has a campusId, we return an array containing just that campus
 *   (marked isPrimary: true) so clients that expected a list still work.
 * - Otherwise we fall back to all active campuses in the org so admins and
 *   super-admins continue to see everything.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)

    const result = await cachePerUser(
      ctx.userId,
      'auth:campuses',
      async () => {
        const user = await rawPrisma.user.findFirst({
          where: {
            id: ctx.userId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { campusId: true },
        })

        if (user?.campusId) {
          const campus = await rawPrisma.campus.findFirst({
            where: {
              id: user.campusId,
              organizationId: ctx.organizationId,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true, name: true, isActive: true },
          })

          if (campus) {
            return [{ id: campus.id, name: campus.name, isPrimary: true }]
          }
        }

        // Fall back to all active campuses for admins / users without a pinned campus
        const allCampuses = await rawPrisma.campus.findMany({
          where: {
            organizationId: ctx.organizationId,
            isActive: true,
            deletedAt: null,
          },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })

        return allCampuses.map((c) => ({ ...c, isPrimary: false }))
      },
      { ttlMs: 120000 }
    )

    return NextResponse.json(ok(result))
  } catch {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 },
    )
  }
}
