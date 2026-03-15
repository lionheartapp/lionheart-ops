/**
 * Registration list API for staff.
 *
 * GET /api/events/projects/[id]/registrations
 *
 * Returns paginated list of registrations for this EventProject.
 * Does NOT include sensitiveData (separate medical endpoint for that).
 *
 * Requires: events:registration:manage permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'
import { RegistrationStatus } from '@prisma/client'

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

    const url = new URL(req.url)
    const statusParam = url.searchParams.get('status')
    const search = url.searchParams.get('search')?.trim() ?? ''
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)))
    const skip = (page - 1) * limit

    return await runWithOrgContext(orgId, async () => {
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
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[registrations GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
