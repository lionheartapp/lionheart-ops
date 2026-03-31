import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { getCached, globalCacheKey } from '@/lib/cache/settings-cache'

// Permissions are global (not org-scoped) and never change at runtime — use 10 min TTL
const PERMISSIONS_CACHE_TTL = 10 * 60 * 1000

export const GET = withAuth(async () => {
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
}, { permission: PERMISSIONS.ROLES_READ })
