import { compare, hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Password change needs passwordHash and verifies ctx.organizationId before updating by organizationId/email.
import { rawPrisma } from '@/lib/db'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { passwordSchema } from '@/lib/validation/password'
import { isPasswordBreached } from '@/lib/validation/password-breach-check'
import { audit, getIp } from '@/lib/services/auditService'

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export async function PATCH(request: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(request)
    const ctx = await getUserContext(request)

    if (!ctx?.userId || !orgId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const userId = ctx.userId
    const organizationId = orgId

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(fail('INVALID_JSON', 'Invalid JSON in request body'), { status: 400 })
    }

    const input = PasswordChangeSchema.parse(body)

    // Use rawPrisma for auth-related lookups (bypasses org-scope)
    const user = await rawPrisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
        deletedAt: null,
      },
      select: { email: true, passwordHash: true, organizationId: true },
    })

    if (!user || user.organizationId !== organizationId) {
      return NextResponse.json(fail('NOT_FOUND', 'User not found'), { status: 404 })
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        fail('NO_PASSWORD', 'No password set on this account. Use "Forgot Password" to set one.'),
        { status: 400 },
      )
    }

    const currentPasswordValid = await compare(input.currentPassword, user.passwordHash)
    if (!currentPasswordValid) {
      return NextResponse.json(fail('INVALID_PASSWORD', 'Current password is incorrect'), { status: 400 })
    }

    if (input.newPassword === input.currentPassword) {
      return NextResponse.json(
        fail('SAME_PASSWORD', 'New password must be different from your current password'),
        { status: 400 },
      )
    }

    // Check if new password has appeared in known data breaches
    if (await isPasswordBreached(input.newPassword)) {
      return NextResponse.json(
        fail('BREACHED_PASSWORD', 'This password has appeared in a data breach and is not safe to use. Please choose a different password.'),
        { status: 400 },
      )
    }

    const newPasswordHash = await hash(input.newPassword, 10)

    await rawPrisma.user.update({
      where: {
        organizationId_email: { organizationId, email: user.email },
      },
      data: { passwordHash: newPasswordHash },
    })

    void audit({
      organizationId,
      userId,
      userEmail: user.email,
      action: 'user.password_change',
      resourceType: 'User',
      resourceId: userId,
      resourceLabel: user.email,
      ipAddress: getIp(request),
    })

    return NextResponse.json(ok({ success: true }))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', err.issues[0]?.message || 'Invalid input'), { status: 400 })
    }
    logger.error({ error: String(err) }, 'Password change failed')
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Failed to change password'),
      { status: 500 },
    )
  }
}
