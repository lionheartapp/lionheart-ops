import { compare, hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import { ok, fail } from '@/lib/api-response'
import { z } from 'zod'

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Missing or invalid authorization header'), { status: 401 })
    }

    const token = authHeader.slice(7)
    const claims = await verifyAuthToken(token)

    if (!claims?.userId || !claims?.organizationId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid token'), { status: 401 })
    }

    const { userId, organizationId } = claims

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(fail('INVALID_JSON', 'Invalid JSON in request body'), { status: 400 })
    }

    const input = PasswordChangeSchema.parse(body)

    // Use rawPrisma for auth-related lookups (bypasses org-scope)
    const user = await rawPrisma.user.findUnique({
      where: { id: userId },
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

    const newPasswordHash = await hash(input.newPassword, 10)

    await rawPrisma.user.update({
      where: {
        organizationId_email: { organizationId, email: user.email },
      },
      data: { passwordHash: newPasswordHash },
    })

    return NextResponse.json(ok({ success: true }))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', err.issues[0]?.message || 'Invalid input'), { status: 400 })
    }
    console.error('[PASSWORD CHANGE] Error:', err)
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Failed to change password'),
      { status: 500 },
    )
  }
}
