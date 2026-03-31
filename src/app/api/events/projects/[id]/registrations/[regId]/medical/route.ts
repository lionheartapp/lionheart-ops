/**
 * FERPA-gated medical data endpoint.
 *
 * GET /api/events/projects/[id]/registrations/[regId]/medical
 *
 * Returns RegistrationSensitiveData for a specific registration.
 * Requires the events:medical:read permission — strictly enforced.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma } from '@/lib/db'

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ params }) => {
  const { id: eventProjectId, regId: registrationId } = params

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
}, { permission: PERMISSIONS.EVENTS_MEDICAL_READ })
