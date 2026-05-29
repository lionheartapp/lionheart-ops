import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Audit log reads are manually scoped by orgId after withAuth/permission checks.
import { rawPrisma } from '@/lib/db'

const PAGE_SIZE = 50

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const page         = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit        = Math.min(PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10)))
  const action       = searchParams.get('action')       ?? undefined
  const userId       = searchParams.get('userId')       ?? undefined
  const resourceType = searchParams.get('resourceType') ?? undefined

  const from = searchParams.get('from') ?? undefined
  const to   = searchParams.get('to')   ?? undefined

  const where: Record<string, unknown> = { organizationId: orgId }
  if (action)       where.action       = action
  if (userId)       where.userId       = userId
  if (resourceType) where.resourceType = resourceType
  if (from || to) {
    const createdAt: Record<string, unknown> = {}
    if (from) createdAt.gte = new Date(from)
    if (to)   createdAt.lte = new Date(to)
    where.createdAt = createdAt
  }

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
  // CR-009: tightened from SETTINGS_READ (granted to MEMBER + many specialist
  // roles) to SETTINGS_UPDATE (Administrator only; Super Admin passes via the
  // *:* wildcard). Audit logs include other users' email addresses, IPs, and
  // resource changes — they shouldn't be readable by every member.
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
