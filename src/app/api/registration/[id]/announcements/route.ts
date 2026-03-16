import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getAnnouncementsForRegistration } from '@/lib/services/eventAnnouncementService'

/**
 * Public route — parent portal access (no auth required).
 * Registration ID is the access credential for this participant.
 *
 * GET /api/registration/[id]/announcements
 * Returns announcements targeted to this participant based on audience rules:
 *   - ALL: always included
 *   - GROUP: included if participant is in the targeted group
 *   - INCOMPLETE_DOCS: included if participant has any incomplete required document
 *   - PAID_ONLY: included if registration paymentStatus = PAID
 *
 * This path is covered by the existing middleware public rule:
 *   if (pathname.startsWith('/api/registration/')) return true
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Verify the registration exists before calling the service
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    })

    if (!registration || registration.deletedAt) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
    }

    const announcements = await getAnnouncementsForRegistration(id)
    return NextResponse.json(ok(announcements))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
