/**
 * Organization Signup/Onboarding API
 * 
 * Creates a new school organization with admin user.
 * Validates email uniqueness across all organizations (schools can share emails).
 * 
 * POST /api/organizations/signup
 * {
 *   "name": "Mitchell Academy",
 *   "schoolType": "HIGH_SCHOOL",
 *   "slug": "mitchell-academy",
 *   "physicalAddress": "123 Main St, Springfield, OR 97477",
 *   "district": "Springfield Public Schools",
 *   "website": "https://mitchell.edu",
 *   "phone": "(555) 010-1000",
 *   "principalTitle": "Principal",
 *   "principalName": "Sarah Mitchell",
 *   "principalEmail": "principal@mitchell.edu",
 *   "principalPhone": "(555) 010-1001",
 *   "gradeRange": "9-12",
 *   "studentCount": 1200,
 *   "staffCount": 95,
 *   "adminEmail": "principal@mitchell.edu",
 *   "adminName": "Sarah Mitchell",
 *   "adminPassword": "SecurePass123!"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { organizationRegistrationService } from '@/lib/services'
import { ok, fail } from '@/lib/api-response'
import { signAuthToken } from '@/lib/auth'
import { rawPrisma } from '@/lib/db'
import { ZodError } from 'zod'
import { generateSetupToken, hashSetupToken, getVerificationLink } from '@/lib/auth/password-setup'
import { sendVerificationEmail } from '@/lib/services/emailService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/organizations/signup', method: 'POST' })
  try {
    const body = await req.json()

    const result = await organizationRegistrationService.createOrganization(body)

    const adminUser = result.users[0]

    // Set onboarding status to ONBOARDING
    await rawPrisma.organization.update({
      where: { id: result.id },
      data: { onboardingStatus: 'ONBOARDING' },
    })

    // Generate JWT token for auto-login after signup
    const token = await signAuthToken({
      userId: adminUser.id,
      organizationId: result.id,
      email: adminUser.email,
    })

    // Send verification email (fire-and-forget — don't block signup on email failure)
    try {
      const verificationToken = generateSetupToken()
      const tokenHash = hashSetupToken(verificationToken)
      await rawPrisma.passwordSetupToken.create({
        data: {
          userId: adminUser.id,
          tokenHash,
          type: 'email-verification',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
      const verificationLink = getVerificationLink(verificationToken, result.slug)
      const firstName = (adminUser as any).firstName || (adminUser as any).name || adminUser.email
      const emailResult = await sendVerificationEmail({
        to: adminUser.email,
        firstName,
        orgName: result.name,
        verificationLink,
      })
      if (!emailResult.sent) {
        log.warn({ reason: emailResult.reason }, 'Signup verification email not sent')
      }
    } catch (err) {
      log.warn({ err }, 'Failed to create verification token during signup')
    }

    // Return created organization with admin user details + auth token
    // Also set httpOnly auth cookie and CSRF cookie (matching login route pattern)
    const response = NextResponse.json(
      ok({
        organizationId: result.id,
        organizationName: result.name,
        slug: result.slug,
        admin: { ...adminUser, token },
        loginUrl: `https://${result.slug}.lionheartapp.com/login`,
      }),
      { status: 201 }
    )

    // Set httpOnly auth cookie (primary auth mechanism — replaces localStorage JWT)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    // Set CSRF token (non-httpOnly so JS can read it for X-CSRF-Token header)
    const csrfToken = crypto.randomUUID()
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    return response
  } catch (error) {
    log.error({ err: error }, 'Signup error')
    Sentry.captureException(error)

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        fail(
          'VALIDATION_ERROR',
          'Invalid input',
          error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          }))
        ),
        { status: 400 }
      )
    }

    // Handle slug uniqueness and other business logic errors
    if (error instanceof Error) {
      if (error.message.includes('Slug validation failed')) {
        return NextResponse.json(
          fail('CONFLICT', error.message.replace('Slug validation failed: ', '')),
          { status: 409 }
        )
      }

      if (error.message.includes('Unique constraint failed')) {
        return NextResponse.json(
          fail('CONFLICT', 'Email already registered in another organization'),
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create organization'),
      { status: 500 }
    )
  }
}
