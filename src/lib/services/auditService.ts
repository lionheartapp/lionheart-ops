/**
 * Audit Logging Service
 *
 * Provides a fire-and-forget `audit()` helper that writes an AuditLog row.
 * Errors are swallowed — audit logging must never crash a request.
 *
 * Usage:
 *   import { audit, getIp } from '@/lib/services/auditService'
 *
 *   await audit({
 *     organizationId: orgId,
 *     userId:         ctx.userId,
 *     userEmail:      ctx.email,
 *     action:         'user.invite',
 *     resourceType:   'User',
 *     resourceId:     newUser.id,
 *     resourceLabel:  newUser.email,
 *     changes:        { email, roleId, teamCount: teamIds.length },
 *     ipAddress:      getIp(req),
 *   })
 */

import { NextRequest } from 'next/server'
import { rawPrisma } from '@/lib/db'

// ─────────────────────────────────────────────
//  Action strings
// ─────────────────────────────────────────────

export type AuditAction =
  // Auth
  | 'user.login'
  // Users
  | 'user.invite'
  | 'user.update'
  | 'user.delete'
  // Roles
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  // Teams
  | 'team.create'
  | 'team.update'
  | 'team.delete'
  // Catch-all for anything else
  | (string & {})

// ─────────────────────────────────────────────
//  Input type
// ─────────────────────────────────────────────

export interface AuditInput {
  organizationId: string
  /** ID of the user who performed the action. Null for system events. */
  userId?: string | null
  /** Email at time of action — survives user deletion. */
  userEmail?: string | null
  action: AuditAction
  /** Model name, e.g. "User", "Role", "Team" */
  resourceType?: string
  /** UUID of the record that was affected */
  resourceId?: string
  /** Human-readable identifier at time of action (email, name, slug …) */
  resourceLabel?: string
  /** Structured metadata: changed fields, new values, counts, etc. Never include raw secrets. */
  changes?: Record<string, unknown>
  ipAddress?: string | null
}

// ─────────────────────────────────────────────
//  Core helper
// ─────────────────────────────────────────────

/**
 * Write an audit log entry.
 * Never throws — errors are logged to stderr and swallowed.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await rawPrisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId:         input.userId        ?? null,
        userEmail:      input.userEmail     ?? null,
        action:         input.action,
        resourceType:   input.resourceType  ?? null,
        resourceId:     input.resourceId    ?? null,
        resourceLabel:  input.resourceLabel ?? null,
        changes:        (input.changes as any) ?? undefined,
        ipAddress:      input.ipAddress     ?? null,
      },
    })
  } catch (err) {
    console.error('[audit] failed to write log entry:', err)
  }
}

// ─────────────────────────────────────────────
//  Utility
// ─────────────────────────────────────────────

/**
 * Extract best-guess client IP from request headers.
 * Returns null when not available (e.g. local dev without a proxy).
 */
export function getIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  )
}

/**
 * Strip any keys that should never appear in audit logs (passwords, tokens, hashes).
 */
const REDACTED_KEYS = new Set([
  'password', 'passwordHash', 'token', 'tokenHash', 'secret', 'apiKey', 'accessToken', 'refreshToken',
])

export function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !REDACTED_KEYS.has(k))
  )
}
