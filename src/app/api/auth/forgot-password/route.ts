import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import {
  generateSetupToken,
  hashSetupToken,
  getResetLink,
} from '@/lib/auth/password-setup'
import { sendPasswordResetEmail } from '@/lib/services/emailService'
import { audit, getIp } from '@/lib/services/auditService'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  organizationId: z.string().min(1, 'organizationId is required'),
})

const GENERIC_SUCCESS = { message: 'If an account exists, we sent a reset link.' }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues.map((e) => e.message)), { status: 400 })
    }

    const { email, organizationId } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Always return generic success to prevent email enumeration
    // Perform lookup silently in background
    const user = await rawPrisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: normalizedEmail,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        organizationId: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!user || user.status !== 'ACTIVE') {
      // Return generic success without sending anything
      return NextResponse.json(ok(GENERIC_SUCCESS))
    }

    // Invalidate all previous unused reset tokens for this user
    await rawPrisma.passwordSetupToken.updateMany({
      where: {
        userId: user.id,
        type: 'reset',
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    })

    // Generate a new reset token (expires in 1 hour)
    const token = generateSetupToken()
    const tokenHash = hashSetupToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await rawPrisma.passwordSetupToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: 'reset',
        expiresAt,
      },
    })

    const resetLink = getResetLink(token)
    const firstName = user.name?.split(' ')[0] || 'there'
    const orgName = user.organization?.name || 'your organization'

    // Fire-and-forget email send
    sendPasswordResetEmail({
      to: user.email,
      firstName,
      orgName,
      resetLink,
    }).catch((err) => {
      console.error('[forgot-password] Failed to send reset email:', err)
    })

    // Fire-and-forget audit log
    void audit({
      organizationId: user.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: 'user.password-reset-request',
      resourceType: 'User',
      resourceId: user.id,
      resourceLabel: user.email,
      ipAddress: getIp(req),
    })

    return NextResponse.json(ok(GENERIC_SUCCESS))
  } catch (error) {
    console.error('[POST /api/auth/forgot-password]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
