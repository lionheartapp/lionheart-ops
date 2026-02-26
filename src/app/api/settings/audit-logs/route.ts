import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const page        = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
      const limit       = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10)))
      const action      = searchParams.get('action')       ?? undefined
      const userId      = searchParams.get('userId')       ?? undefined
      const resourceType= searchParams.get('resourceType') ?? undefined

      const where: Record<string, unknown> = { organizationId: orgId }
      if (action)       where.action       = action
      if (userId)       where.userId       = userId
      if (resourceType) where.resourceType = resourceType

      const [total, logs] = await Promise.all([
        rawPrisma.auditLog.count({ where }),
        rawPrisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip:  (page - 1) * limit,
          take:  limit,
          select: {
            id:            true,
            action:        true,
            resourceType:  true,
            resourceId:    true,
            resourceLabel: true,
            changes:       true,
            userEmail:     true,
            userId:        true,
            ipAddress:     true,
            createdAt:     true,
          },
        }),
      ])

      return NextResponse.json(
        ok(logs, {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        })
      )
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch audit logs'), { status: 500 })
  }
}
