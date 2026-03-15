/**
 * FERPA-gated medical data endpoint.
 *
 * GET /api/events/projects/[id]/registrations/[regId]/medical
 *
 * Returns RegistrationSensitiveData for a specific registration.
 * Requires the events:medical:read permission — strictly enforced.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  try {
    const { id: eventProjectId, regId: registrationId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    // FERPA gate — events:medical:read is required, not events:registration:manage
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_MEDICAL_READ)

    return await runWithOrgContext(orgId, async () => {
      // Verify the registration belongs to the correct event project
      const registration = await rawPrisma.eventRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true, eventProjectId: true },
      })

      if (!registration) {
        return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
      }

      if (registration.eventProjectId !== eventProjectId) {
        return NextResponse.json(
          fail('NOT_FOUND', 'Registration does not belong to this event project'),
          { status: 404 },
        )
      }

      // Fetch sensitive data
      const sensitiveData = await rawPrisma.registrationSensitiveData.findUnique({
        where: { registrationId },
        select: {
          id: true,
          allergies: true,
          medications: true,
          medicalNotes: true,
          emergencyName: true,
          emergencyPhone: true,
          emergencyRelationship: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!sensitiveData) {
        return NextResponse.json(
          fail('NOT_FOUND', 'No medical data on file for this registration'),
          { status: 404 },
        )
      }

      return NextResponse.json(ok(sensitiveData))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(
        fail('FORBIDDEN', 'Insufficient permissions to view medical data'),
        { status: 403 },
      )
    }
    console.error('[medical GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
