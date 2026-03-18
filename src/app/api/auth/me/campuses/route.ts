import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'

/**
 * GET /api/auth/me/campuses
 *
 * Returns the campuses the current user is assigned to (via UserCampusAssignment).
 * Falls back to ALL active campuses if the user has no assignments (e.g., super-admin).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getUserContext(req)

    // Get user's campus assignments
    const assignments = await rawPrisma.userCampusAssignment.findMany({
      where: {
        userId: ctx.userId,
        isActive: true,
      },
      include: {
        campus: {
          select: { id: true, name: true, isActive: true },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { campus: { name: 'asc' } }],
    })

    const assignedCampuses = assignments
      .filter((a: any) => a.campus?.isActive)
      .map((a: any) => ({
        id: a.campus.id,
        name: a.campus.name,
        isPrimary: a.isPrimary,
      }))

    // If user has no campus assignments, fall back to all active campuses
    // (super-admins and admins should see everything)
    if (assignedCampuses.length === 0) {
      const allCampuses = await rawPrisma.campus.findMany({
        where: { organizationId: ctx.organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(ok(allCampuses.map((c: any) => ({ ...c, isPrimary: false }))))
    }

    return NextResponse.json(ok(assignedCampuses))
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Something went wrong'),
      { status: 500 },
    )
  }
}
