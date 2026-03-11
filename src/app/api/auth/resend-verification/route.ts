import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { generateSetupToken, hashSetupToken, getVerificationLink } from '@/lib/auth/password-setup'
import { sendVerificationEmail } from '@/lib/services/emailService'
import { ok, fail } from '@/lib/api-response'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  organizationId: z.string().min(1, 'organizationId is required'),
})

const GENERIC_SUCCESS = { message: 'If your account exists and is unverified, a verification email has been sent.' }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'email and organizationId are required'), { status: 400 })
    }

    const { email, organizationId } = parsed.data

    // Look up user — use generic success even if not found (prevent enumeration)
    const user = await rawPrisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: email.trim().toLowerCase(),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        emailVerified: true,
        deletedAt: true,
        organizationId: true,
        organization: {
          select: { name: true, slug: true },
        },
      },
    })

    // Not found, deleted, or already verified — return generic success
    if (!user || user.deletedAt || user.emailVerified) {
      return NextResponse.json(ok(GENERIC_SUCCESS))
    }

    // ─── Rate limit: max 3 resend tokens created in the last hour ────
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentCount = await rawPrisma.passwordSetupToken.count({
      where: {
        userId: user.id,
        type: 'email-verification',
        createdAt: { gte: oneHourAgo },
      },
    })

    if (recentCount >= 3) {
      // Still return generic success — don't reveal rate limit to potential attacker
      return NextResponse.json(ok(GENERIC_SUCCESS))
    }

    // Invalidate previous unused verification tokens for this user
    await rawPrisma.passwordSetupToken.updateMany({
      where: {
        userId: user.id,
        type: 'email-verification',
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    })

    // Generate new verification token
    const token = generateSetupToken()
    const tokenHash = hashSetupToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await rawPrisma.passwordSetupToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: 'email-verification',
        expiresAt,
      },
    })

    const verificationLink = getVerificationLink(token, user.organization!.slug)
    const firstName = user.firstName || user.name || user.email

    // Must await — Vercel serverless kills process after response
    const emailResult = await sendVerificationEmail({
      to: user.email,
      firstName,
      orgName: user.organization?.name ?? 'your organization',
      verificationLink,
    })

    if (!emailResult.sent) {
      console.error('[POST /api/auth/resend-verification] Email not sent:', emailResult.reason)
    }

    return NextResponse.json(ok(GENERIC_SUCCESS))
  } catch (error) {
    console.error('[POST /api/auth/resend-verification]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
