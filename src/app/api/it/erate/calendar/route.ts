/**
 * GET /api/it/erate/calendar — E-Rate calendar tasks
 * POST /api/it/erate/calendar — seed E-Rate calendar for a school year
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { seedERateCalendar, getERateTasks } from '@/lib/services/itERateService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const schoolYear = searchParams.get('schoolYear') || undefined

  const tasks = await getERateTasks(orgId, schoolYear)

  return NextResponse.json(ok(tasks))
}, { permission: PERMISSIONS.IT_ERATE_VIEW })

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const { schoolYear } = body as { schoolYear: string }

  if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'schoolYear must be in format YYYY-YYYY'),
      { status: 400 }
    )
  }

  const count = await seedERateCalendar(orgId, schoolYear)

  return NextResponse.json(ok({ seeded: count }))
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
