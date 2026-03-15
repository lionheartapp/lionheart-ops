/**
 * GET /api/registration/[id]/portal
 *
 * Portal data endpoint — authenticated via portal JWT (NOT staff JWT).
 * Returns registration details, event info, schedule stubs, signatures, and payments.
 * Never returns RegistrationSensitiveData (FERPA-protected medical/emergency info).
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { verifyPortalToken } from '@/lib/services/registrationMagicLinkService'

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: registrationId } = await params

    // Extract portal JWT from Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Portal token required'),
        { status: 401 },
      )
    }

    const token = authHeader.slice(7)

    // Verify portal token — NOT a staff token
    let claims: Awaited<ReturnType<typeof verifyPortalToken>>
    try {
      claims = await verifyPortalToken(token)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN'
      if (message === 'INVALID_TOKEN_TYPE') {
        return NextResponse.json(
          fail('FORBIDDEN', 'Invalid token type. Staff tokens cannot access parent portals.'),
          { status: 403 },
        )
      }
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Portal token is invalid or expired. Please request a new link.'),
        { status: 401 },
      )
    }

    // Prevent cross-registration access — token must match the requested ID
    if (claims.registrationId !== registrationId) {
      return NextResponse.json(
        fail('FORBIDDEN', 'You do not have access to this registration.'),
        { status: 403 },
      )
    }

    // Fetch registration with all portal-relevant relations
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: {
        id: registrationId,
        organizationId: claims.organizationId,
        deletedAt: null,
      },
      include: {
        eventProject: {
          select: {
            id: true,
            title: true,
            description: true,
            startsAt: true,
            endsAt: true,
            coverImageUrl: true,
            locationText: true,
            scheduleBlocks: {
              select: {
                id: true,
                title: true,
                type: true,
                startsAt: true,
                endsAt: true,
                locationText: true,
                description: true,
              },
              orderBy: { startsAt: 'asc' },
            },
          },
        },
        form: {
          select: {
            title: true,
            basePrice: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        },
        signatures: {
          select: {
            id: true,
            documentLabel: true,
            signatureType: true,
            signedAt: true,
          },
          orderBy: { signedAt: 'asc' },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentType: true,
            discountCode: true,
            discountAmount: true,
            paidAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        // NOTE: sensitiveData intentionally excluded — FERPA/COPPA data
      },
    })

    if (!registration) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Registration not found.'),
        { status: 404 },
      )
    }

    // Shape the response
    const event = registration.eventProject
    const org = registration.form?.organization
    const schedule = event?.scheduleBlocks ?? []
    const signatures = registration.signatures
    const payments = registration.payments

    return NextResponse.json(
      ok({
        registration: {
          id: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          phone: registration.phone,
          grade: registration.grade,
          status: registration.status,
          paymentStatus: registration.paymentStatus,
          submittedAt: registration.submittedAt,
          promotedAt: registration.promotedAt,
        },
        event: event
          ? {
              id: event.id,
              title: event.title,
              description: event.description,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              coverImageUrl: event.coverImageUrl,
              locationText: event.locationText,
            }
          : null,
        formTitle: registration.form?.title ?? null,
        basePrice: registration.form?.basePrice ?? null,
        organization: org ?? null,
        schedule,
        signatures,
        payments,
      }),
    )
  } catch (error) {
    console.error('[registration/portal] Unexpected error:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong. Please try again.'),
      { status: 500 },
    )
  }
}
