import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listCampusAssignments,
  assignUserToCampus,
  CreateCampusAssignmentSchema,
} from '@/lib/services/campusService'

export const GET = withAuth(async ({ searchParams }) => {
  const userId = searchParams.get('userId') || undefined
  const campusId = searchParams.get('campusId') || undefined

  const assignments = await listCampusAssignments({ userId, campusId })
  return NextResponse.json(ok(assignments))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth(async ({ body }) => {
  const assignment = await assignUserToCampus(body)
  return NextResponse.json(ok(assignment), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateCampusAssignmentSchema })
