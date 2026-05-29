/**
 * Registration list API for staff.
 *
 * GET /api/events/projects/[id]/registrations
 *
 * Returns paginated list of registrations for this EventProject.
 * Does NOT include sensitiveData (separate medical endpoint for that).
 *
 * POST /api/events/projects/[id]/registrations
 *
 * Handles registration actions (cancel).
 *
 * Requires: events:registration:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Registration staff routes manually verify event org ownership before list/count/action queries.
import { rawPrisma } from '@/lib/db'
import { RegistrationStatus } from '@prisma/client'
import { cancelRegistration } from '@/lib/services/registrationService'

// ─── POST (Cancel action) ──────────────────────────────────────────────────────

const actionSchema = z.object({
  action: z.literal('cancel'),
  registrationId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ orgId, params, searchParams }) => {
  const eventProjectId = params.id

  // Verify the event project belongs to the caller's org
  const project = await rawPrisma.eventProject.findFirst({
    where: { id: eventProjectId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json(fail('NOT_FOUND', 'Event project not found'), { status: 404 })
  }

  const statusParam = searchParams.get('status')
  const search = searchParams.get('search')?.trim() ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const skip = (page - 1) * limit

  // Validate status param
  const validStatuses = Object.values(RegistrationStatus)
  const statusFilter = statusParam && validStatuses.includes(statusParam as RegistrationStatus)
    ? (statusParam as RegistrationStatus)
    : null

  // Build where clause
  const where = {
    eventProjectId,
    deletedAt: null,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {}),
  }

  // Run count + list in parallel
  const [total, registrations] = await Promise.all([
    rawPrisma.eventRegistration.count({ where }),
    rawPrisma.eventRegistration.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        grade: true,
        photoUrl: true,
        status: true,
        paymentStatus: true,
        submittedAt: true,
        createdAt: true,
        promotedAt: true,
      },
    }),
  ])

  // Fetch capacity info from the registration form
  const form = await rawPrisma.registrationForm.findUnique({
    where: { eventProjectId },
    select: { maxCapacity: true, waitlistEnabled: true },
  })

  // Count registrations by status for summary
  const [registeredCount, waitlistedCount, cancelledCount] = await Promise.all([
    rawPrisma.eventRegistration.count({
      where: { eventProjectId, status: RegistrationStatus.REGISTERED, deletedAt: null },
    }),
    rawPrisma.eventRegistration.count({
      where: { eventProjectId, status: RegistrationStatus.WAITLISTED, deletedAt: null },
    }),
    rawPrisma.eventRegistration.count({
      where: { eventProjectId, status: RegistrationStatus.CANCELLED, deletedAt: null },
    }),
  ])

  return NextResponse.json(ok({
    registrations,
    total,
    page,
    limit,
    capacity: {
      maxCapacity: form?.maxCapacity ?? null,
      waitlistEnabled: form?.waitlistEnabled ?? true,
      registeredCount,
      waitlistedCount,
      cancelledCount,
    },
  }))
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ orgId, params, body }) => {
  const eventProjectId = params.id

  // Verify the event project belongs to the caller's org
  const project = await rawPrisma.eventProject.findFirst({
    where: { id: eventProjectId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (!project) {
    return NextResponse.json(fail('NOT_FOUND', 'Event project not found'), { status: 404 })
  }

  if (body.action === 'cancel') {
    const { registrationId } = body

    // Verify the registration belongs to this event project
    const reg = await rawPrisma.eventRegistration.findUnique({
      where: { id: registrationId },
      select: { eventProjectId: true },
    })

    if (!reg || reg.eventProjectId !== eventProjectId) {
      return NextResponse.json(
        fail('NOT_FOUND', 'Registration not found'),
        { status: 404 },
      )
    }

    await cancelRegistration(registrationId)
    return NextResponse.json(ok({ cancelled: true }))
  }

  return NextResponse.json(fail('BAD_REQUEST', 'Unknown action'), { status: 400 })
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE, schema: actionSchema })
