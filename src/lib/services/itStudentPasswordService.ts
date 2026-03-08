/**
 * IT Student Password Reset Service
 *
 * Handles secure password reset flow for student accounts:
 * - Student lookup by studentId or email (uses rawPrisma for cross-org safety)
 * - Cryptographically secure token generation with SHA-256 hashing
 * - Token validation with expiry and single-use enforcement
 * - Password update on linked User accounts
 */

import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ─── Lookup Student ───────────────────────────────────────────────────────────

export async function lookupStudent(orgId: string, query: { studentId?: string; email?: string }) {
  if (!query.studentId && !query.email) throw new Error('studentId or email required')

  const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null }
  if (query.studentId) where.studentId = query.studentId
  if (query.email) where.email = query.email

  const student = await rawPrisma.student.findFirst({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      studentId: true,
      grade: true,
      school: { select: { id: true, name: true } },
    },
  })

  return student
}

// ─── Generate Reset Token ─────────────────────────────────────────────────────

export async function generateResetToken(orgId: string, studentId: string) {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

  await rawPrisma.iTStudentPasswordToken.create({
    data: {
      organizationId: orgId,
      studentId,
      tokenHash,
      expiresAt,
    },
  })

  return { token: rawToken, expiresAt }
}

// ─── Validate Token ───────────────────────────────────────────────────────────

export async function validateToken(tokenHash: string) {
  const record = await rawPrisma.iTStudentPasswordToken.findUnique({
    where: { tokenHash },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true, organizationId: true },
      },
    },
  })

  if (!record) return null
  if (record.usedAt) return null
  if (record.expiresAt < new Date()) return null

  return record
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(rawToken: string, newPasswordHash: string) {
  const tokenHash = hashToken(rawToken)
  const record = await validateToken(tokenHash)
  if (!record) throw new Error('Invalid or expired token')

  // Mark token as used
  await rawPrisma.iTStudentPasswordToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  // Update the student's associated user account password if one exists
  // (Students may or may not have a User account linked)
  const user = await rawPrisma.user.findFirst({
    where: {
      organizationId: record.student.organizationId,
      email: record.student.email || undefined,
      deletedAt: null,
    },
  })

  if (user) {
    await rawPrisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })
  }

  return { success: true, studentId: record.studentId }
}
