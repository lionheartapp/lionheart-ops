/**
 * Share Config API for EventProjects
 *
 * GET  /api/events/projects/[id]/share  — fetch share config, URL, and QR code
 * PUT  /api/events/projects/[id]/share  — update share settings
 *
 * Requires: events:registration:manage permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import QRCode from 'qrcode'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'
import { updateRegistrationForm } from '@/lib/services/registrationService'

// ─── Validation ───────────────────────────────────────────────────────────────

const putSchema = z.object({
  openAt: z.string().datetime().optional().nullable(),
  closeAt: z.string().datetime().optional().nullable(),
  brandingOverride: z.record(z.string(), z.unknown()).optional().nullable(),
  maxCapacity: z.number().int().min(1).optional().nullable(),
  waitlistEnabled: z.boolean().optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      // Fetch the registration form for this event project
      const form = await rawPrisma.registrationForm.findUnique({
        where: { eventProjectId },
        select: {
          id: true,
          shareSlug: true,
          openAt: true,
          closeAt: true,
          maxCapacity: true,
          waitlistEnabled: true,
          brandingOverride: true,
        },
      })

      if (!form) {
        return NextResponse.json(
          fail('NOT_FOUND', 'Set up registration first'),
          { status: 404 },
        )
      }

      // Build the share URL
      const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_URL?.trim() || 'https://app.lionheartapp.com'

      // Fetch org slug for tenant URL construction
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { slug: true },
      })

      const orgSlug = org?.slug ?? ''
      const shareUrl = `${baseUrl}/events/public/${orgSlug}/${form.shareSlug}`

      // Generate QR code (server-side)
      const qrCodeSvg = await QRCode.toString(shareUrl, {
        type: 'svg',
        width: 300,
        margin: 1,
      })

      const qrCodeDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 300,
        margin: 1,
      })

      // Count current registrations
      const [registeredCount, waitlistedCount] = await Promise.all([
        rawPrisma.eventRegistration.count({
          where: {
            formId: form.id,
            status: 'REGISTERED',
            deletedAt: null,
          },
        }),
        rawPrisma.eventRegistration.count({
          where: {
            formId: form.id,
            status: 'WAITLISTED',
            deletedAt: null,
          },
        }),
      ])

      // Compute isOpen
      const now = new Date()
      let isOpen = true
      if (form.openAt && now < form.openAt) isOpen = false
      if (form.closeAt && now > form.closeAt) isOpen = false

      return NextResponse.json(ok({
        shareUrl,
        qrCodeSvg,
        qrCodeDataUrl,
        openAt: form.openAt,
        closeAt: form.closeAt,
        maxCapacity: form.maxCapacity,
        waitlistEnabled: form.waitlistEnabled,
        brandingOverride: form.brandingOverride,
        registeredCount,
        waitlistedCount,
        isOpen,
      }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[share GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    const body = await req.json()
    const parsed = putSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid share config', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const form = await rawPrisma.registrationForm.findUnique({
        where: { eventProjectId },
        select: { id: true },
      })

      if (!form) {
        return NextResponse.json(
          fail('NOT_FOUND', 'Registration form not found'),
          { status: 404 },
        )
      }

      const { openAt, closeAt, brandingOverride, maxCapacity, waitlistEnabled } = parsed.data

      await updateRegistrationForm(form.id, {
        ...(openAt !== undefined && { openAt: openAt ? new Date(openAt) : undefined }),
        ...(closeAt !== undefined && { closeAt: closeAt ? new Date(closeAt) : undefined }),
        ...(brandingOverride !== undefined && { brandingOverride: brandingOverride ?? undefined }),
        ...(maxCapacity !== undefined && { maxCapacity: maxCapacity ?? undefined }),
        ...(waitlistEnabled !== undefined && { waitlistEnabled }),
      })

      const updated = await rawPrisma.registrationForm.findUnique({
        where: { id: form.id },
        select: {
          openAt: true,
          closeAt: true,
          maxCapacity: true,
          waitlistEnabled: true,
          brandingOverride: true,
        },
      })

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[share PUT]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
