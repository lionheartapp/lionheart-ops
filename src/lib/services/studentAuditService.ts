/**
 * Student Audit Service — FERPA Compliance Logging
 *
 * Tracks all access and mutations to student data. Uses the existing
 * AuditLog model via the platform auditService for persistent storage.
 *
 * Audit logging is fire-and-forget — errors are swallowed so they
 * never break a request.
 */

import { audit } from '@/lib/services/auditService'

// ─────────────────────────────────────────────
//  Action types
// ─────────────────────────────────────────────

export type StudentAuditAction =
  | 'student.view'
  | 'student.create'
  | 'student.update'
  | 'student.deactivate'
  | 'student.roster_sync'

// ─────────────────────────────────────────────
//  Write audit entry
// ─────────────────────────────────────────────

/**
 * Log an access or mutation event against a student record.
 *
 * @param organizationId  Org context for the audit row
 * @param userId          ID of the user performing the action
 * @param action          One of the StudentAuditAction strings
 * @param studentId       ID of the student record (optional for bulk ops)
 * @param metadata        Extra context — fields changed, sync provider, etc.
 */
export async function logStudentAccess(
  organizationId: string,
  userId: string,
  action: StudentAuditAction,
  studentId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await audit({
      organizationId,
      userId,
      action,
      resourceType: 'Student',
      resourceId: studentId,
      resourceLabel: studentId ?? undefined,
      changes: metadata,
    })
  } catch {
    // Audit logging must never break the request
    console.error(
      `[STUDENT_AUDIT] failed: user=${userId} action=${action} student=${studentId || 'N/A'}`
    )
  }
}

// ─────────────────────────────────────────────
//  Query audit log
// ─────────────────────────────────────────────

/**
 * Retrieve student-related audit entries.
 *
 * Queries the AuditLog table filtered to resourceType='Student'.
 * Pagination via limit/offset.
 */
export async function getStudentAuditLog(filters: {
  organizationId: string
  studentId?: string
  userId?: string
  action?: StudentAuditAction
  limit?: number
  offset?: number
}) {
  try {
    // Import rawPrisma here to avoid circular-dep issues and because
    // AuditLog is NOT in the org-scoped extension model set.
    const { rawPrisma } = await import('@/lib/db')

    const where: Record<string, unknown> = {
      organizationId: filters.organizationId,
      resourceType: 'Student',
    }
    if (filters.studentId) where.resourceId = filters.studentId
    if (filters.userId) where.userId = filters.userId
    if (filters.action) where.action = filters.action

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
    const offset = Math.max(filters.offset ?? 0, 0)

    const [entries, total] = await Promise.all([
      rawPrisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      rawPrisma.auditLog.count({ where }),
    ])

    return { entries, total }
  } catch (err) {
    console.error('[STUDENT_AUDIT] query failed:', err)
    return { entries: [], total: 0 }
  }
}
