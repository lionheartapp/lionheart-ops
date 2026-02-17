import { getOrgId } from './orgContext'
import { prisma } from './prisma'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'

/** Record an audit log entry for sensitive mutations. Call from API routes. */
export async function logAction(params: {
  action: AuditAction
  entityType: string
  entityId?: string
  userId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const orgId = getOrgId()
    await prisma.auditLog.create({
      data: {
        organizationId: orgId ?? undefined,
        userId: params.userId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        metadata: params.metadata ? (params.metadata as object) : undefined,
      },
    })
  } catch (err) {
    console.error('Audit log failed:', err)
    // Don't throw - audit logging should not break the main operation
  }
}
