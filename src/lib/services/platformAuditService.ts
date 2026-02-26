/**
 * Platform Audit Service
 * 
 * Logs platform admin actions for accountability and debugging.
 * Uses rawPrisma since platform operations are not org-scoped.
 */

import { rawPrisma } from '@/lib/db'
import { NextRequest } from 'next/server'

export type PlatformAuditInput = {
  platformAdminId: string
  action: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Log a platform admin action (fire-and-forget)
 */
export function platformAudit(input: PlatformAuditInput): void {
  rawPrisma.platformAuditLog
    .create({ data: input })
    .catch((err) => console.error('[platformAudit] Failed to write audit log:', err))
}

/**
 * Extract IP address from request
 */
export function getPlatformIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Query platform audit logs with filters
 */
export async function queryPlatformAuditLogs(params: {
  adminId?: string
  action?: string
  resourceType?: string
  page?: number
  perPage?: number
}) {
  const { adminId, action, resourceType, page = 1, perPage = 50 } = params

  const where: Record<string, unknown> = {}
  if (adminId) where.platformAdminId = adminId
  if (action) where.action = { contains: action }
  if (resourceType) where.resourceType = resourceType

  const [logs, total] = await Promise.all([
    rawPrisma.platformAuditLog.findMany({
      where,
      include: {
        admin: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    rawPrisma.platformAuditLog.count({ where }),
  ])

  return { logs, total, page, perPage }
}
