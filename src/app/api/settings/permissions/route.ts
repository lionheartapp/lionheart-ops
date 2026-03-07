import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getCached, globalCacheKey } from '@/lib/cache/settings-cache'

// Permissions are global (not org-scoped) and never change at runtime — use 10 min TTL
const PERMISSIONS_CACHE_TTL = 10 * 60 * 1000

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission to view permissions
    await assertCan(userContext.userId, PERMISSIONS.ROLES_READ)

    return await runWithOrgContext(orgId, async () => {
      const cacheKey = globalCacheKey('permissions')
      const permissions = await getCached(
        cacheKey,
        () => prisma.permission.findMany({
          select: {
            id: true,
            resource: true,
            action: true,
            scope: true,
            description: true,
          },
          orderBy: [
            { resource: 'asc' },
            { action: 'asc' },
            { scope: 'asc' },
          ],
        }),
        PERMISSIONS_CACHE_TTL
      )

      return NextResponse.json(ok(permissions))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch permissions:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch permissions'),
      { status: 500 }
    )
  }
}
